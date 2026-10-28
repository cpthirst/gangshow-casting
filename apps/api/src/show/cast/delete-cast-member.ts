import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { RoleStore } from "#/casting/roles/role-store.ts";
import type { ApiEvent } from "#/http/handler.ts";
import { productionIdOf, wholeNumber } from "#/http/params.ts";
import { carriersFollowCasting } from "#/production/props/prop-links.ts";
import type { PropStore } from "#/production/props/prop-store.ts";
import { refusalStatus } from "./cast-store.ts";
import type { RemoveCastMember } from "./remove-cast-member.ts";

// DELETE /api/productions/{productionId}/cast/{castId}?revision=N: remove a cast member
// for good, unless someone else changed them since revision N, taking them out of every
// role and every prop they carried too (casting-roles FR9, production-props FR28, ADR 0010).
export function createDeleteCastMember(
  removeCastMember: RemoveCastMember,
  roles: RoleStore,
  props: PropStore,
) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    const castId = wholeNumber(event.pathParameters?.castId);
    const revision = wholeNumber(event.queryStringParameters?.revision);
    if (castId === undefined || revision === undefined) return { statusCode: 400 };

    const result = await removeCastMember(productionId, castId, revision);
    if (result !== "removed") return { statusCode: refusalStatus[result] };
    // Uncast from every role by now, so they carry nothing.
    await carriersFollowCasting(props, roles, productionId);
    return { statusCode: 204 };
  };
}
