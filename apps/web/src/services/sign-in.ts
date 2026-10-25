import {
  type Access,
  accessFrom,
  isRefusalAsReadOnly,
  LOCAL_ROLE_HEADER,
  localAccess,
  mayChange,
  type SignInConfig,
  type TeamRole,
} from "@app/shared";
import { computed, ref, shallowRef } from "vue";

/** A signed-in person, as the sign-in library keeps them on this device. */
export interface SignedInUser {
  /** The 5-minute token the API's sign-in check accepts. */
  accessToken: string;
  /** When that token runs out, in milliseconds since 1970. */
  expiresAt: number;
  username?: string;
  groups: string[];
  /** The page they asked for before going to sign in. */
  returnTo?: string;
}

/** The day's sign-in is over (or there's none to renew): only signing in again helps. */
export class SignInEnded extends Error {}

/** What the app needs from the sign-in library; cognito-sign-in.ts wraps oidc-client-ts. */
export interface SignInManager {
  storedUser(): Promise<SignedInUser | null>;
  /** A new 5-minute token; throws SignInEnded once the day's sign-in has run out. */
  refresh(): Promise<SignedInUser>;
  /** Completes a sign-in on returning from the login pages; throws if it failed. */
  finishSignIn(): Promise<SignedInUser>;
  startSignIn(returnTo: string): Promise<void>;
  /** Tells the login domain to stop honouring this device's day-long sign-in. */
  revoke(): Promise<void>;
  forget(): Promise<void>;
}

/** The parts of the address bar sign-in uses. */
export interface Browser {
  path: string;
  search: string;
  replacePath(path: string): void;
  goTo(url: string): void;
}

const theBrowser: Browser = {
  get path() {
    return window.location.pathname;
  },
  get search() {
    return window.location.search;
  },
  replacePath: (path) => window.history.replaceState(null, "", path),
  goTo: (url) => window.location.assign(url),
};

type Session =
  // Until the app has started its sign-in (main.ts), and in component tests.
  | { kind: "starting" }
  // pnpm dev and pnpm demo: the local API needs no sign-in, and acts for the role chosen
  // with the local role switch (team-roles FR16).
  | { kind: "local"; role: TeamRole }
  // The built app couldn't load its sign-in config, or read the stored sign-in.
  | { kind: "unavailable" }
  | { kind: "hosted"; config: SignInConfig; manager: SignInManager; browser: Browser };

const session = shallowRef<Session>({ kind: "starting" });
const user = shallowRef<SignedInUser | null>(null);
/** The API refused a change as read-only, though this sign-in's role allowed it. */
const refusedAsReadOnly = ref(false);
// A page asks for several things at once: they share one renewal.
let renewing: Promise<string | undefined> | undefined;

/**
 * Set when this page load completed a sign-in at the login pages. A sign-in lasts the day,
 * so only then does a session start; reopening or reloading is the same one (ADR 0024).
 */
export const justSignedIn = ref(false);
/** Set when no one is signed in, or the API refuses the sign-in: the app shows only how to sign in. */
export const signInNeeded = ref(false);
/** Signing in is through the login pages: never locally. */
export const isHosted = computed(() => session.value.kind === "hosted");
/** pnpm dev and pnpm demo, where anyone can switch role to try each one. */
export const isLocal = computed(() => session.value.kind === "local");
export const isSignedIn = computed(() => isHosted.value && user.value !== null);
export const isSignInUnavailable = computed(() => session.value.kind === "unavailable");
/** Who's signed in; no one locally, where the app acts for an admin who is no account. */
export const signedInUsername = computed(() => user.value?.username);
// What to show, not what's allowed: the API checks access for itself (ADR 0026). Locally
// the app acts for the chosen role; otherwise no sign-in, like no known group, may only read.
// After the API refuses a change as read-only, pages show the read-only view at once, not
// only once the sign-in renews with the new groups (team-roles FR12).
const access = computed<Access>(() => {
  if (refusedAsReadOnly.value) return [];
  return session.value.kind === "local"
    ? localAccess[session.value.role]
    : accessFrom(user.value?.groups ?? []);
});
/** The role the local role switch shows; none outside pnpm dev and pnpm demo. */
export const localRole = computed<TeamRole | undefined>(() => {
  if (session.value.kind !== "local") return undefined;
  return refusedAsReadOnly.value ? "read-only" : session.value.role;
});
export const isAdmin = computed(() => access.value === "admin");
/**
 * The casting pages and Running order show their change controls only to those who may
 * change Casting; everyone else sees them read-only (team-roles FR6, stage-props FR3).
 */
export const canChangeCasting = computed(() => mayChange(access.value, "casting"));
/** A change was refused because the person may only read: pages say it wasn't saved. */
export const changeRefusedAsReadOnly = computed(() => refusedAsReadOnly.value);

/** The app couldn't start its sign-in, so it can sign no one in. */
export function signInUnavailable() {
  justSignedIn.value = false;
  refusedAsReadOnly.value = false;
  session.value = { kind: "unavailable" };
  user.value = null;
  signInNeeded.value = true;
}

