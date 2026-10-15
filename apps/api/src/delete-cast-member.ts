import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { CastStore, RemoveResult } from "./cast-store.ts";
import type { ApiEvent } from "./handler.ts";

const statusFor: Record<RemoveResult, number> = { removed: 204, stale: 409, "not-found": 404 };

// Ids and revisions are positive whole numbers; anything else is a bad request.
const wholeNumber = (text: string | undefined) =>
  text !== undefined && /^[1-9]\d{0,8}$/.test(text) ? Number(text) : undefined;

// DELETE /api/productions/{productionId}/cast/{castId}?revision=N: remove a cast member
// for good, unless someone else changed them since revision N.
export function createDeleteCastMember(store: CastStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    const castId = wholeNumber(event.pathParameters?.castId);
    const revision = wholeNumber(event.queryStringParameters?.revision);
    if (castId === undefined || revision === undefined) return { statusCode: 400 };

    const result = await store.remove(productionId.data, castId, revision);
    return { statusCode: statusFor[result] };
  };
}
