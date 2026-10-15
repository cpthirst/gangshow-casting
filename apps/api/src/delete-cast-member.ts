import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { CastStore, Refusal } from "./cast-store.ts";
import type { ApiEvent } from "./handler.ts";
import { wholeNumber } from "./params.ts";

const statusFor: Record<"removed" | Refusal, number> = {
  removed: 204,
  stale: 409,
  "not-found": 404,
};

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
