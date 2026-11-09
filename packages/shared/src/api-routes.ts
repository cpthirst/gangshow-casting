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
  "GET /api/productions",
  "POST /api/productions",
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
  "GET /api/productions/{productionId}/items/{itemId}/sfx-files",
  "GET /api/productions/{productionId}/items/{itemId}/sfx-file-link",
  "DELETE /api/productions/{productionId}/items/{itemId}/sfx-files",
  "POST /api/productions/{productionId}/items/{itemId}/sfx-uploads",
  "GET /api/productions/{productionId}/sfx-file-counts",
  "GET /api/productions/{productionId}/sfx-notes",
  "PUT /api/productions/{productionId}/items/{itemId}/sfx-notes",
  "GET /api/productions/{productionId}/items/{itemId}/wardrobe-files",
  "GET /api/productions/{productionId}/items/{itemId}/wardrobe-file-link",
  "DELETE /api/productions/{productionId}/items/{itemId}/wardrobe-files",
  "POST /api/productions/{productionId}/items/{itemId}/wardrobe-uploads",
  "GET /api/productions/{productionId}/wardrobe-file-counts",
  "GET /api/productions/{productionId}/wardrobe-notes",
  "PUT /api/productions/{productionId}/items/{itemId}/wardrobe-notes",
  "GET /api/productions/{productionId}/mic-plot",
  "PUT /api/productions/{productionId}/items/{itemId}/mic-plot",
  "GET /api/productions/{productionId}/mic-plot-notes",
  "PUT /api/productions/{productionId}/items/{itemId}/mic-plot-notes",
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

/** Permissions any one of which allows a change. */
export type AnyOf = readonly [Permission, ...Permission[]];

/** The departments whose data a permission may change, as change routes name them (ADR 0035). */
export const departmentIds = [
  "casting",
  "props",
  "scenery",
  "sfx",
  "mic-plot",
  "wardrobe",
] as const;

export type DepartmentId = (typeof departmentIds)[number];

/** A department: what it's called, who may change it, and how the app and API word it. */
export interface Department {
  /** On its own, as a page title or column heading says it: "Mic plot". */
  name: string;
  /** Mid-sentence, as in "Edit mic plot for Opening Number". */
  noun: string;
  /** What stands for the noun later in a sentence: "it" (the scenery) or "them" (the props). */
  it: "it" | "them";
  /** The article before its name: "a" Scenery page, "an" SFX page. */
  a: "a" | "an";
  /** Any one of these allows a change; their order doesn't matter. */
  permissions: AnyOf;
  /** The refusal's message, naming what can only be viewed. */
  refusal: string;
}

/** A department as one statement: its refusal is worded from its noun (ADR 0035). */
const department = (
  name: string,
  noun: string,
  it: Department["it"],
  a: Department["a"],
  permissions: AnyOf,
): Department => ({
  name,
  noun,
  it,
  a,
  permissions,
  refusal: `You can view the ${noun}, but not change ${it}.`,
});

/**
 * Each department, stated once (ADR 0035). Casting is Casting's alone, never a Director's;
 * Stage and Tech share the scenery (production-scenery FR2, FR5).
 */
export const departments: Readonly<Record<DepartmentId, Department>> = {
  casting: department("Casting", "casting", "it", "a", [CASTING_GROUP]),
  props: department("Props", "props", "them", "a", [STAGE_GROUP, DIRECTOR_GROUP]),
  scenery: department("Scenery", "scenery", "it", "a", [STAGE_GROUP, TECH_GROUP, DIRECTOR_GROUP]),
  sfx: department("SFX", "SFX", "them", "an", [TECH_GROUP, DIRECTOR_GROUP]),
  "mic-plot": department("Mic plot", "mic plot", "it", "a", [TECH_GROUP, DIRECTOR_GROUP]),
  wardrobe: department("Wardrobe", "wardrobe", "it", "a", [WARDROBE_GROUP, DIRECTOR_GROUP]),
};

/** A refused change to a department: its line, and which department, so pages needn't read the line. */
export interface ReadOnlyRefusal {
  message: string;
  department: DepartmentId;
}

