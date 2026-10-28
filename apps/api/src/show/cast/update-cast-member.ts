import { ProductionId, UpdateCastMemberRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { parseJson } from "#/http/json.ts";
import { refusalStatus, wholeNumber } from "#/http/params.ts";
import type { CastStore } from "./cast-store.ts";

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
    if (typeof result === "string") return { statusCode: refusalStatus[result] };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    };
  };
}
