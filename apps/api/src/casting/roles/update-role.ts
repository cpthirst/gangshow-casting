import { type AddRoleRefusal, gangOfItem, UpdateRoleRequest } from "@app/shared";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { wholeNumber } from "#/http/params.ts";
import { type CastingFollowers, productionFollowsCasting } from "#/production/follow-casting.ts";
import type { CastStore } from "#/show/cast/cast-store.ts";
import type { RunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { castingRefusal } from "./castable.ts";
import type { RoleStore } from "./role-store.ts";

// PUT /api/productions/{productionId}/roles/{roleId}: replace a role's name, size and cast,
// unless someone else changed it since the revision in the body (casting-roles FR4, FR8).
// Anyone taken out of it stops carrying its props (production-props FR28), and loses their
// mic in the item if they're in none of its roles now (production-mics FR9). Anyone newly cast
// must be in the item's gang; anyone already in the role stays (junior-cast FR11).
export function createUpdateRole(
  roles: RoleStore,
  runningOrders: RunningOrderStore,
  cast: CastStore,
  followers: CastingFollowers,
): Handler {
  return inProduction(async (productionId, event) => {
    const roleId = wholeNumber(event.pathParameters?.roleId);
    if (roleId === undefined) return { statusCode: 404 };
    // Strict: an id or any unknown field in the body is refused.
    const request = UpdateRoleRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    const { revision, ...details } = request.data;
    const current = (await roles.list(productionId)).roles.find((role) => role.id === roleId);
    const added = details.castMemberIds.filter((id) => !current?.castMemberIds.includes(id));
    const gang = current
      ? gangOfItem(await runningOrders.latest(productionId), current.itemId)
      : "both";
    const refusal = await castingRefusal(cast, productionId, added, gang);
    if (refusal) return refusal;
    const result = await roles.update(productionId, roleId, revision, details);
    if (result === "name-taken") {
      return jsonResponse(400, { error: "name-taken" } satisfies AddRoleRefusal);
    }
    if (result === "stale") return { statusCode: 409 };
    if (result === "not-found") return { statusCode: 404 };
    await productionFollowsCasting(followers, roles, productionId);
    return jsonResponse(200, result);
  });
}
