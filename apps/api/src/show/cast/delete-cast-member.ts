import type { RoleStore } from "#/casting/roles/role-store.ts";
import { type Handler, inProduction } from "#/http/handler.ts";
import { wholeNumber } from "#/http/params.ts";
import { type CastingFollowers, productionFollowsCasting } from "#/production/follow-casting.ts";
import { refusalStatus } from "./cast-store.ts";
import type { RemoveCastMember } from "./remove-cast-member.ts";

// DELETE /api/productions/{productionId}/cast/{castId}?revision=N: remove a cast member
// for good, unless someone else changed them since revision N, taking them out of every
// role, every prop they carried and every mic they had, and deleting their costumes, too
// (casting-roles FR9, production-props FR28, production-mics FR9, production-costume-sheets
// FR8, ADR 0010).
export function createDeleteCastMember(
  removeCastMember: RemoveCastMember,
  roles: RoleStore,
  followers: CastingFollowers,
): Handler {
  return inProduction(async (productionId, event) => {
    const castId = wholeNumber(event.pathParameters?.castId);
    const revision = wholeNumber(event.queryStringParameters?.revision);
    if (castId === undefined || revision === undefined) return { statusCode: 400 };

    const result = await removeCastMember(productionId, castId, revision);
    if (result !== "removed") return { statusCode: refusalStatus[result] };
    // Uncast from every role by now, so they carry nothing and have no mic.
    await productionFollowsCasting(followers, roles, productionId);
    return { statusCode: 204 };
  });
}
