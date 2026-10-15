import { ProductionId, UpdateCastMemberRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { CastStore } from "./cast-store.ts";
import type { ApiEvent } from "./handler.ts";
import { parseJson } from "./json.ts";
import { wholeNumber } from "./params.ts";

const refusedWith = { stale: 409, "not-found": 404 };

// PUT /api/productions/{productionId}/cast/{castId}: replace a cast member's details,
// unless someone else changed them since the revision in the body. The id never changes.
export function createUpdateCastMember(store: CastStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    const castId = wholeNumber(event.pathParameters?.castId);
    // Strict: an id or any unknown field in the body is refused.
    const request = UpdateCastMemberRequest.safeParse(parseJson(event.body));
    if (castId === undefined || !request.success) return { statusCode: 400 };

    const { revision, ...details } = request.data;
    const result = await store.update(productionId.data, castId, revision, details);
    if (typeof result === "string") return { statusCode: refusedWith[result] };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    };
  };
}