/** The API's answer to a change to a department from someone without its permission (ADR 0035). */
export const readOnlyRefusal = (department: DepartmentId): ReadOnlyRefusal => ({
  message: departments[department].refusal,
  department,
});

const isDepartmentId = (value: unknown): value is DepartmentId =>
  departmentIds.some((id) => id === value);

/**
 * Whether a refusal's body says the change needed a department's permission, which pages
 * recognise (team-roles FR12) by the department it names, never by its wording.
 */
export const isRefusalAsReadOnly = (body: unknown) =>
  typeof body === "object" &&
  body !== null &&
  "department" in body &&
  isDepartmentId(body.department);

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

/** Whether access allows changing a department's data: any one of its permissions will do. */
export const mayChangeDepartment = (access: Access, id: DepartmentId) =>
  mayChange(access, departments[id].permissions);

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

/** What a route needs: a permission that may change its department, or an admin (ADR 0035). */
export type Need = DepartmentId | "admin";

/**
 * Every route that isn't open to everyone names what it needs, so a new change route missing
 * from the table fails the typecheck. An open route is listed only if it is admin-only.
 */
export type RouteNeeds = Readonly<
  Record<Exclude<RouteKey, OpenRouteKey>, Need> & Partial<Record<OpenRouteKey, "admin">>
>;

/**
 * What each route needs: an admin, or a permission that may change its department (ADR 0026,
 * ADR 0029, ADR 0035). Admin-only routes are permanent or show-wide changes
 * (hosting FR9), and managing the team. The API refuses a route its caller's access doesn't
 * allow before the handler runs, so a new one can't forget it.
 */
export const routeNeeds: RouteNeeds = {
  "GET /api/accounts": "admin",
  "POST /api/accounts": "admin",
  "POST /api/accounts/{username}/password": "admin",
  "PUT /api/accounts/{username}/enabled": "admin",
  "PUT /api/accounts/{username}/access": "admin",
  "POST /api/productions": "admin",
  "POST /api/productions/{productionId}/running-order/versions": "admin",
  "POST /api/productions/{productionId}/cast": "casting",
  "PUT /api/productions/{productionId}/cast/{castId}": "casting",
  "DELETE /api/productions/{productionId}/cast/{castId}": "admin",
  "PUT /api/productions/{productionId}/items/{itemId}/notes": "casting",
  "POST /api/productions/{productionId}/items/{itemId}/roles": "casting",
  "PUT /api/productions/{productionId}/roles/{roleId}": "casting",
  "DELETE /api/productions/{productionId}/roles/{roleId}": "casting",
  "POST /api/productions/{productionId}/items/{itemId}/props": "props",
  "PUT /api/productions/{productionId}/props/{propId}": "props",
  "DELETE /api/productions/{productionId}/props/{propId}": "props",
  "PUT /api/productions/{productionId}/items/{itemId}/props-notes": "props",
  "DELETE /api/productions/{productionId}/items/{itemId}/scenery-files": "scenery",
  "POST /api/productions/{productionId}/items/{itemId}/scenery-uploads": "scenery",
  "PUT /api/productions/{productionId}/items/{itemId}/scenery-notes": "scenery",
  "DELETE /api/productions/{productionId}/items/{itemId}/sfx-files": "sfx",
  "POST /api/productions/{productionId}/items/{itemId}/sfx-uploads": "sfx",
  "PUT /api/productions/{productionId}/items/{itemId}/sfx-notes": "sfx",
  "DELETE /api/productions/{productionId}/items/{itemId}/wardrobe-files": "wardrobe",
  "POST /api/productions/{productionId}/items/{itemId}/wardrobe-uploads": "wardrobe",
  "PUT /api/productions/{productionId}/items/{itemId}/wardrobe-notes": "wardrobe",
  "PUT /api/productions/{productionId}/items/{itemId}/mic-plot": "mic-plot",
  "PUT /api/productions/{productionId}/items/{itemId}/mic-plot-notes": "mic-plot",
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
