import { SceneryUploadRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { folderIdOf, productionIdOf } from "#/http/params.ts";
import type { RunningOrderStore } from "#/show/running-order/running-order-store.ts";
import type { SceneryFileStore } from "./scenery-file-store.ts";

// POST /api/productions/{productionId}/items/{itemId}/scenery-uploads: where the browser may
// send one file, straight to file storage, which refuses it over 100 MB (production-scenery
// FR8, ADR 0030). The file never passes through here. Only Stage, Tech, Director or an admin
// get here (routeNeeds in @app/shared). 409 for a name the item already has, unless the
// request says it replaces it (FR9).
export function createUploadSceneryFile(store: SceneryFileStore, runningOrders: RunningOrderStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const itemId = folderIdOf(event.pathParameters?.itemId);
    if (productionId === undefined || itemId === undefined) return { statusCode: 404 };
    // A valid name can't reach outside the item's folder.
    const request = SceneryUploadRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    // Only items in the latest saved running order can have files.
    const order = await runningOrders.latest(productionId);
    const inShow = order?.halves.some((half) => half.items.some((item) => item.id === itemId));
    if (!inShow) return { statusCode: 404 };

    const { name, replace = false } = request.data;
    const upload = await store.uploadTo(productionId, itemId, name, { replace });
    if (upload === "taken") return { statusCode: 409 };
    return jsonResponse(200, upload);
  };
}
