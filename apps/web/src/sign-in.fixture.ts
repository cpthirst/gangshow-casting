import { useHostedSignIn } from "./sign-in.ts";

/** Signs a made-up team member in on the hosted app, in the given groups ("admin" or none). */
export function signInAs(groups: string[]) {
  const member = { accessToken: "made-up-token", expiresAt: Date.now() + 3_600_000, groups };
  return useHostedSignIn(
    // Never visited: this member is already signed in and never signs out.
    { clientId: "made-up-client", issuer: "unused", loginUrl: "unused", appUrl: "unused" },
    {
      storedUser: async () => member,
      refresh: async () => member,
      finishSignIn: async () => member,
      startSignIn: async () => {},
      revoke: async () => {},
      forget: async () => {},
    },
    { path: "/", search: "", replacePath: () => {}, goTo: () => {} },
  );
}
