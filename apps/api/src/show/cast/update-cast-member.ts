import { UpdateCastMemberRequest } from "@app/shared";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { wholeNumber } from "#/http/params.ts";
import { type CastStore, refusalStatus } from "./cast-store.ts";

// PUT /api/productions/{productionId}/cast/{castId}: replace a cast member's details,
// unless someone else changed them since the revision in the body. The id never changes.
export function createUpdateCastMember(store: CastStore): Handler {
  return inProduction(async (productionId, event) => {
    const castId = wholeNumber(event.pathParameters?.castId);
    // Strict: an id or any unknown field in the body is refused.
    const request = UpdateCastMemberRequest.safeParse(parseJson(event.body));
    if (castId === undefined || !request.success) return { statusCode: 400 };

    const { revision, ...details } = request.data;
    const result = await store.update(productionId, castId, revision, details);
    if (typeof result === "string") return { statusCode: refusalStatus[result] };
    return jsonResponse(200, result);
  });
}
