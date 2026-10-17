import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import { refusalStatus, wholeNumber } from "./params.ts";
import type { RemoveCastMember } from "./remove-cast-member.ts";

// DELETE /api/productions/{productionId}/cast/{castId}?revision=N: remove a cast member
// for good, unless someone else changed them since revision N, taking them out of every
// role too (casting-roles FR9, ADR 0010).
export function createDeleteCastMember(removeCastMember: RemoveCastMember) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    const castId = wholeNumber(event.pathParameters?.castId);
    const revision = wholeNumber(event.queryStringParameters?.revision);
    if (castId === undefined || revision === undefined) return { statusCode: 400 };

    const result = await removeCastMember(productionId.data, castId, revision);
    return result === "removed" ? { statusCode: 204 } : { statusCode: refusalStatus[result] };
  };
}
