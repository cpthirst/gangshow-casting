import { mayStartProduction, NewProduction, startRefusal } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, messageResponse, parseJson } from "#/http/json.ts";
import type { CastStore } from "#/show/cast/cast-store.ts";
import { firstRunningOrder } from "#/show/running-order/first-running-order.ts";
import type { RunningOrderStore } from "#/show/running-order/running-order-store.ts";
import type { ProductionListStore } from "./production-list-store.ts";

interface StartStores {
  productions: ProductionListStore;
  cast: Pick<CastStore, "start">;
  runningOrders: Pick<RunningOrderStore, "save">;
}

// POST /api/productions: starts a new production, empty, by its year. Only admins (routeNeeds).
export function createStartProduction(
  { productions, cast, runningOrders }: StartStores,
  now = () => new Date(),
) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const request = NewProduction.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };
    const { year } = request.data;

    const { productions: held } = await productions.list();
    if (!mayStartProduction(year, held)) return messageResponse(400, startRefusal(held));

    // The row in the list goes last, so a listed production always has its cast list and first
    // version. Both are safe to write again, so a start that failed part way can be retried:
    // a first version already there is a "conflict", and has no items either.
    await cast.start(year);
    await runningOrders.save(firstRunningOrder(year, now().toISOString()));
    // Two admins starting different years at once both succeed: the higher is the newest.
    if ((await productions.start(year)) === "exists") {
      return messageResponse(400, startRefusal((await productions.list()).productions));
    }
    return jsonResponse(201, await productions.list());
  };
}
