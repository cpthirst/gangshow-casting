import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { CastStore } from "./cast-store.ts";
import type { ApiEvent } from "./handler.ts";
import { refusalStatus, wholeNumber } from "./params.ts";
import type { RoleStore } from "./role-store.ts";

// DELETE /api/productions/{productionId}/cast/{castId}?revision=N: remove a cast member
// for good, unless someone else changed them since revision N, taking them out of every
// role too (casting-roles FR9, ADR 0010).
export function createDeleteCastMember(store: CastStore, roles: RoleStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    const castId = wholeNumber(event.pathParameters?.castId);
    const revision = wholeNumber(event.queryStringParameters?.revision);
    if (castId === undefined || revision === undefined) return { statusCode: 400 };

    // Refuse a stale or unknown delete before touching the roles. store.remove re-checks
    // and has the final say.
    const member = (await store.list(productionId.data))?.members.find((m) => m.id === castId);
    if (!member) return { statusCode: 404 };
    if (member.revision !== revision) return { statusCode: 409 };

    // Roles first, so a failure never leaves roles pointing at nobody: if this throws, the
    // member isn't deleted at all. If someone changes the member before the delete below,
    // they end up uncast but still listed, which is safe to retry.
    await roles.uncastMember(productionId.data, castId);
    const result = await store.remove(productionId.data, castId, revision);
    if (result !== "removed") return { statusCode: refusalStatus[result] };
    // Again, in case they were cast in a role while this ran: no trace is left (ADR 0010).
    // It writes nothing when there's nothing to clear.
    await roles.uncastMember(productionId.data, castId);
    return { statusCode: 204 };
  };
}
