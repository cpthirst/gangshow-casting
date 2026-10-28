import { CastMemberDetails, ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { parseJson } from "#/http/json.ts";
import type { CastStore } from "./cast-store.ts";

// POST /api/productions/{productionId}/cast: add a cast member; the app assigns the id.
export function createAddCastMember(store: CastStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    // Strict: unknown fields (e.g. a date of birth) are refused, not quietly dropped.
    const details = CastMemberDetails.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    const member = await store.add(productionId.data, details.data);
    if (!member) return { statusCode: 404 };
    return {
      statusCode: 201,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(member),
    };
  };
}
