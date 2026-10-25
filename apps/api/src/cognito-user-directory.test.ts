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
  it("finds an account, with whether it's enabled and its role", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "pat", Enabled: false });
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "admin" }] });

    expect(await directory().find("pat")).toEqual({
      username: "pat",
      enabled: false,
      role: "admin",
    });
    expect(inputsOf(AdminGetUserCommand)).toEqual([{ UserPoolId: POOL, Username: "pat" }]);
  });

  it("finds an account by any case of its username, answering with the pool's own", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "sam", Enabled: true });
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "casting" }] });

    expect(await directory().find("SAM")).toEqual({
      username: "sam",
      enabled: true,
      role: "casting",
    });
  });

  it("finds nothing for a username the pool doesn't have", async () => {
    cognito
      .on(AdminGetUserCommand)
      .rejects(new UserNotFoundException({ message: "User does not exist.", $metadata: {} }));

    expect(await directory().find("pat")).toBeUndefined();
  });

  it("creates an account without sending an invitation, as accounts have no email or phone", async () => {
    await directory().create("pat", "Made-up-1", "casting");

    expect(inputsOf(AdminCreateUserCommand)).toEqual([
      {
        UserPoolId: POOL,
        Username: "pat",
        TemporaryPassword: "Made-up-1",
        MessageAction: "SUPPRESS",
      },
    ]);
  });

  it.each([
    ["admin", "admin"],
    ["casting", "casting"],
  ] as const)("puts a new account in the %s role's group", async (role, group) => {
    await directory().create("pat", "Made-up-1", role);

    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([
      { UserPoolId: POOL, Username: "pat", GroupName: group },
    ]);
  });

  it("leaves a new Read-Only Team Member in no group, as the read-only group is retiring (ADR 0026)", async () => {
    await directory().create("jo", "Made-up-1", "read-only");

    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([]);
  });

  it("refuses a username the pool already has, ignoring case", async () => {
    cognito
      .on(AdminCreateUserCommand)
      .rejects(new UsernameExistsException({ message: "User already exists", $metadata: {} }));

    await expect(directory().create("Sam", "Made-up-1", "casting")).rejects.toThrow(UsernameTaken);
  });

  it("lists every account, page by page, with whether each is enabled and its role", async () => {
    cognito
      .on(ListUsersCommand, { UserPoolId: POOL })
      .resolves({ Users: [{ Username: "sam", Enabled: true }], PaginationToken: "next" })
      .on(ListUsersCommand, { UserPoolId: POOL, PaginationToken: "next" })
      .resolves({
        Users: [
          { Username: "lee", Enabled: false },
          { Username: "pat", Enabled: true },
          { Username: "jo", Enabled: true },
        ],
      });
    cognito
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "admin" })
      .resolves({ Users: [{ Username: "pat" }, { Username: "jo" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "casting" })
      .resolves({ Users: [{ Username: "sam" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "read-only" })
      .resolves({ Users: [{ Username: "jo" }] });

    // lee is in no role, and jo in read-only as well as admin: both may only read (ADR 0020).
    expect(await directory().list()).toEqual([
      { username: "sam", enabled: true, role: "casting" },
      { username: "lee", enabled: false, role: "read-only" },
      { username: "pat", enabled: true, role: "admin" },
      { username: "jo", enabled: true, role: "read-only" },
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

  it("makes an account read-only by taking it out of every role group, the retiring read-only one included", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({
      Groups: [
        { GroupName: "admin" },
        { GroupName: "casting" },
        { GroupName: "read-only" },
        { GroupName: "crew" },
      ],
    });

    await directory().setRole("pat", "read-only");

    const pat = { UserPoolId: POOL, Username: "pat" };
    expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual([
      { ...pat, GroupName: "admin" },
      { ...pat, GroupName: "casting" },
      { ...pat, GroupName: "read-only" },
    ]);
    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([]);
  });

  it("gives an account a role by taking it out of its other role groups, then adding it", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({
      Groups: [{ GroupName: "admin" }, { GroupName: "read-only" }, { GroupName: "crew" }],
    });

    await directory().setRole("pat", "casting");

    // Out of every role first: in between, no role means read-only, never more (ADR 0020).
    const pat = { UserPoolId: POOL, Username: "pat" };
    expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual([
      { ...pat, GroupName: "admin" },
      { ...pat, GroupName: "read-only" },
    ]);
    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([{ ...pat, GroupName: "casting" }]);
    const calls = cognito.calls().map((call) => call.args[0].constructor.name);
    expect(calls.lastIndexOf("AdminRemoveUserFromGroupCommand")).toBeLessThan(
      calls.indexOf("AdminAddUserToGroupCommand"),
    );
  });

  it("leaves an account already in the role in it", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "admin" }] });

    await directory().setRole("pat", "admin");

    expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual([]);
    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([]);
  });

  it("lists the accounts in the read-only group, page by page", async () => {
    cognito
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "read-only" })
      .resolves({ Users: [{ Username: "jo" }], NextToken: "next" })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "read-only", NextToken: "next" })
      .resolves({ Users: [{ Username: "lee" }] });

    expect(await directory().inReadOnlyGroup()).toEqual(["jo", "lee"]);
  });

  it("takes an account out of the read-only group and every other known group, read-only last, saying which others it left", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({
      Groups: [{ GroupName: "read-only" }, { GroupName: "casting" }, { GroupName: "crew" }],
    });

    const left = await directory().leaveReadOnlyGroup("jo");

    // read-only goes last, so the account stays read-only throughout.
    const jo = { UserPoolId: POOL, Username: "jo" };
    expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual([
      { ...jo, GroupName: "casting" },
      { ...jo, GroupName: "read-only" },
    ]);
    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([]);
    expect(left).toEqual(["casting"]);
  });

  it.each([
    ["read-only", ["casting", "stage", "tech", "costume"], undefined],
    ["casting", ["stage", "read-only"], "casting"],
    ["admin", ["tech", "costume"], "admin"],
  ] as const)(
    "leaves an account given the %s role in exactly that role's groups, out of every department",
    async (role, removed, added) => {
      cognito.on(AdminListGroupsForUserCommand).resolves({
        Groups: [...removed, "crew"].map((GroupName) => ({ GroupName })),
      });

      await directory().setRole("pat", role);

      const pat = { UserPoolId: POOL, Username: "pat" };
      expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual(
        removed.map((GroupName) => ({ ...pat, GroupName })),
      );
      expect(inputsOf(AdminAddUserToGroupCommand)).toEqual(
        added ? [{ ...pat, GroupName: added }] : [],
      );
    },
  );

  it("signs an account out everywhere", async () => {
    await directory().signOutEverywhere("pat");

    expect(inputsOf(AdminUserGlobalSignOutCommand)).toEqual([
      { UserPoolId: POOL, Username: "pat" },
    ]);
  });
});
