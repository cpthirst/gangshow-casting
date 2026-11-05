import { describe, expect, it } from "vitest";
import {
  AllocateMicRequest,
  channelsHeldBefore,
  channelsKeptAgainstTheRule,
  ItemMicPlot,
  MIC_CHANNELS,
  MicPlotList,
} from "./mic-plot.ts";
import type { RunningOrder } from "./running-order.ts";

// Made-up items and cast member ids: Alex is 1, Sam 2.
const [alex, sam] = [1, 2];
const anItem = (id: string) => ({
  id,
  title: id,
  cast: "",
  stage: [],
  leads: "",
  comments: "",
  minutes: 5,
  printed: true,
});
const show = (first: string[], second: string[]): RunningOrder => ({
  productionId: "2027",
  title: "Gang Show 2027",
  version: 1,
  savedAt: "2026-10-04T00:00:00.000Z",
  startTime: "19:15",
  intervalMinutes: 20,
  halves: [
    { id: "first-half", name: "Act 1", items: first.map(anItem) },
    { id: "second-half", name: "Act 2", items: second.map(anItem) },
  ],
});
const aPlot = (itemId: string, ...pairs: [number, number][]): ItemMicPlot => ({
  itemId,
  mics: pairs.map(([channel, castMemberId]) => ({ channel, castMemberId })),
});

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

  it("refuses a role: a mic's roles come from the casting, never the request", () => {
    expect(AllocateMicRequest.safeParse({ channel: 3, castMemberId: 1, roleId: 4 }).success).toBe(
      false,
    );
  });

  it("knows only Mic 1 to Mic 24", () => {
    expect(MIC_CHANNELS).toBe(24);
    for (const channel of [0, 25, 2.5]) {
      expect(AllocateMicRequest.safeParse({ channel, castMemberId: 1 }).success).toBe(false);
    }
    expect(AllocateMicRequest.safeParse({ channel: 24, castMemberId: 1 }).success).toBe(true);
  });
});

describe("channelsHeldBefore", () => {
  const order = show(["opening", "link", "space"], ["entracte"]);

  it("is who had each channel in the item directly before", () => {
    const plots = [aPlot("opening", [1, alex], [2, sam]), aPlot("space", [3, sam])];

    expect(channelsHeldBefore(order, plots, "link")).toEqual(
      new Map([
        [1, alex],
        [2, sam],
      ]),
    );
  });

  it("looks only at the item directly before, not further back", () => {
    expect(channelsHeldBefore(order, [aPlot("opening", [5, alex])], "space")).toEqual(new Map());
  });

  it("holds nothing for the first item of the show", () => {
    expect(channelsHeldBefore(order, [aPlot("space", [1, alex])], "opening")).toEqual(new Map());
  });

  it("holds nothing for the first item after the interval", () => {
    expect(channelsHeldBefore(order, [aPlot("space", [1, alex])], "entracte")).toEqual(new Map());
  });

  it("holds nothing for an item not in the running order", () => {
    expect(channelsHeldBefore(order, [aPlot("opening", [1, alex])], "gone")).toEqual(new Map());
  });
});

describe("channelsKeptAgainstTheRule", () => {
  const order = show(["opening", "finale"], ["entracte"]);

  it("is each channel given to someone other than who had it in the item before, with who did", () => {
    const plots = [aPlot("opening", [1, alex]), aPlot("finale", [1, sam], [3, alex])];

    expect(channelsKeptAgainstTheRule(order, plots, "finale")).toEqual([
      { channel: 1, castMemberId: sam, heldBy: alex },
    ]);
    expect(channelsKeptAgainstTheRule(order, plots, "opening")).toEqual([]);
  });

  it("doesn't count the cast member who had the channel keeping it", () => {
    const plots = [aPlot("opening", [1, alex]), aPlot("finale", [1, alex])];

    expect(channelsKeptAgainstTheRule(order, plots, "finale")).toEqual([]);
  });

  it("is nothing once the items aren't next to each other in the same half", () => {
    const plots = [aPlot("finale", [1, alex]), aPlot("entracte", [1, sam])];

    expect(channelsKeptAgainstTheRule(order, plots, "entracte")).toEqual([]);
  });
});
