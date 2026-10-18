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
  ListUsersCommand,
  ListUsersInGroupCommand,
  UserNotFoundException,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { cognitoClientFor, cognitoUserDirectory } from "./cognito-user-directory.ts";
import { UsernameTaken } from "./user-directory.ts";

const POOL = "eu-west-2_madeup";
const cognito = mockClient(CognitoIdentityProviderClient);
const directory = () =>
  cognitoUserDirectory(new CognitoIdentityProviderClient({ region: "eu-west-2" }), POOL);
const inputsOf = (command: Parameters<typeof cognito.commandCalls>[0]) =>
  cognito.commandCalls(command).map((call) => call.args[0].input);

beforeEach(() => cognito.reset());

describe("cognitoClientFor", () => {
  it("talks to the region the user pool is in", async () => {
    expect(await cognitoClientFor("eu-west-2_madeup").config.region()).toBe("eu-west-2");
  });
});

describe("the Cognito user directory", () => {
  it("finds an account, with whether it's enabled and an admin", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "pat", Enabled: false });
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "admin" }] });

    expect(await directory().find("pat")).toEqual({ username: "pat", enabled: false, admin: true });
    expect(inputsOf(AdminGetUserCommand)).toEqual([{ UserPoolId: POOL, Username: "pat" }]);
  });

  it("finds an account by any case of its username, answering with the pool's own", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "sam", Enabled: true });
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [] });

    expect(await directory().find("SAM")).toEqual({ username: "sam", enabled: true, admin: false });
  });

  it("finds nothing for a username the pool doesn't have", async () => {
    cognito
      .on(AdminGetUserCommand)
      .rejects(new UserNotFoundException({ message: "User does not exist.", $metadata: {} }));

    expect(await directory().find("pat")).toBeUndefined();
  });

  it("creates an account without sending an invitation, as accounts have no email or phone", async () => {
    await directory().create("pat", "Made-up-1");

    expect(inputsOf(AdminCreateUserCommand)).toEqual([
      {
        UserPoolId: POOL,
        Username: "pat",
        TemporaryPassword: "Made-up-1",
        MessageAction: "SUPPRESS",
      },
    ]);
  });

  it("makes a new account a Casting Team Member", async () => {
    await directory().create("pat", "Made-up-1");

    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([
      { UserPoolId: POOL, Username: "pat", GroupName: "casting" },
    ]);
  });

  it("refuses a username the pool already has, ignoring case", async () => {
    cognito
      .on(AdminCreateUserCommand)
      .rejects(new UsernameExistsException({ message: "User already exists", $metadata: {} }));

    await expect(directory().create("Sam", "Made-up-1")).rejects.toThrow(UsernameTaken);
  });

  it("lists every account, page by page, with whether each is enabled and an admin", async () => {
    cognito
      .on(ListUsersCommand, { UserPoolId: POOL })
      .resolves({ Users: [{ Username: "sam", Enabled: true }], PaginationToken: "next" })
      .on(ListUsersCommand, { UserPoolId: POOL, PaginationToken: "next" })
      .resolves({
        Users: [
          { Username: "lee", Enabled: false },
          { Username: "pat", Enabled: true },
        ],
      });
    cognito
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "admin" })
      .resolves({ Users: [{ Username: "pat" }] });

    expect(await directory().list()).toEqual([
      { username: "sam", enabled: true, admin: false },
      { username: "lee", enabled: false, admin: false },
      { username: "pat", enabled: true, admin: true },
    ]);
  });

  it("sets a temporary or a permanent password", async () => {
    await directory().setPassword("pat", "Made-up-1", "temporary");
    await directory().setPassword("pat", "Made-up-2", "permanent");

    expect(inputsOf(AdminSetUserPasswordCommand)).toEqual([
      { UserPoolId: POOL, Username: "pat", Password: "Made-up-1", Permanent: false },
      { UserPoolId: POOL, Username: "pat", Password: "Made-up-2", Permanent: true },
    ]);
  });

  it("enables and disables an account", async () => {
    await directory().setEnabled("pat", true);
    await directory().setEnabled("pat", false);

    expect(inputsOf(AdminEnableUserCommand)).toEqual([{ UserPoolId: POOL, Username: "pat" }]);
    expect(inputsOf(AdminDisableUserCommand)).toEqual([{ UserPoolId: POOL, Username: "pat" }]);
  });

  it("makes an account an admin, or not, through the admin group", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "casting" }] });

    await directory().setAdmin("pat", true);
    await directory().setAdmin("pat", false);

    const input = { UserPoolId: POOL, Username: "pat", GroupName: "admin" };
    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([input]);
    expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual([input]);
  });

  it("makes an account left with no role a Casting Team Member when admin is removed", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [] });

    await directory().setAdmin("pat", false);

    expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual([
      { UserPoolId: POOL, Username: "pat", GroupName: "admin" },
    ]);
    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([
      { UserPoolId: POOL, Username: "pat", GroupName: "casting" },
    ]);
  });

  it("never promotes a read-only account when admin is removed from it", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "read-only" }] });

    await directory().setAdmin("jo", false);

    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([]);
  });

  it("lists the accounts in no role group, page by page", async () => {
    cognito
      .on(ListUsersCommand, { UserPoolId: POOL })
      .resolves({ Users: [{ Username: "sam" }, { Username: "pat" }], PaginationToken: "next" })
      .on(ListUsersCommand, { UserPoolId: POOL, PaginationToken: "next" })
      .resolves({ Users: [{ Username: "kit" }, { Username: "jo" }, { Username: "lee" }] });
    cognito
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "admin" })
      .resolves({ Users: [{ Username: "pat" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "casting" })
      .resolves({ Users: [{ Username: "kit" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "read-only" })
      .resolves({ Users: [{ Username: "jo" }] });

    expect(await directory().withoutRole()).toEqual(["sam", "lee"]);
  });

  it("makes an account a Casting Team Member through the casting group", async () => {
    await directory().joinCasting("sam");

    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([
      { UserPoolId: POOL, Username: "sam", GroupName: "casting" },
    ]);
  });

  it("signs an account out everywhere", async () => {
    await directory().signOutEverywhere("pat");

    expect(inputsOf(AdminUserGlobalSignOutCommand)).toEqual([
      { UserPoolId: POOL, Username: "pat" },
    ]);
  });
});
