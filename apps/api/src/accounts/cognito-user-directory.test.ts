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
  it("finds an account, with whether it's enabled and its access", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "pat", Enabled: false });
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "admin" }] });

    expect(await directory().find("pat")).toEqual({
      username: "pat",
      enabled: false,
      access: "admin",
    });
    expect(inputsOf(AdminGetUserCommand)).toEqual([{ UserPoolId: POOL, Username: "pat" }]);
  });

  it("reads the wardrobe group as the Wardrobe permission", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "chris", Enabled: true });
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "wardrobe" }] });

    expect(await directory().find("chris")).toEqual({
      username: "chris",
      enabled: true,
      access: ["wardrobe"],
    });
  });

  it("reads the director group as the Director permission, alongside others", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "kim", Enabled: true });
    cognito.on(AdminListGroupsForUserCommand).resolves({
      Groups: [{ GroupName: "director" }, { GroupName: "casting" }],
    });

    expect(await directory().find("kim")).toEqual({
      username: "kim",
      enabled: true,
      access: ["casting", "director"],
    });
  });

  it("shows no permission for an account still in the old costume group", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "lee", Enabled: true });
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "costume" }] });

    expect(await directory().find("lee")).toEqual({ username: "lee", enabled: true, access: [] });
  });

  it("finds an account by any case of its username, answering with the pool's own", async () => {
    cognito.on(AdminGetUserCommand).resolves({ Username: "sam", Enabled: true });
    cognito.on(AdminListGroupsForUserCommand).resolves({
      Groups: [{ GroupName: "tech" }, { GroupName: "casting" }],
    });

    expect(await directory().find("SAM")).toEqual({
      username: "sam",
      enabled: true,
      access: ["casting", "tech"],
    });
  });

  it("finds nothing for a username the pool doesn't have", async () => {
    cognito
      .on(AdminGetUserCommand)
      .rejects(new UserNotFoundException({ message: "User does not exist.", $metadata: {} }));

    expect(await directory().find("pat")).toBeUndefined();
  });

  it("creates an account without sending an invitation, as accounts have no email or phone", async () => {
    await directory().create("pat", "Made-up-1", ["casting"]);

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
    ["admin", ["admin"]],
    [["casting"], ["casting"]],
    [
      ["stage", "tech"],
      ["stage", "tech"],
    ],
  ] as const)("puts a new account with the access %j in its groups", async (access, groups) => {
    await directory().create("pat", "Made-up-1", access === "admin" ? access : [...access]);

    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual(
      groups.map((GroupName) => ({ UserPoolId: POOL, Username: "pat", GroupName })),
    );
  });

  it("leaves a new read-only account in no group, as the read-only group is retiring (ADR 0026)", async () => {
    await directory().create("jo", "Made-up-1", []);

    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([]);
  });

  it("refuses a username the pool already has, ignoring case", async () => {
    cognito
      .on(AdminCreateUserCommand)
      .rejects(new UsernameExistsException({ message: "User already exists", $metadata: {} }));

    await expect(directory().create("Sam", "Made-up-1", ["casting"])).rejects.toThrow(
      UsernameTaken,
    );
  });

  it("lists every account, page by page, with whether each is enabled and its access", async () => {
    cognito
      .on(ListUsersCommand, { UserPoolId: POOL })
      .resolves({ Users: [{ Username: "sam", Enabled: true }], PaginationToken: "next" })
      .on(ListUsersCommand, { UserPoolId: POOL, PaginationToken: "next" })
      .resolves({
        Users: [
          { Username: "lee", Enabled: false },
          { Username: "pat", Enabled: true },
          { Username: "jo", Enabled: true },
          { Username: "kim", Enabled: true },
        ],
      });
    cognito
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "admin" })
      .resolves({ Users: [{ Username: "pat" }, { Username: "jo" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "casting" })
      .resolves({ Users: [{ Username: "sam" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "stage" })
      .resolves({ Users: [{ Username: "kim" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "tech" })
      .resolves({ Users: [{ Username: "kim" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "wardrobe" })
      .resolves({ Users: [] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "director" })
      .resolves({ Users: [{ Username: "sam" }] })
      .on(ListUsersInGroupCommand, { UserPoolId: POOL, GroupName: "read-only" })
      .resolves({ Users: [{ Username: "jo" }] });

    // lee is in no group, and jo in read-only as well as admin: both may only read (ADR 0026).
    expect(await directory().list()).toEqual([
      { username: "sam", enabled: true, access: ["casting", "director"] },
      { username: "lee", enabled: false, access: [] },
      { username: "pat", enabled: true, access: "admin" },
      { username: "jo", enabled: true, access: [] },
      { username: "kim", enabled: true, access: ["stage", "tech"] },
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

  it("makes an account read-only by taking it out of every known group, the retiring read-only one included", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({
      Groups: [
        { GroupName: "admin" },
        { GroupName: "casting" },
        { GroupName: "read-only" },
        { GroupName: "crew" },
      ],
    });

    await directory().setAccess("pat", []);

    const pat = { UserPoolId: POOL, Username: "pat" };
    expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual([
      { ...pat, GroupName: "admin" },
      { ...pat, GroupName: "casting" },
      { ...pat, GroupName: "read-only" },
    ]);
    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([]);
  });

  it("gives an account permissions by taking it out of its other groups, then adding the missing ones", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({
      Groups: [
        { GroupName: "admin" },
        { GroupName: "stage" },
        { GroupName: "read-only" },
        { GroupName: "crew" },
      ],
    });

    await directory().setAccess("pat", ["casting", "stage", "tech"]);

    // Out of the others first: in between, the account may do less, never more (ADR 0026).
    const pat = { UserPoolId: POOL, Username: "pat" };
    expect(inputsOf(AdminRemoveUserFromGroupCommand)).toEqual([
      { ...pat, GroupName: "admin" },
      { ...pat, GroupName: "read-only" },
    ]);
    expect(inputsOf(AdminAddUserToGroupCommand)).toEqual([
      { ...pat, GroupName: "casting" },
      { ...pat, GroupName: "tech" },
    ]);
    const calls = cognito.calls().map((call) => call.args[0].constructor.name);
    expect(calls.lastIndexOf("AdminRemoveUserFromGroupCommand")).toBeLessThan(
      calls.indexOf("AdminAddUserToGroupCommand"),
    );
  });

  it("leaves an account that already has the access as it is", async () => {
    cognito.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: "admin" }] });

    await directory().setAccess("pat", "admin");

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
    [[], ["casting", "stage", "tech", "wardrobe"], undefined],
    [["casting"], ["stage", "read-only"], "casting"],
    ["admin", ["tech", "wardrobe"], "admin"],
    [["director"], ["stage"], "director"],
    ["admin", ["director"], "admin"],
  ] as const)(
    "leaves an account given the access %j in exactly its groups, out of every other",
    async (access, removed, added) => {
      cognito.on(AdminListGroupsForUserCommand).resolves({
        Groups: [...removed, "crew"].map((GroupName) => ({ GroupName })),
      });

      await directory().setAccess("pat", access === "admin" ? access : [...access]);

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
