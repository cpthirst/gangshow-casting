import {
  AdminInitiateAuthCommand,
  type CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

export type PasswordSignIn = {
  userPoolId: string;
  clientId: string;
  username: string;
  password: string;
};

/**
 * Signs in through the post-deploy check's client, which takes only sign-ins made with AWS
 * credentials (ADR 0018). Returns the access token, as the pages will send it.
 */
export async function signInWithPassword(
  cognito: CognitoIdentityProviderClient,
  { userPoolId, clientId, username, password }: PasswordSignIn,
): Promise<string> {
  const { AuthenticationResult, ChallengeName } = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  );
  const token = AuthenticationResult?.AccessToken;
  if (token) return token;
  throw Object.assign(new Error("Sign-in didn't finish"), {
    name: ChallengeName ?? "NoToken",
  });
}
