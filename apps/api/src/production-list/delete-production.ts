import { mayDeleteProduction, NEWEST_PRODUCTION_REFUSAL } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, messageResponse } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { ItemFileStores } from "#/production/item-files/item-file-store.ts";
import type { ProductionListStore } from "./production-list-store.ts";

// DELETE /api/productions/{productionId}: deletes a past production for good, in the order
// ADR 0037 sets. Every step can be repeated, so a stop at any point, a timeout included, is
// finished by asking again. Only admins (routeNeeds).
export function createDeleteProduction(
  { productions }: { productions: ProductionListStore },
  files: ItemFileStores,
) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const year = productionIdOf(event);
    const { productions: open, deleting = [] } = await productions.list();
    if (year === undefined || ![...open, ...deleting].includes(year)) return { statusCode: 404 };
    if (!mayDeleteProduction(year, open)) {
      return messageResponse(400, NEWEST_PRODUCTION_REFUSAL);
    }

    await productions.markDeleting(year);
    // Keeping no items is every file, a department at a time, as far as the API may reach.
    for (const store of Object.values(files)) await store.keepOnlyItems(year, []);
    await productions.eraseData(year);
    await productions.remove(year);
    return jsonResponse(200, await productions.list());
  };
}
