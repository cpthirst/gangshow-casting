import { ADMIN_GROUP, CASTING_GROUP, READ_ONLY_GROUP } from "@app/shared";
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

/** The team's accounts in the hosted Cognito user pool (ADR 0018). */
export function cognitoUserDirectory(
  cognito: CognitoIdentityProviderClient,
  userPoolId: string,
): UserDirectory {
  const user = (username: string) => ({ UserPoolId: userPoolId, Username: username });
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
        const admin = (await groupsOf(username)).includes(ADMIN_GROUP);
        return { username: Username, enabled: Enabled === true, admin };
      } catch (error) {
        if (error instanceof UserNotFoundException) return undefined;
        throw error;
      }
    },
    async list() {
      const admins = await membersOf(ADMIN_GROUP);
      return (await everyone()).map((account) => ({
        ...account,
        admin: admins.has(account.username),
      }));
    },
    async create(username, temporaryPassword) {
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
      // As every non-admin team member could before team roles (ADR 0020). If this fails, the
      // account is left read-only, which is safe; `pnpm account roles` makes it casting.
      await joinCasting(username);
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
    async setAdmin(username, admin) {
      const Command = admin ? AdminAddUserToGroupCommand : AdminRemoveUserFromGroupCommand;
      await cognito.send(new Command({ ...user(username), GroupName: ADMIN_GROUP }));
      if (admin) return;
      // Left with no role, they'd be read-only (ADR 0020), so they become casting as non-admins
      // were before team roles. A read-only account stays read-only.
      const groups = await groupsOf(username);
      if (!groups.includes(CASTING_GROUP) && !groups.includes(READ_ONLY_GROUP)) {
        await joinCasting(username);
      }
    },
    async withoutRole() {
      const withRole = new Set<string>();
      for (const group of [ADMIN_GROUP, CASTING_GROUP, READ_ONLY_GROUP]) {
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
