import type { SignInConfig } from "@app/shared";
import { User } from "oidc-client-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cognitoSettings,
  cognitoSignIn,
  fromOidcUser,
  loadSignInConfig,
  startSignIn,
} from "./cognito-sign-in.ts";
import {
  isHosted,
  isSignInUnavailable,
  SignInEnded,
  signInNeeded,
  useLocalSignIn,
} from "./sign-in.ts";

const config: SignInConfig = {
  clientId: "made-up-client",
  issuer: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_madeup",
  loginUrl: "https://made-up.auth.eu-west-2.amazoncognito.com",
  appUrl: "https://d111111abcdef8.cloudfront.net/",
};

/** A sign-in made earlier on this device, where oidc-client-ts keeps it. */
const storeSignIn = (user: User) =>
  localStorage.setItem(`oidc.user:${config.issuer}:${config.clientId}`, user.toStorageString());

/** The login domain's token endpoint, answering every request the same way. */
function tokenEndpointAnswering(status: number, body: object) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const userWith = (
  profile: Record<string, unknown>,
  extra: { userState?: unknown; refresh_token?: string } = {},
) =>
  new User({
    access_token: "sams-token",
    token_type: "Bearer",
    profile: { sub: "sam", iss: config.issuer, aud: config.clientId, exp: 0, iat: 0, ...profile },
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    ...extra,
  });

describe("Cognito sign-in", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the login pages' code flow with PKCE, returning to the app's address", () => {
    const settings = cognitoSettings(config, localStorage);

    expect(settings).toMatchObject({
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
    });
    expect(settings.disablePKCE).not.toBe(true);
  });

  it("keeps the sign-in in the browser's storage, so it lasts the day after the tab closes", async () => {
    storeSignIn(userWith({}));

    const stored = await cognitoSignIn(config).storedUser();

    expect(stored?.accessToken).toBe("sams-token");
  });

  it("reads the person's username, groups, token, its end and the page they asked for", () => {
    const user = userWith(
      { "cognito:username": "sam", "cognito:groups": ["admin"] },
      { userState: "/cast" },
    );

    expect(fromOidcUser(user)).toEqual({
      accessToken: "sams-token",
      expiresAt: (user.expires_at ?? 0) * 1000,
      username: "sam",
      groups: ["admin"],
      returnTo: "/cast",
    });
  });

  it("leaves the username out if the sign-in doesn't give one", () => {
    expect(fromOidcUser(userWith({}))).not.toHaveProperty("username");
  });

  it("treats someone in no group as in none", () => {
    expect(fromOidcUser(userWith({})).groups).toEqual([]);
  });

  describe("renewing", () => {
    beforeEach(() => localStorage.clear());

    it("refuses on a new device, without asking anyone", async () => {
      const fetchMock = vi.fn(async () => new Response("{}"));
      vi.stubGlobal("fetch", fetchMock);
      const manager = cognitoSignIn(config);

      expect(await manager.storedUser()).toBeNull();
      await expect(manager.refresh()).rejects.toBeInstanceOf(SignInEnded);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("trades the day's refresh token at the login domain for a new hour-long token", async () => {
      storeSignIn(userWith({}, { refresh_token: "days-refresh" }));
      const fetchMock = tokenEndpointAnswering(200, {
        access_token: "renewed-token",
        token_type: "Bearer",
        expires_in: 3600,
      });

      const renewed = await cognitoSignIn(config).refresh();

      expect(renewed.accessToken).toBe("renewed-token");
      const [url, init] = fetchMock.mock.calls[0] ?? [];
      expect(url).toBe(`${config.loginUrl}/oauth2/token`);
      expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toMatchObject({
        grant_type: "refresh_token",
        refresh_token: "days-refresh",
      });
    });

    it("says the sign-in has ended when the login domain refuses the refresh token", async () => {
      storeSignIn(userWith({}, { refresh_token: "days-refresh" }));
      tokenEndpointAnswering(400, { error: "invalid_grant" });

      await expect(cognitoSignIn(config).refresh()).rejects.toBeInstanceOf(SignInEnded);
    });

    it("doesn't say the sign-in has ended when the network fails", async () => {
      storeSignIn(userWith({}, { refresh_token: "days-refresh" }));
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      const refreshing = cognitoSignIn(config).refresh();

      await expect(refreshing).rejects.toThrow();
      await expect(refreshing).rejects.not.toBeInstanceOf(SignInEnded);
    });
  });

  it("revokes the day's refresh token at the login domain on signing out", async () => {
    localStorage.clear();
    storeSignIn(userWith({}, { refresh_token: "days-refresh" }));
    const fetchMock = tokenEndpointAnswering(200, {});

    await cognitoSignIn(config).revoke();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${config.loginUrl}/oauth2/revoke`);
    expect(new URLSearchParams(String(init?.body)).get("token")).toBe("days-refresh");
  });

  describe("starting the app", () => {
    beforeEach(() => {
      useLocalSignIn();
      localStorage.clear();
    });

    it("needs no sign-in on the dev server", async () => {
      vi.stubGlobal("fetch", vi.fn());

      await startSignIn({ devServer: true });

      expect(isHosted.value).toBe(false);
      expect(signInNeeded.value).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("signs in through the deployed config in a built app", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(config))),
      );

      await startSignIn({ devServer: false });

      expect(isHosted.value).toBe(true);
      expect(signInNeeded.value).toBe(true);
    });

    it("still starts, asking to sign in, when the stored sign-in can't be read", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(config))),
      );
      localStorage.setItem(`oidc.user:${config.issuer}:${config.clientId}`, "not a sign-in");

      await startSignIn({ devServer: false });

      expect(signInNeeded.value).toBe(true);
      expect(isSignInUnavailable.value).toBe(true);
    });

    it("still says sign-in is needed when the config is missing, never skipping it", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("", { status: 404 })),
      );

      await startSignIn({ devServer: false });

      expect(signInNeeded.value).toBe(true);
      expect(isSignInUnavailable.value).toBe(true);
    });
  });

  it("reads where to sign in from the deployed config file", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(config), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await loadSignInConfig()).toEqual(config);
    expect(fetchMock).toHaveBeenCalledWith("/config.json");
  });

  it("refuses a config file that isn't what the deploy writes", async () => {
    const insecure = { ...config, loginUrl: "http://made-up.example" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(insecure))),
    );

    await expect(loadSignInConfig()).rejects.toThrow();
  });
});
