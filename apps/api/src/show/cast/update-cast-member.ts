import { UpdateCastMemberRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { productionIdOf, wholeNumber } from "#/http/params.ts";
import { type CastStore, refusalStatus } from "./cast-store.ts";

// PUT /api/productions/{productionId}/cast/{castId}: replace a cast member's details,
// unless someone else changed them since the revision in the body. The id never changes.
export function createUpdateCastMember(store: CastStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    const castId = wholeNumber(event.pathParameters?.castId);
    // Strict: an id or any unknown field in the body is refused.
    const request = UpdateCastMemberRequest.safeParse(parseJson(event.body));
    if (castId === undefined || !request.success) return { statusCode: 400 };

    const { revision, ...details } = request.data;
    const result = await store.update(productionId, castId, revision, details);
    if (typeof result === "string") return { statusCode: refusalStatus[result] };
    return jsonResponse(200, result);
  };
}