export function useLocalSignIn() {
  justSignedIn.value = false;
  refusedAsReadOnly.value = false;
  session.value = { kind: "local", role: "admin" };
  user.value = null;
  signInNeeded.value = false;
}

/** Acts for another role locally; the hosted app's role is only ever the account's own. */
export function chooseLocalRole(chosen: TeamRole) {
  if (session.value.kind !== "local") return;
  refusedAsReadOnly.value = false;
  session.value = { kind: "local", role: chosen };
}

/** Signs in through the team's login pages (ADR 0018), picking up any sign-in already made. */
export async function useHostedSignIn(
  config: SignInConfig,
  manager: SignInManager,
  browser: Browser = theBrowser,
) {
  refusedAsReadOnly.value = false;
  session.value = { kind: "hosted", config, manager, browser };
  const params = new URLSearchParams(browser.search);
  // The login pages always send state back, with a code or an error.
  const returning = params.has("state") && (params.has("code") || params.has("error"));
  user.value = returning
    ? await manager.finishSignIn().catch(() => null)
    : await manager.storedUser();
  justSignedIn.value = returning && user.value !== null;
  // Drop the sign-in's code from the address, landing on the page they asked for.
  if (returning) browser.replacePath(ownPage(user.value?.returnTo));
  signInNeeded.value = (await currentToken()) === undefined;
}

/** Only a path on this site: "//elsewhere", or "/\\elsewhere" as browsers read it, would leave it. */
const ownPage = (path: string | undefined) => (path && /^\/(?![/\\])/.test(path) ? path : "/");

export async function signIn() {
  if (session.value.kind !== "hosted") return;
  const { manager, browser } = session.value;
  await manager.startSignIn(`${browser.path}${browser.search}`);
}

export async function signOut() {
  if (session.value.kind !== "hosted") return;
  const { config, manager, browser } = session.value;
  // Best effort: signing out on this device mustn't wait on the network.
  await manager.revoke().catch(() => {});
  await manager.forget();
  user.value = null;
  // Cognito's own session would otherwise sign them straight back in.
  const logout = new URL(`${config.loginUrl}/logout`);
  logout.search = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.appUrl,
  }).toString();
  browser.goTo(logout.toString());
}

// Renew a little early, so a token doesn't run out between sending and arriving.
const RENEW_EARLY_MS = 60 * 1000;

/** The token to send, renewing one that has run out; undefined when no one is signed in. */
async function currentToken(): Promise<string | undefined> {
  if (session.value.kind !== "hosted" || !user.value) return undefined;
  if (user.value.expiresAt - RENEW_EARLY_MS > Date.now()) return user.value.accessToken;
  renewing ??= renew(session.value.manager).finally(() => {
    renewing = undefined;
  });
  return renewing;
}

async function renew(manager: SignInManager) {
  try {
    user.value = await manager.refresh();
    return user.value.accessToken;
  } catch (error) {
    // A poor signal keeps the day's sign-in, and the token it has: within a minute of its
    // end it still works, and after that the request fails for the signal, not the sign-in.
    if (!(error instanceof SignInEnded)) return user.value?.accessToken;
    user.value = null;
    await manager.forget();
    return undefined;
  }
}

/** Whether a request is for this site's API, the only place the sign-in is sent. */
function isOwnApi(input: RequestInfo | URL) {
  const url = new URL(input instanceof Request ? input.url : input, window.location.origin);
  return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}

/** fetch for the API's routes: sends the sign-in, and notices when the API refuses it. */
export async function apiFetch(...args: Parameters<typeof fetch>) {
  const [input, init] = args;
  const extra = isOwnApi(input) ? await ownApiHeader() : undefined;
  // Sent even with no token, so every refusal is handled in one place: the 401 below.
  const res = extra
    ? await fetch(input, { ...init, headers: withHeader(init?.headers, ...extra) })
    : await fetch(...args);
  if (res.status === 401 || (isHosted.value && !user.value)) signInNeeded.value = true;
  if (res.status === 403 && isRefusalAsReadOnly(await refusalOf(res))) {
    refusedAsReadOnly.value = true;
  }
  return res;
}

/** A refusal's message, read from a copy so the page can still read the reply. */
async function refusalOf(res: Response) {
  const body: unknown = await res
    .clone()
    .json()
    .catch(() => undefined);
  return typeof body === "object" && body !== null && "message" in body ? body.message : undefined;
}

/**
 * What the API needs to know who's asking: the sign-in when hosted, or locally the role
 * chosen with the switch. The local API acts for an admin unless told otherwise.
 */
async function ownApiHeader(): Promise<[string, string] | undefined> {
  if (session.value.kind === "local") {
    return session.value.role === "admin" ? undefined : [LOCAL_ROLE_HEADER, session.value.role];
  }
  const token = await currentToken();
  return token ? ["authorization", `Bearer ${token}`] : undefined;
}

function withHeader(headers: HeadersInit | undefined, name: string, value: string) {
  const merged = new Headers(headers);
  merged.set(name, value);
  return merged;
}
