/**
 * Every API route, as "<METHOD> <path>" with {name} path parameters. The API has a handler
 * for each (apps/api/src/routes.ts), and infra hosts exactly these, so a route can't be
 * served locally but missing, or unguarded, when hosted.
 */
export const routeKeys = [
  "GET /api/health",
  "GET /api/accounts",
  "POST /api/accounts",
  "POST /api/accounts/{username}/password",
  "PUT /api/accounts/{username}/enabled",
  "PUT /api/accounts/{username}/access",
  "GET /api/productions/{productionId}/running-order",
  "POST /api/productions/{productionId}/running-order/versions",
  "GET /api/productions/{productionId}/cast",
  "POST /api/productions/{productionId}/cast",
  "PUT /api/productions/{productionId}/cast/{castId}",
  "DELETE /api/productions/{productionId}/cast/{castId}",
  "GET /api/productions/{productionId}/roles",
  "GET /api/productions/{productionId}/item-notes",
  "GET /api/productions/{productionId}/props",
  "POST /api/productions/{productionId}/items/{itemId}/props",
  "PUT /api/productions/{productionId}/props/{propId}",
  "DELETE /api/productions/{productionId}/props/{propId}",
  "GET /api/productions/{productionId}/props-notes",
  "PUT /api/productions/{productionId}/items/{itemId}/props-notes",
  "GET /api/productions/{productionId}/items/{itemId}/scenery-files",
  "GET /api/productions/{productionId}/items/{itemId}/scenery-file-link",
  "DELETE /api/productions/{productionId}/items/{itemId}/scenery-files",
  "POST /api/productions/{productionId}/items/{itemId}/scenery-uploads",
  "GET /api/productions/{productionId}/scenery-file-counts",
  "GET /api/productions/{productionId}/scenery-notes",
  "PUT /api/productions/{productionId}/items/{itemId}/scenery-notes",
  "POST /api/productions/{productionId}/casting-grid/export",
  "PUT /api/productions/{productionId}/items/{itemId}/notes",
  "POST /api/productions/{productionId}/items/{itemId}/roles",
  "PUT /api/productions/{productionId}/roles/{roleId}",
  "DELETE /api/productions/{productionId}/roles/{roleId}",
  "POST /api/usage",
  "GET /api/usage",
] as const;

export type RouteKey = (typeof routeKeys)[number];

/** The user pool's admin group (infra/lib/app-stack.ts), named in a token's cognito:groups. */
export const ADMIN_GROUP = "admin";
/** The department groups (ADR 0026): each gives the permission of the same name. */
export const CASTING_GROUP = "casting";
export const STAGE_GROUP = "stage";
export const TECH_GROUP = "tech";
export const WARDROBE_GROUP = "wardrobe";
/** Changes every Production department, but not casting or the show (ADR 0029). */
export const DIRECTOR_GROUP = "director";
/**
 * The retiring group for read-only accounts (ADR 0020). Until a later release deletes it,
 * being in it grants nothing and cancels every other group, so no account is widened before
 * `pnpm account roles` moves it out (ADR 0026).
 */
export const READ_ONLY_GROUP = "read-only";

/** A department's permission, held as the user pool group of the same name (ADR 0026). */
export const permissions = [
  CASTING_GROUP,
  STAGE_GROUP,
  TECH_GROUP,
  WARDROBE_GROUP,
  DIRECTOR_GROUP,
] as const;

export type Permission = (typeof permissions)[number];

/** What a signed-in account may do: everything as an admin, or what its permissions allow. */
export type Access = "admin" | Permission[];

/**
 * A token's groups as access (ADR 0026). Admin is exclusive; otherwise each department group
 * adds its permission, and unknown groups add nothing, so no known group means read-only.
 */
export function accessFrom(groups: readonly string[]): Access {
  if (groups.includes(READ_ONLY_GROUP)) return [];
  if (groups.includes(ADMIN_GROUP)) return "admin";
  return permissions.filter((permission) => groups.includes(permission));
}

