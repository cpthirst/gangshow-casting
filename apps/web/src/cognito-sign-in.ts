// The team's sign-in through Cognito's login pages, by oidc-client-ts (ADR 0018).
import { SignInConfig } from "@app/shared";
import {
  ErrorResponse,
  type User,
  UserManager,
  type UserManagerSettings,
  WebStorageStateStore,
} from "oidc-client-ts";
import {
  type SignedInUser,
  SignInEnded,
  type SignInManager,
  signInUnavailable,
  useHostedSignIn,
  useLocalSignIn,
} from "./sign-in.ts";

/**
 * The Vite dev server (pnpm dev, pnpm demo, the browser tests) talks to the local API, which
 * needs no sign-in. Every built app signs in: without its config it can sign no one in, but
 * still says sign-in is needed rather than skipping it.
 */
export async function startSignIn({ devServer }: { devServer: boolean }) {
  if (devServer) {
    useLocalSignIn();
    return;
  }
  const config = await loadSignInConfig().catch(() => undefined);
  if (!config) {
    signInUnavailable();
    return;
  }
  // The app must still start: a sign-in it can't read is one to make again.
  await useHostedSignIn(config, cognitoSignIn(config)).catch(signInUnavailable);
}

/** Where to sign in, which the deploy writes next to the pages. */
export async function loadSignInConfig() {
  const res = await fetch("/config.json");
  if (!res.ok) throw new Error(`No sign-in config: HTTP ${res.status}`);
  return SignInConfig.parse(await res.json());
}

/**
 * The code flow with PKCE, as a public client. The endpoints are given rather than looked up,
 * so the pages only ever talk to the login domain. The sign-in is kept in the browser's
 * storage, so it lasts the day even after the tab is closed.
 */
export function cognitoSettings(config: SignInConfig, store: Storage): UserManagerSettings {
  return {
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.appUrl,
    response_type: "code",
    scope: "openid",
    metadata: {
      issuer: config.issuer,
      authorization_endpoint: `${config.loginUrl}/oauth2/authorize`,
      token_endpoint: `${config.loginUrl}/oauth2/token`,
      revocation_endpoint: `${config.loginUrl}/oauth2/revoke`,
    },
    userStore: new WebStorageStateStore({ store }),
    // Tokens are renewed when a request needs one (sign-in.ts), not on a timer.
    automaticSilentRenew: false,
    loadUserInfo: false,
  };
}

export function fromOidcUser(user: User): SignedInUser {
  const groups = user.profile["cognito:groups"];
  return {
    accessToken: user.access_token,
    // No end given counts as already ended, so it's renewed before use.
    expiresAt: (user.expires_at ?? 0) * 1000,
    groups: Array.isArray(groups) ? groups.filter((g) => typeof g === "string") : [],
    ...(typeof user.state === "string" ? { returnTo: user.state } : {}),
  };
}

export function cognitoSignIn(config: SignInConfig): SignInManager {
  const manager = new UserManager(cognitoSettings(config, window.localStorage));
  return {
    storedUser: async () => {
      const user = await manager.getUser();
      return user ? fromOidcUser(user) : null;
    },
    // Only with the day's refresh token, which goes straight to the token endpoint. Without
    // one the library would try a hidden frame, which the pages' CSP blocks.
    refresh: async () => {
      if (!(await manager.getUser())?.refresh_token) throw new SignInEnded();
      try {
        const user = await manager.signinSilent();
        if (!user) throw new SignInEnded();
        return fromOidcUser(user);
      } catch (error) {
        // The login domain's answer once the day's refresh token has run out or been revoked.
        if (error instanceof ErrorResponse && error.error === "invalid_grant") {
          throw new SignInEnded();
        }
        throw error;
      }
    },
    finishSignIn: async () => fromOidcUser(await manager.signinRedirectCallback()),
    startSignIn: (returnTo) => manager.signinRedirect({ state: returnTo }),
    revoke: () => manager.revokeTokens(["refresh_token"]),
    forget: () => manager.removeUser(),
  };
}
