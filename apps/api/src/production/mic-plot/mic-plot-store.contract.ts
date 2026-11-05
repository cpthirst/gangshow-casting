import type { MicPlotList, Role } from "@app/shared";
import { expect, it } from "vitest";
import type { MicPlotStore } from "./mic-plot-store.ts";

const aRole = (id: number, itemId: string, castMemberIds: number[]): Role => ({
  id,
  itemId,
  name: `Role ${id}`,
  size: "ensemble",
  castMemberIds,
  revision: 1,
});

const sorted = (list: MicPlotList) =>
  [...list.items].sort((a, b) => a.itemId.localeCompare(b.itemId));

/** The rules every mic plot store keeps, run against each implementation. `make` gives a
 *  store already holding the mic plots given. */
export function behavesAsAMicPlotStore(make: (saved: MicPlotList[]) => Promise<MicPlotStore>) {
  it("has no mics given out in a production nobody has given any", async () => {
    expect(await (await make([])).list("2027")).toEqual({ productionId: "2027", items: [] });
  });

  it("gives a channel to a cast member, answering with the item's mic plot", async () => {
    const store = await make([]);

    const plot = await store.allocate("2027", "opening-number", 3, 1);

    expect(plot).toEqual({ itemId: "opening-number", mics: [{ channel: 3, castMemberId: 1 }] });
    expect((await store.list("2027")).items).toEqual([plot]);
  });

  it("lists an item's channels in channel order", async () => {
    const store = await make([]);

    await store.allocate("2027", "opening-number", 7, 2);
    await store.allocate("2027", "opening-number", 3, 1);

    expect((await store.list("2027")).items[0]?.mics.map((mic) => mic.channel)).toEqual([3, 7]);
  });

  it("gives a channel someone else had to the new cast member", async () => {
    const store = await make([
      {
        productionId: "2027",
        items: [{ itemId: "finale", mics: [{ channel: 3, castMemberId: 1 }] }],
      },
    ]);

    expect(await store.allocate("2027", "finale", 3, 2)).toEqual({
      itemId: "finale",
      mics: [{ channel: 3, castMemberId: 2 }],
    });
  });

  it("frees a channel, leaving the item's others", async () => {
    const store = await make([
      {
        productionId: "2027",
        items: [
          {
            itemId: "finale",
            mics: [
              { channel: 3, castMemberId: 1 },
              { channel: 5, castMemberId: 2 },
            ],
          },
        ],
      },
    ]);

    await store.allocate("2027", "finale", 3, null);

    expect((await store.list("2027")).items).toEqual([
      { itemId: "finale", mics: [{ channel: 5, castMemberId: 2 }] },
    ]);
  });

  it("leaves out an item once all its channels are free", async () => {
    const store = await make([]);
    await store.allocate("2027", "finale", 3, 1);

    expect(await store.allocate("2027", "finale", 3, null)).toEqual({ itemId: "finale", mics: [] });
    expect((await store.list("2027")).items).toEqual([]);
  });

  it("refuses to put a cast member on a second channel in the item, changing nothing", async () => {
    const onMic3 = { itemId: "finale", mics: [{ channel: 3, castMemberId: 1 }] };
    const store = await make([{ productionId: "2027", items: [onMic3] }]);

    expect(await store.allocate("2027", "finale", 4, 1)).toEqual({ onAnotherChannel: onMic3 });
    expect((await store.list("2027")).items).toEqual([onMic3]);
  });

  it("lets a cast member keep their own channel when it's given to them again", async () => {
    const onMic3 = { itemId: "finale", mics: [{ channel: 3, castMemberId: 1 }] };
    const store = await make([{ productionId: "2027", items: [onMic3] }]);

    expect(await store.allocate("2027", "finale", 3, 1)).toEqual(onMic3);
  });

  it("lets the same cast member have a channel in each of several items", async () => {
    const store = await make([]);

    await store.allocate("2027", "opening-number", 3, 1);
    await store.allocate("2027", "finale", 4, 1);

    expect(sorted(await store.list("2027"))).toEqual([
      { itemId: "finale", mics: [{ channel: 4, castMemberId: 1 }] },
      { itemId: "opening-number", mics: [{ channel: 3, castMemberId: 1 }] },
    ]);
  });

  it("keeps each production's mic plot apart", async () => {
    const store = await make([]);

    await store.allocate("2027", "finale", 3, 1);

    expect((await store.list("2028")).items).toEqual([]);
  });

  it("frees each channel held by someone no longer cast in its item, leaving the rest", async () => {
    // Made-up cast: Alex (1) is on Mic 3 in both items but now only in the Finale; Sam (2)
    // is still in the Space Sketch.
    const store = await make([
      {
        productionId: "2027",
        items: [
          {
            itemId: "space-sketch",
            mics: [
              { channel: 3, castMemberId: 1 },
              { channel: 5, castMemberId: 2 },
            ],
          },
          { itemId: "finale", mics: [{ channel: 3, castMemberId: 1 }] },
        ],
      },
    ]);

    await store.freeUncastChannels("2027", [
      aRole(1, "space-sketch", [2]),
      aRole(2, "finale", [1, 2]),
    ]);

    expect(sorted(await store.list("2027"))).toEqual([
      { itemId: "finale", mics: [{ channel: 3, castMemberId: 1 }] },
      { itemId: "space-sketch", mics: [{ channel: 5, castMemberId: 2 }] },
    ]);
  });

  it("leaves out an item once casting has freed all its channels", async () => {
    const store = await make([
      {
        productionId: "2027",
        items: [{ itemId: "finale", mics: [{ channel: 3, castMemberId: 1 }] }],
      },
    ]);

    await store.freeUncastChannels("2027", []);

    expect((await store.list("2027")).items).toEqual([]);
  });

  it("frees uncast channels in that production only", async () => {
    const finale = { itemId: "finale", mics: [{ channel: 3, castMemberId: 1 }] };
    const store = await make([
      { productionId: "2027", items: [finale] },
      { productionId: "2028", items: [finale] },
    ]);

    await store.freeUncastChannels("2027", []);

    expect((await store.list("2028")).items).toEqual([finale]);
  });

  it("deletes the mic plot of every item not kept, in that production only", async () => {
    const plot = (itemId: string) => ({ itemId, mics: [{ channel: 1, castMemberId: 1 }] });
    const store = await make([
      { productionId: "2027", items: [plot("old-sketch"), plot("finale")] },
      { productionId: "2028", items: [plot("old-sketch")] },
    ]);

    await store.keepOnlyItems("2027", ["finale", "opening-number"]);

    expect((await store.list("2027")).items).toEqual([plot("finale")]);
    expect((await store.list("2028")).items).toEqual([plot("old-sketch")]);
  });
}