/** The API's answer to a change from someone without a department's permission, if it has none of its own. */
const GENERAL_REFUSAL = "You can view this, but not change it.";

/** What each department says when it refuses a change, naming what can only be viewed. */
const departmentRefusals: Partial<Record<Permission, string>> = {
  casting: "You can view the casting, but not change it.",
  stage: "You can view the props, but not change them.",
  tech: "You can view the scenery, but not change it.",
};

/** Permissions any one of which allows a change, the first saying what a refusal names. */
export type AnyOf = readonly [Permission, ...Permission[]];

/** The API's answer to a change that needs a permission the caller hasn't got (ADR 0029). */
export const refusalFor = (needed: Permission | AnyOf) => {
  const [named] = typeof needed === "string" ? [needed] : needed;
  return departmentRefusals[named] ?? GENERAL_REFUSAL;
};

const readOnlyRefusals = new Set<unknown>(permissions.map(refusalFor));

/** Whether a refusal says the change needed a permission, which pages recognise (team-roles FR12). */
export const isRefusalAsReadOnly = (message: unknown) => readOnlyRefusals.has(message);

/**
 * The access pnpm dev and pnpm demo act for, chosen with the local switch (production-props FR9):
 * "admin", or the permissions separated by commas, empty for none. Only the local API reads
 * it; the hosted API takes access from the sign-in alone.
 */
export const LOCAL_ACCESS_HEADER = "x-local-access";

/** The local access header's value for the access chosen. */
export const localAccessHeader = (access: Access) =>
  access === "admin" ? access : access.join(",");

/**
 * The access the local access header asks for: an admin when none is sent, as the local app
 * starts, and read-only for anything it doesn't know, as the hosted API would treat it.
 */
export function localAccessFrom(sent: string | string[] | undefined): Access {
  if (sent === undefined) return "admin";
  if (typeof sent !== "string") return [];
  if (sent === "admin") return "admin";
  const asked = sent === "" ? [] : sent.split(",");
  const known = permissions.filter((permission) => asked.includes(permission));
  return known.length === asked.length ? known : [];
}

/** Whether access allows a change needing any of the permissions: an admin may change everything. */
export const mayChange = (access: Access, needed: Permission | AnyOf) =>
  access === "admin" ||
  (typeof needed === "string" ? [needed] : needed).some((permission) =>
    access.includes(permission),
  );

/**
 * Routes that aren't a GET but change nothing stored. The export only turns the grid the page
 * sends into a file, so every role may use it (ADR 0021). Add one only for the same reason.
 */
const readsSentAsPost = ["POST /api/productions/{productionId}/casting-grid/export"] as const;

/** Reads change nothing stored, so every role may use them: every GET, plus the POSTs above. */
export const isReadRoute = (key: string) =>
  key.startsWith("GET ") || readsSentAsPost.some((read) => read === key);

/**
 * The one change anyone may make: recording their own usage, which only ever adds a record
 * about the caller (ADR 0023). Add another only for the same reason.
 */
const recordsAboutTheCaller = ["POST /api/usage"] as const;

/** What an account with no permissions may use: the reads, and recording their own usage. */
export const readOnlyMayUse = (key: string) =>
  isReadRoute(key) || recordsAboutTheCaller.some((record) => record === key);

type OpenRouteKey =
  | Extract<RouteKey, `GET ${string}`>
  | (typeof readsSentAsPost)[number]
  | (typeof recordsAboutTheCaller)[number];

/** What a route needs: any one of some permissions, or an admin (ADR 0029). */
export type Need = AnyOf | "admin";

/**
 * Every route that isn't open to everyone names what it needs, so a new change route missing
 * from the table fails the typecheck. An open route is listed only if it is admin-only.
 */
export type RouteNeeds = Readonly<
  Record<Exclude<RouteKey, OpenRouteKey>, Need> & Partial<Record<OpenRouteKey, "admin">>
>;

/** Who may change the props and props notes: Stage, or a Director (production-scenery FR2). */
export const PROPS_PERMISSIONS: AnyOf = [STAGE_GROUP, DIRECTOR_GROUP];
/**
 * Who may change scenery: Stage and Tech share it, and a Director may too (production-scenery
 * FR5). Tech first, as a refusal names the first: Tech's line is about the scenery, Stage's
 * the props.
 */
