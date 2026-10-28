import { CastMemberDetails } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { CastStore } from "./cast-store.ts";

// POST /api/productions/{productionId}/cast: add a cast member; the app assigns the id.
export function createAddCastMember(store: CastStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    // Strict: unknown fields (e.g. a date of birth) are refused, not quietly dropped.
    const details = CastMemberDetails.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    const member = await store.add(productionId, details.data);
    if (!member) return { statusCode: 404 };
    return jsonResponse(201, member);
  };
}
