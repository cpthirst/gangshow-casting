import { type Access, ADMIN_GROUP, accessFrom, permissions, READ_ONLY_GROUP } from "@app/shared";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  paginateListUsers,
  paginateListUsersInGroup,
  UserNotFoundException,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { type UserDirectory, UsernameTaken } from "./user-directory.ts";

/** A client for the pool's region: a pool id starts with it, such as eu-west-2_AbC123. */
export function cognitoClientFor(userPoolId: string) {
  const [region = ""] = userPoolId.split("_");
  return new CognitoIdentityProviderClient({ region });
}

// Every group the API knows, the retiring read-only one included so a change of access leaves
// the account in only its access's groups (ADR 0026).
const KNOWN_GROUPS = [ADMIN_GROUP, ...permissions, READ_ONLY_GROUP];

/** The groups that give the access. A read-only account is in none (ADR 0026). */
const groupsFor = (access: Access): string[] => (access === "admin" ? [ADMIN_GROUP] : access);

/** The team's accounts in the hosted Cognito user pool (ADR 0018). */
export function cognitoUserDirectory(
  cognito: CognitoIdentityProviderClient,
  userPoolId: string,
): UserDirectory {
  const user = (username: string) => ({ UserPoolId: userPoolId, Username: username });
  async function removeFrom(username: string, group: string) {
    await cognito.send(
      new AdminRemoveUserFromGroupCommand({ ...user(username), GroupName: group }),
    );
  }

  async function addTo(username: string, group: string) {
    await cognito.send(new AdminAddUserToGroupCommand({ ...user(username), GroupName: group }));
  }

  async function groupsOf(username: string) {
    // The pool has a handful of groups, so the first page holds every one.
    const { Groups = [] } = await cognito.send(new AdminListGroupsForUserCommand(user(username)));
    return Groups.flatMap((group) => (group.GroupName ? [group.GroupName] : []));
  }

  /** The usernames in one group, every page of them. */
  async function membersOf(group: string) {
    const members = new Set<string>();
    const inGroup = { UserPoolId: userPoolId, GroupName: group };
    for await (const page of paginateListUsersInGroup({ client: cognito }, inGroup)) {
      for (const { Username } of page.Users ?? []) if (Username) members.add(Username);
    }
    return members;
  }

  /** Every account's username and whether it's enabled, every page of them. */
  async function everyone() {
    const users = [];
    for await (const page of paginateListUsers({ client: cognito }, { UserPoolId: userPoolId })) {
      for (const { Username, Enabled } of page.Users ?? []) {
        if (Username) users.push({ username: Username, enabled: Enabled === true });
      }
    }
    return users;
  }

  return {
    async find(username) {
      try {
        // The pool ignores case, so it answers with the username as it was created.
        const { Username = username, Enabled } = await cognito.send(
          new AdminGetUserCommand(user(username)),
        );
        const access = accessFrom(await groupsOf(username));
        return { username: Username, enabled: Enabled === true, access };
      } catch (error) {
        if (error instanceof UserNotFoundException) return undefined;
        throw error;
      }
    },
    async list() {
      const members = await Promise.all(
        KNOWN_GROUPS.map(async (group) => [group, await membersOf(group)] as const),
      );
      return (await everyone()).map((account) => ({
        ...account,
        access: accessFrom(
          members
            .filter(([, usernames]) => usernames.has(account.username))
            .map(([group]) => group),
        ),
      }));
    },
    async create(username, temporaryPassword, access) {
      try {
        await cognito.send(
          new AdminCreateUserCommand({
            ...user(username),
            TemporaryPassword: temporaryPassword,
            MessageAction: "SUPPRESS",
          }),
        );
      } catch (error) {
        if (error instanceof UsernameExistsException) throw new UsernameTaken(username);
        throw error;
      }
      // If this fails, the account is in too few groups, so may do less, never more (ADR
      // 0026), and its password was never shown: an admin resets it and sets its access.
      for (const group of groupsFor(access)) await addTo(username, group);
    },
    async setPassword(username, password, kind) {
      await cognito.send(
        new AdminSetUserPasswordCommand({
          ...user(username),
          Password: password,
          Permanent: kind === "permanent",
        }),
      );
    },
    async setEnabled(username, enabled) {
      const Command = enabled ? AdminEnableUserCommand : AdminDisableUserCommand;
      await cognito.send(new Command(user(username)));
    },
    async setAccess(username, access) {
      const targets = groupsFor(access);
      const groups = await groupsOf(username);
      // Out of the other groups first: in between, the account may do less, never more.
      for (const group of KNOWN_GROUPS.filter((g) => !targets.includes(g) && groups.includes(g))) {
        await removeFrom(username, group);
      }
      for (const group of targets.filter((g) => !groups.includes(g))) await addTo(username, group);
    },
    async inReadOnlyGroup() {
      return [...(await membersOf(READ_ONLY_GROUP))];
    },
    async leaveReadOnlyGroup(username) {
      const groups = await groupsOf(username);
      const others = KNOWN_GROUPS.filter((g) => g !== READ_ONLY_GROUP && groups.includes(g));
      // read-only last, as it cancels the others: the account stays read-only throughout.
      for (const group of [...others, READ_ONLY_GROUP]) await removeFrom(username, group);
      return others;
    },
    async signOutEverywhere(username) {
      await cognito.send(new AdminUserGlobalSignOutCommand(user(username)));
    },
  };
}
