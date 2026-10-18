import type { SignInConfig } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  changeRefusedAsReadOnly,
  isAdmin,
  isReadOnly,
  isSignedIn,
  type SignedInUser,
  SignInEnded,
  type SignInManager,
  signIn,
  signInNeeded,
  signOut,
  useHostedSignIn,
  useLocalSignIn,
} from "./sign-in.ts";

const config: SignInConfig = {
  clientId: "made-up-client",
  issuer: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_madeup",
  loginUrl: "https://made-up.auth.eu-west-2.amazoncognito.com",
  appUrl: "https://d111111abcdef8.cloudfront.net/",
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
// A rehearsal morning.
const MORNING = Date.UTC(2026, 9, 17, 9, 0);

/** Signed in this morning: the token runs out at 10 o'clock. */
const sam = (overrides: Partial<SignedInUser> = {}): SignedInUser => ({
  accessToken: "sams-token",
  expiresAt: MORNING + HOUR,
  groups: [],
  ...overrides,
});

const signInOver = async (): Promise<SignedInUser> => {
  throw new SignInEnded();
};

/** A sign-in library holding what's stored on this device, if anything. */
function managerWith(stored: SignedInUser | null, overrides: Partial<SignInManager> = {}) {
  return {
    storedUser: vi.fn(async () => stored),
    refresh: vi.fn(signInOver),
    finishSignIn: vi.fn(async () => sam()),
    startSignIn: vi.fn(async () => {}),
    revoke: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
    ...overrides,
  } satisfies SignInManager;
}

/** The browser's address bar, as the sign-in sees it. */
function browserAt(path: string, search = "") {
  return { path, search, replacePath: vi.fn(), goTo: vi.fn() };
}

const ok = () => new Response("{}", { status: 200 });
const sentToken = (fetchMock: ReturnType<typeof vi.fn>) =>
  new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get("authorization");

describe("signing in", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MORNING);
    signInNeeded.value = false;
    fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts from the page the person asked for", async () => {
    const manager = managerWith(null);
    await useHostedSignIn(config, manager, browserAt("/cast", "?section=scouts"));

    await signIn();

    expect(manager.startSignIn).toHaveBeenCalledWith("/cast?section=scouts");
  });

  it("returns to that page once signed in, and sends the sign-in to the API", async () => {
    const manager = managerWith(null, {
      finishSignIn: vi.fn(async () => sam({ returnTo: "/cast" })),
    });
    const browser = browserAt("/", "?code=made-up&state=made-up");

    await useHostedSignIn(config, manager, browser);
    await apiFetch("/api/health");

    expect(browser.replacePath).toHaveBeenCalledWith("/cast");
    expect(signInNeeded.value).toBe(false);
    expect(isSignedIn.value).toBe(true);
    expect(sentToken(fetchMock)).toBe("Bearer sams-token");
  });

  it("returns only to one of the app's own pages", async () => {
    const finishSignIn = vi.fn(async () => sam({ returnTo: "//elsewhere.example/cast" }));
    const manager = managerWith(null, { finishSignIn });
    const browser = browserAt("/", "?code=made-up&state=made-up");

    await useHostedSignIn(config, manager, browser);
    // Browsers read a backslash as a slash.
    finishSignIn.mockResolvedValue(sam({ returnTo: "/\\elsewhere.example/cast" }));
    await useHostedSignIn(config, manager, browser);

    expect(browser.replacePath.mock.calls).toEqual([["/"], ["/"]]);
  });

  it("asks to sign in again when coming back from a sign-in that failed", async () => {
    const manager = managerWith(null, {
      finishSignIn: vi.fn(async (): Promise<SignedInUser> => {
        throw new Error("access_denied");
      }),
    });
    const browser = browserAt("/", "?error=access_denied&state=made-up");

    await useHostedSignIn(config, manager, browser);

    expect(browser.replacePath).toHaveBeenCalledWith("/");
    expect(signInNeeded.value).toBe(true);
  });

  it("treats a page's own code in the address as a page, not a sign-in", async () => {
    const manager = managerWith(sam());
    const browser = browserAt("/cast", "?code=1");

    await useHostedSignIn(config, manager, browser);

    expect(manager.finishSignIn).not.toHaveBeenCalled();
    expect(browser.replacePath).not.toHaveBeenCalled();
    expect(isSignedIn.value).toBe(true);
  });

  it("keeps a sign-in from earlier that day", async () => {
    await useHostedSignIn(config, managerWith(sam()), browserAt("/"));

    await apiFetch("/api/health");

    expect(signInNeeded.value).toBe(false);
    expect(sentToken(fetchMock)).toBe("Bearer sams-token");
  });

  it("renews the token when it runs out with the app open", async () => {
    const refresh = vi.fn(async () =>
      sam({ accessToken: "renewed-token", expiresAt: MORNING + 2 * HOUR }),
    );
    await useHostedSignIn(config, managerWith(sam(), { refresh }), browserAt("/"));
    await apiFetch("/api/health");
    expect(sentToken(fetchMock)).toBe("Bearer sams-token");

    vi.setSystemTime(MORNING + HOUR + 1);
    await apiFetch("/api/health");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(signInNeeded.value).toBe(false);
    expect(sentToken(fetchMock)).toBe("Bearer renewed-token");
  });

  it("renews the token once for requests made together, and again an hour later", async () => {
    let renewals = 0;
    const refresh = vi.fn(async () => {
      renewals += 1;
      return sam({ accessToken: `token-${renewals}`, expiresAt: Date.now() + HOUR });
    });
    await useHostedSignIn(config, managerWith(sam(), { refresh }), browserAt("/"));

    vi.setSystemTime(MORNING + HOUR + 1);
    await Promise.all([apiFetch("/api/a"), apiFetch("/api/b"), apiFetch("/api/c")]);
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.setSystemTime(MORNING + 2 * HOUR + 2);
    await apiFetch("/api/a");

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(sentToken(fetchMock)).toBe("Bearer token-2");
  });

  it("asks to sign in again once the day's sign-in has run out, and sends no token", async () => {
    const manager = managerWith(sam());
    await useHostedSignIn(config, manager, browserAt("/cast"));
    vi.setSystemTime(MORNING + 25 * HOUR);

    await apiFetch("/api/health");

    expect(signInNeeded.value).toBe(true);
    expect(isSignedIn.value).toBe(false);
    expect(manager.forget).toHaveBeenCalled();
    expect(sentToken(fetchMock)).toBeNull();
  });

  it("keeps the day's sign-in when renewing fails for a poor signal", async () => {
    const refresh = vi.fn(async (): Promise<SignedInUser> => {
      throw new TypeError("Failed to fetch");
    });
    const manager = managerWith(sam(), { refresh });
    await useHostedSignIn(config, manager, browserAt("/"));
    vi.setSystemTime(MORNING + HOUR + 1);

    await apiFetch("/api/health");

    expect(manager.forget).not.toHaveBeenCalled();
    expect(isSignedIn.value).toBe(true);
    // The request goes as before, so the page reports the poor signal, not a sign-in.
    expect(signInNeeded.value).toBe(false);
    expect(sentToken(fetchMock)).toBe("Bearer sams-token");
  });

  it("keeps a 5-minute token renewed all afternoon, without asking to sign in or failing a request", async () => {
    // Each token is named after when it runs out.
    const expiring = (expiresAt: number) => sam({ accessToken: `${expiresAt}`, expiresAt });
    const refresh = vi.fn(async () => expiring(Date.now() + 5 * MINUTE));
    await useHostedSignIn(
      config,
      managerWith(expiring(MORNING + 5 * MINUTE), { refresh }),
      browserAt("/"),
    );

    // A request every 3 minutes from 9 until 5.
    for (let at = MORNING; at < MORNING + 8 * HOUR; at += 3 * MINUTE) {
      vi.setSystemTime(at);
      expect((await apiFetch("/api/health")).ok).toBe(true);
      // Never a token with less than a minute left, so none runs out on the way.
      const expiresAt = Number(sentToken(fetchMock)?.replace("Bearer ", ""));
      expect(expiresAt - at).toBeGreaterThan(MINUTE);
    }

    expect(signInNeeded.value).toBe(false);
    expect(isSignedIn.value).toBe(true);
    expect(refresh).toHaveBeenCalled();
  });

  it("treats someone as read-only once the API refuses a change as read-only, saying so", async () => {
    await useHostedSignIn(config, managerWith(sam({ groups: ["casting"] })), browserAt("/"));
    expect(isReadOnly.value).toBe(false);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "You have read-only access." }), { status: 403 }),
    );

    const res = await apiFetch("/api/productions/p/items/i/notes", { method: "PUT" });

    expect(isReadOnly.value).toBe(true);
    expect(changeRefusedAsReadOnly.value).toBe(true);
    // The page can still read the refusal for itself.
    expect(await res.json()).toEqual({ message: "You have read-only access." });
  });

  it("keeps someone's role when the API refuses a change for another reason", async () => {
    await useHostedSignIn(config, managerWith(sam({ groups: ["casting"] })), browserAt("/"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Only admins can do this." }), { status: 403 }),
    );

    await apiFetch("/api/productions/p/cast/c", { method: "DELETE" });

    expect(isReadOnly.value).toBe(false);
    expect(changeRefusedAsReadOnly.value).toBe(false);
  });

  it("forgets a read-only refusal when someone else signs in", async () => {
    await useHostedSignIn(config, managerWith(sam({ groups: ["casting"] })), browserAt("/"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "You have read-only access." }), { status: 403 }),
    );
    await apiFetch("/api/productions/p/cast", { method: "POST" });

    await useHostedSignIn(config, managerWith(sam({ groups: ["admin"] })), browserAt("/"));

    expect(isAdmin.value).toBe(true);
    expect(changeRefusedAsReadOnly.value).toBe(false);
  });

  it("asks to sign in when the API refuses the sign-in", async () => {
    await useHostedSignIn(config, managerWith(sam()), browserAt("/"));
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));

    await apiFetch("/api/health");

    expect(signInNeeded.value).toBe(true);
  });

  it("sends the sign-in only to the app's own API", async () => {
    await useHostedSignIn(config, managerWith(sam()), browserAt("/"));

    for (const url of ["https://elsewhere.example/api/health", "/config.json"]) {
      await apiFetch(url);
      expect(sentToken(fetchMock)).toBeNull();
    }
  });

  it("counts only members of the admin group as admins", async () => {
    await useHostedSignIn(config, managerWith(sam({ groups: ["crew"] })), browserAt("/"));
    expect(isAdmin.value).toBe(false);

    await useHostedSignIn(config, managerWith(sam({ groups: ["admin"] })), browserAt("/"));
    expect(isAdmin.value).toBe(true);
  });

  it("signs out on this device and ends the login pages' own session too", async () => {
    const manager = managerWith(sam());
    const browser = browserAt("/cast");
    await useHostedSignIn(config, manager, browser);

    await signOut();

    // A copy of the day's sign-in taken from this device stops working.
    expect(manager.revoke).toHaveBeenCalled();
    expect(manager.forget).toHaveBeenCalled();
    // Otherwise Cognito's own session would sign them straight back in.
    const logout = new URL(browser.goTo.mock.calls[0]?.[0] ?? "");
    expect(`${logout.origin}${logout.pathname}`).toBe(`${config.loginUrl}/logout`);
    expect(Object.fromEntries(logout.searchParams)).toEqual({
      client_id: config.clientId,
      logout_uri: config.appUrl,
    });
    expect(isSignedIn.value).toBe(false);
  });

  it("still signs out when the sign-in can't be revoked", async () => {
    const revoke = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const manager = managerWith(sam(), { revoke });
    const browser = browserAt("/cast");
    await useHostedSignIn(config, manager, browser);

    await signOut();

    expect(manager.forget).toHaveBeenCalled();
    expect(browser.goTo).toHaveBeenCalled();
  });

  describe("locally, with pnpm dev or pnpm demo", () => {
    it("needs no sign-in, sends no token, and treats everyone as an admin", async () => {
      useLocalSignIn();

      await apiFetch("/api/health");

      expect(signInNeeded.value).toBe(false);
      expect(isAdmin.value).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith("/api/health");
    });
  });
});
