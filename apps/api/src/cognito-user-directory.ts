import {
  ADMIN_GROUP,
  CASTING_GROUP,
  permissions,
  READ_ONLY_GROUP,
  roleFrom,
  type TeamRole,
} from "@app/shared";
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

// A Read-Only Team Member is in no role group: the read-only group is retiring (ADR 0026).
const GROUP_OF: Record<TeamRole, string | undefined> = {
  admin: ADMIN_GROUP,
  casting: CASTING_GROUP,
  "read-only": undefined,
};
// The groups that decide a role today, the retiring one included so a role change leaves it.
const ROLE_GROUPS = [ADMIN_GROUP, CASTING_GROUP, READ_ONLY_GROUP];
// Every group the API knows: a role change leaves the account in only its role's (ADR 0026).
const KNOWN_GROUPS = [ADMIN_GROUP, ...permissions, READ_ONLY_GROUP];

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
        const role = roleFrom(await groupsOf(username));
        return { username: Username, enabled: Enabled === true, role };
      } catch (error) {
        if (error instanceof UserNotFoundException) return undefined;
        throw error;
      }
    },
    async list() {
      const members = await Promise.all(
        ROLE_GROUPS.map(async (group) => [group, await membersOf(group)] as const),
      );
      return (await everyone()).map((account) => ({
        ...account,
        role: roleFrom(
          members
            .filter(([, usernames]) => usernames.has(account.username))
            .map(([group]) => group),
        ),
      }));
    },
    async create(username, temporaryPassword, role) {
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
      // If this fails, the account is in no role, so may only read (ADR 0020), and its
      // password was never shown: an admin resets its password and gives it its role.
      const group = GROUP_OF[role];
      if (group) {
        await cognito.send(new AdminAddUserToGroupCommand({ ...user(username), GroupName: group }));
      }
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
    async setRole(username, role) {
      const target = GROUP_OF[role];
      const groups = await groupsOf(username);
      // Out of the other groups first: in between, no role means read-only, never more (ADR 0020).
      for (const group of KNOWN_GROUPS.filter((g) => g !== target && groups.includes(g))) {
        await removeFrom(username, group);
      }
      if (target && !groups.includes(target)) {
        await cognito.send(
          new AdminAddUserToGroupCommand({ ...user(username), GroupName: target }),
        );
      }
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
