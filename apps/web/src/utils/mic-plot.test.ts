import type { CastMember, Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { castInItem, channelsOf, choicesFor } from "./mic-plot.ts";

// Made-up cast: Alex Morgan and Sam Patel are in Opening Number; Jo Reed only in the Finale.
const aMember = (id: number, firstName: string, lastName: string): CastMember => ({
  id,
  firstName,
  lastName,
  section: "scouts",
  group: "",
  revision: 1,
});
const alex = aMember(1, "Alex", "Morgan");
const sam = aMember(2, "Sam", "Patel");
const jo = aMember(3, "Jo", "Reed");
const aRole = (id: number, itemId: string, castMemberIds: number[]): Role => ({
  id,
  itemId,
  name: `Role ${id}`,
  size: "ensemble",
  castMemberIds,
  revision: 1,
});

describe("channelsOf", () => {
  it("lists Mic 1 to Mic 24 in order, with who is on each", () => {
    const channels = channelsOf({
      itemId: "opening-number",
      mics: [{ channel: 3, castMemberId: 1 }],
    });

    expect(channels).toHaveLength(24);
    expect(channels.map((c) => c.channel)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(channels[2]).toEqual({ channel: 3, castMemberId: 1 });
    expect(channels[3]).toEqual({ channel: 4, castMemberId: null });
  });

  it("lists every channel free for an item with no mics given out", () => {
    expect(channelsOf(undefined).every((c) => c.castMemberId === null)).toBe(true);
  });
});

describe("castInItem", () => {
  it("is everyone cast in one of the item's roles, once each, by surname", () => {
    const roles = [
      aRole(1, "opening-number", [sam.id, alex.id]),
      aRole(2, "opening-number", [alex.id]),
    ];

    expect(
      castInItem("opening-number", [...roles, aRole(3, "finale", [jo.id])], [jo, sam, alex]),
    ).toEqual([alex, sam]);
  });
});

describe("choicesFor", () => {
  const plot = { itemId: "opening-number", mics: [{ channel: 3, castMemberId: alex.id }] };

  it("leaves out whoever is on another of the item's channels", () => {
    expect(choicesFor(4, [alex, sam], plot)).toEqual([sam]);
  });

  it("keeps whoever is on this channel", () => {
    expect(choicesFor(3, [alex, sam], plot)).toEqual([alex, sam]);
  });
});
