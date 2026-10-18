import { ADMIN_GROUP, CASTING_GROUP, READ_ONLY_GROUP, roleFrom, type TeamRole } from "@app/shared";
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

const GROUP_OF: Record<TeamRole, string> = {
  admin: ADMIN_GROUP,
  casting: CASTING_GROUP,
  "read-only": READ_ONLY_GROUP,
};
const ROLE_GROUPS = Object.values(GROUP_OF);

/** The team's accounts in the hosted Cognito user pool (ADR 0018). */
export function cognitoUserDirectory(
  cognito: CognitoIdentityProviderClient,
  userPoolId: string,
): UserDirectory {
  const user = (username: string) => ({ UserPoolId: userPoolId, Username: username });
  // For `pnpm account roles`, which moves accounts from before team roles (ADR 0020).
  async function joinCasting(username: string) {
    await cognito.send(
      new AdminAddUserToGroupCommand({ ...user(username), GroupName: CASTING_GROUP }),
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
      await cognito.send(
        new AdminAddUserToGroupCommand({ ...user(username), GroupName: GROUP_OF[role] }),
      );
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
      // Out of the other roles first: in between, no role means read-only, never more (ADR 0020).
      for (const group of ROLE_GROUPS.filter((g) => g !== target && groups.includes(g))) {
        await cognito.send(
          new AdminRemoveUserFromGroupCommand({ ...user(username), GroupName: group }),
        );
      }
      if (!groups.includes(target)) {
        await cognito.send(
          new AdminAddUserToGroupCommand({ ...user(username), GroupName: target }),
        );
      }
    },
    async withoutRole() {
      const withRole = new Set<string>();
      for (const group of ROLE_GROUPS) {
        for (const username of await membersOf(group)) withRole.add(username);
      }
      return (await everyone())
        .map((account) => account.username)
        .filter((username) => !withRole.has(username));
    },
    joinCasting,
    async signOutEverywhere(username) {
      await cognito.send(new AdminUserGlobalSignOutCommand(user(username)));
    },
  };
}
