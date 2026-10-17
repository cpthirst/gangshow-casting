import {
  AdminInitiateAuthCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { signInWithPassword } from "./cognito-sign-in.ts";

const cognito = mockClient(CognitoIdentityProviderClient);
const account = {
  userPoolId: "eu-west-2_madeup",
  clientId: "made-up-check-client",
  username: "check-admin",
  password: "Made-up-password-1",
};
const signIn = () =>
  signInWithPassword(new CognitoIdentityProviderClient({ region: "eu-west-2" }), account);

beforeEach(() => cognito.reset());

describe("signInWithPassword", () => {
  it("signs in through the check client with the maintainer's AWS credentials", async () => {
    cognito
      .on(AdminInitiateAuthCommand)
      .resolves({ AuthenticationResult: { AccessToken: "made-up-access-token" } });

    expect(await signIn()).toBe("made-up-access-token");
    expect(cognito.commandCalls(AdminInitiateAuthCommand)[0]?.args[0].input).toEqual({
      UserPoolId: "eu-west-2_madeup",
      ClientId: "made-up-check-client",
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "check-admin", PASSWORD: "Made-up-password-1" },
    });
  });

  it("fails, naming the challenge, when the account must change its password first", async () => {
    cognito.on(AdminInitiateAuthCommand).resolves({ ChallengeName: "NEW_PASSWORD_REQUIRED" });

    await expect(signIn()).rejects.toThrow(
      expect.objectContaining({ name: "NEW_PASSWORD_REQUIRED" }),
    );
  });
});
