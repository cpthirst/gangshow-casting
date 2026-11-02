import { describe, expect, it } from "vitest";
import { AllocateMicRequest, ItemMicPlot, MIC_CHANNELS, MicPlotList } from "./mic-plot.ts";

describe("ItemMicPlot", () => {
  it("is an item's channels, each given to one cast member", () => {
    const plot = {
      itemId: "opening-number",
      mics: [
        { channel: 3, castMemberId: 1 },
        { channel: 5, castMemberId: 2 },
      ],
    };
    expect(ItemMicPlot.parse(plot)).toEqual(plot);
  });

  it("refuses a channel given twice, or a cast member on two channels", () => {
    const mics = (...pairs: [number, number][]) => ({
      itemId: "opening-number",
      mics: pairs.map(([channel, castMemberId]) => ({ channel, castMemberId })),
    });
    expect(ItemMicPlot.safeParse(mics([3, 1], [3, 2])).success).toBe(false);
    expect(ItemMicPlot.safeParse(mics([3, 1], [4, 1])).success).toBe(false);
  });
});

describe("MicPlotList", () => {
  it("is a production's mic plots, item by item", () => {
    expect(MicPlotList.parse({ productionId: "2027", items: [] })).toEqual({
      productionId: "2027",
      items: [],
    });
  });
});

describe("AllocateMicRequest", () => {
  it("gives a channel to a cast member, or clears it with null", () => {
    expect(AllocateMicRequest.parse({ channel: 3, castMemberId: 1 })).toEqual({
      channel: 3,
      castMemberId: 1,
    });
    expect(AllocateMicRequest.parse({ channel: 3, castMemberId: null }).castMemberId).toBeNull();
  });

  it("knows only Mic 1 to Mic 24", () => {
    expect(MIC_CHANNELS).toBe(24);
    for (const channel of [0, 25, 2.5]) {
      expect(AllocateMicRequest.safeParse({ channel, castMemberId: 1 }).success).toBe(false);
    }
    expect(AllocateMicRequest.safeParse({ channel: 24, castMemberId: 1 }).success).toBe(true);
  });
});
