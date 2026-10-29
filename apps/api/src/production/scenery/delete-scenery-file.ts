import { SceneryFileName } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { folderIdOf, productionIdOf } from "#/http/params.ts";
import type { SceneryFileStore } from "./scenery-file-store.ts";

// DELETE /api/productions/{productionId}/items/{itemId}/scenery-files?name=…: delete one of the
// item's files for good (production-scenery FR11). Only Stage, Tech, Director or an admin get
// here (routeNeeds in @app/shared). 404 if it's already gone, so the page can say so.
export function createDeleteSceneryFile(store: SceneryFileStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const itemId = folderIdOf(event.pathParameters?.itemId);
    if (productionId === undefined || itemId === undefined) return { statusCode: 404 };
    // A valid name can't reach outside the item's folder.
    const name = SceneryFileName.safeParse(event.queryStringParameters?.name);
    if (!name.success) return { statusCode: 400 };
    const result = await store.remove(productionId, itemId, name.data);
    return { statusCode: result === "removed" ? 204 : 404 };
  };
}
