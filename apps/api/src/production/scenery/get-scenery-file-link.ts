import { SceneryFileName } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { folderIdOf, productionIdOf } from "#/http/params.ts";
import type { SceneryFileStore } from "./scenery-file-store.ts";

// GET /api/productions/{productionId}/items/{itemId}/scenery-file-link?name=…: a short-lived
// link that opens or downloads one of the item's files (production-scenery FR10). Open to every
// signed-in role. 404 if the file isn't there any more, so the page can say so.
export function createGetSceneryFileLink(store: SceneryFileStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const itemId = folderIdOf(event.pathParameters?.itemId);
    if (productionId === undefined || itemId === undefined) return { statusCode: 404 };
    const name = SceneryFileName.safeParse(event.queryStringParameters?.name);
    if (!name.success) return { statusCode: 400 };
    const url = await store.linkTo(productionId, itemId, name.data);
    if (url === undefined) return { statusCode: 404 };
    // Anyone holding the link can use it for a while, so nothing on the way may keep it.
    const res = jsonResponse(200, { url });
    return { ...res, headers: { ...res.headers, "cache-control": "no-store" } };
  };
}