export const SCENERY_PERMISSIONS: AnyOf = [TECH_GROUP, STAGE_GROUP, DIRECTOR_GROUP];
/** Who may change the cast, roles, casting and casting notes: Casting alone, never a Director. */
export const CASTING_PERMISSIONS: AnyOf = [CASTING_GROUP];

/**
 * What each route needs (ADR 0026, ADR 0029). Admin-only routes are permanent or show-wide changes
 * (hosting FR9), and managing the team. The API refuses a route its caller's access doesn't
 * allow before the handler runs, so a new one can't forget it.
 */
export const routeNeeds: RouteNeeds = {
  "GET /api/accounts": "admin",
  "POST /api/accounts": "admin",
  "POST /api/accounts/{username}/password": "admin",
  "PUT /api/accounts/{username}/enabled": "admin",
  "PUT /api/accounts/{username}/access": "admin",
  "POST /api/productions/{productionId}/running-order/versions": "admin",
  "POST /api/productions/{productionId}/cast": CASTING_PERMISSIONS,
  "PUT /api/productions/{productionId}/cast/{castId}": CASTING_PERMISSIONS,
  "DELETE /api/productions/{productionId}/cast/{castId}": "admin",
  "PUT /api/productions/{productionId}/items/{itemId}/notes": CASTING_PERMISSIONS,
  "POST /api/productions/{productionId}/items/{itemId}/roles": CASTING_PERMISSIONS,
  "PUT /api/productions/{productionId}/roles/{roleId}": CASTING_PERMISSIONS,
  "DELETE /api/productions/{productionId}/roles/{roleId}": CASTING_PERMISSIONS,
  "POST /api/productions/{productionId}/items/{itemId}/props": PROPS_PERMISSIONS,
  "PUT /api/productions/{productionId}/props/{propId}": PROPS_PERMISSIONS,
  "DELETE /api/productions/{productionId}/props/{propId}": PROPS_PERMISSIONS,
  "PUT /api/productions/{productionId}/items/{itemId}/props-notes": PROPS_PERMISSIONS,
  "DELETE /api/productions/{productionId}/items/{itemId}/scenery-files": SCENERY_PERMISSIONS,
  "POST /api/productions/{productionId}/items/{itemId}/scenery-uploads": SCENERY_PERMISSIONS,
  "PUT /api/productions/{productionId}/items/{itemId}/scenery-notes": SCENERY_PERMISSIONS,
  // Usage is about the team, so only admins read it (usage-tracking FR4).
  "GET /api/usage": "admin",
};

const needs = new Map<string, Need>(
  Object.entries(routeNeeds).flatMap(([key, need]) => (need ? [[key, need] as const] : [])),
);

/**
 * What a route needs, or undefined if anyone may use it. A route missing from the table needs
 * an admin unless it is open to everyone, so a gap fails safe.
 */
export const needOf = (key: string): Need | undefined =>
  needs.get(key) ?? (readOnlyMayUse(key) ? undefined : "admin");

/** Routes only admins may use. */
export const adminOnlyRouteKeys: readonly RouteKey[] = routeKeys.filter(
  (key) => needOf(key) === "admin",
);

/**
 * Routes that manage the team's accounts. They run in their own function, the only one
 * allowed to change accounts (ADR 0017), so the data routes can't.
 */
export const accountRouteKeys = [
  "GET /api/accounts",
  "POST /api/accounts",
  "POST /api/accounts/{username}/password",
  "PUT /api/accounts/{username}/enabled",
  "PUT /api/accounts/{username}/access",
] as const satisfies readonly RouteKey[];

export type AccountRouteKey = (typeof accountRouteKeys)[number];

const accountRoutes = new Set<string>(accountRouteKeys);

/** Whether a route key, such as one infra hosts, is an account route. */
export const isAccountRoute = (key: string) => accountRoutes.has(key);
