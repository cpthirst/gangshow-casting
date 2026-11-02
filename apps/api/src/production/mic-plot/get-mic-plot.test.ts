import { MicPlotList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createGetMicPlot } from "./get-mic-plot.ts";
import { inMemoryMicPlotStore } from "./mic-plot-store.ts";

const request = (productionId: string) => ({ pathParameters: { productionId } });

describe("get mic plot handler", () => {
  it("returns every item's channels given out", async () => {
    const saved = {
      productionId: "2027",
      items: [{ itemId: "itm_finale", mics: [{ channel: 3, castMemberId: 1 }] }],
    };
    const handler = createGetMicPlot(inMemoryMicPlotStore([saved]));

    const res = await handler(request("2027"));

    expect(res.statusCode).toBe(200);
    expect(MicPlotList.parse(JSON.parse(res.body ?? ""))).toEqual(saved);
  });

  it("answers 404 for a production id that isn't valid", async () => {
    const handler = createGetMicPlot(inMemoryMicPlotStore());

    expect((await handler(request("../x"))).statusCode).toBe(404);
  });
});
