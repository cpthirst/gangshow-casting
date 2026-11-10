import { UpdateCastMemberRequest } from "@app/shared";
import {
  type RemoveOutOfGang,
  removeOutOfGangAfterSave,
} from "#/casting/roles/remove-out-of-gang.ts";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { wholeNumber } from "#/http/params.ts";
import { type CastStore, refusalStatus } from "./cast-store.ts";

// PUT /api/productions/{productionId}/cast/{castId}: replace a cast member's details,
// unless someone else changed them since the revision in the body. The id never changes.
// Someone moved to another gang leaves the roles of items not for it (junior-cast FR12),
// whatever the client asked.
export function createUpdateCastMember(
  store: CastStore,
  removeOutOfGang: RemoveOutOfGang,
): Handler {
  return inProduction(async (productionId, event) => {
    const castId = wholeNumber(event.pathParameters?.castId);
    // Strict: an id or any unknown field in the body is refused.
    const request = UpdateCastMemberRequest.safeParse(parseJson(event.body));
    if (castId === undefined || !request.success) return { statusCode: 400 };

    const { revision, ...details } = request.data;
    const result = await store.update(productionId, castId, revision, details);
    if (typeof result === "string") return { statusCode: refusalStatus[result] };
    await removeOutOfGangAfterSave(removeOutOfGang, productionId, (role) =>
      role.castMemberIds.includes(castId),
    );
    return jsonResponse(200, result);
  });
}
