import { ADMIN_GROUP } from "@app/shared";
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
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import type { UserDirectory } from "./user-directory.ts";

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

  return {
    async find(username) {
      try {
        const { Enabled } = await cognito.send(new AdminGetUserCommand(user(username)));
        // The pool has only the admin group, so the first page holds every group.
        const { Groups = [] } = await cognito.send(
          new AdminListGroupsForUserCommand(user(username)),
        );
        const admin = Groups.some((group) => group.GroupName === ADMIN_GROUP);
        return { username, enabled: Enabled === true, admin };
      } catch (error) {
        if (error instanceof UserNotFoundException) return undefined;
        throw error;
      }
    },
    async create(username, temporaryPassword) {
      await cognito.send(
        new AdminCreateUserCommand({
          ...user(username),
          TemporaryPassword: temporaryPassword,
          MessageAction: "SUPPRESS",
        }),
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
    async setAdmin(username, admin) {
      const Command = admin ? AdminAddUserToGroupCommand : AdminRemoveUserFromGroupCommand;
      await cognito.send(new Command({ ...user(username), GroupName: ADMIN_GROUP }));
    },
    async signOutEverywhere(username) {
      await cognito.send(new AdminUserGlobalSignOutCommand(user(username)));
    },
  };
}
