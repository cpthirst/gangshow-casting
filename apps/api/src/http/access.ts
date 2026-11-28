import {
  type Access,
  isChangeWithinProduction,
  mayChangeDepartment,
  mayChangeProduction,
  mayChangeStore,
  needOf,
  pastProductionRefusal,
  readOnlyRefusal,
  storeOf,
} from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ProductionListStore } from "#/production-list/production-list-store.ts";
import { jsonResponse, messageResponse } from "./json.ts";

/**
 * The groups in a token's cognito:groups claim. API Gateway's JWT authorizer passes a list
 * on as one string, such as "[crew admin]". Group names can hold punctuation but not spaces,
 * so only spaces separate them. Anything unexpected means no groups.
 */
export function groupsFrom(claim: unknown): string[] {
  if (typeof claim !== "string") return [];
  return claim
    .replace(/^\[|\]$/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/** Which productions there are, which the past-production rule asks about each change. */
export type Productions = Pick<ProductionListStore, "list">;

/**
 * For a function with no routes within a production, the accounts function. Being asked is a
 * mistake, so it fails closed: the change goes no further.
 */
export const noProductions: Productions = {
  list: () => Promise.reject(new Error("This function has no routes within a production")),
};

/** The route being asked for, as matchRoute found it. */
interface AskedRoute {
  key: string;
  event: { pathParameters: Record<string, string> };
}

/**
 * A 403 if the route can't go ahead for this caller; undefined to go ahead. A production that
 * isn't the newest comes first, as it's closed to everyone, admins included (simplify FR21).
 * Then the caller's access (ADR 0026): each change route names its department, any one of
 * whose permissions allows it, or a store and its own permissions (ADR 0043), and a refusal
 * says which department (ADR 0035). A route missing from the table needs an admin, and the
 * reads and recording usage nothing.
 */
export async function accessRefusal(
  route: AskedRoute,
  access: Access,
  productions: Productions,
): Promise<APIGatewayProxyStructuredResultV2 | undefined> {
  return (await pastProductionRefused(route, productions)) ?? departmentRefusal(route, access);
}

async function pastProductionRefused({ key, event }: AskedRoute, productions: Productions) {
  if (!isChangeWithinProduction(key)) return undefined;
  const { productions: held } = await productions.list();
  return mayChangeProduction(event.pathParameters.productionId ?? "", held)
    ? undefined
    : jsonResponse(403, pastProductionRefusal(held));
}

const onlyAdmins = () => messageResponse(403, "Only admins can do this.");

function departmentRefusal({ key, event }: AskedRoute, access: Access) {
  if (access === "admin") return undefined;
  const need = needOf(key);
  if (need === undefined) return undefined;
  if (need === "admin") return onlyAdmins();
  if (need === "store") return storeRefusal(event.pathParameters.storeId, access);
  return mayChangeDepartment(access, need) ? undefined : jsonResponse(403, readOnlyRefusal(need));
}

// A store's change needs that store's own permissions, refused in its department's words
// (stores FR4, FR5). One the list doesn't hold is left to admins, so a gap fails safe.
function storeRefusal(storeId: string | undefined, access: Access) {
  const store = storeOf(storeId);
  if (store === undefined) return onlyAdmins();
  return mayChangeStore(access, store) ? undefined : jsonResponse(403, readOnlyRefusal(store));
}
