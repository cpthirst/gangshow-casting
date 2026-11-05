import type { CastMember, Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { castInItem, channelsOf, choicesFor, micPlotListOf, micRolesText } from "./mic-plot.ts";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";

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

  it("is only whoever had the channel in the item before, if anyone did", () => {
    expect(choicesFor(5, [alex, sam], plot, sam.id)).toEqual([sam]);
    expect(choicesFor(5, [alex, sam], plot, jo.id)).toEqual([]);
  });
});

describe("micRolesText", () => {
  it("is every role the cast member plays in the item, ensembles too, biggest first", () => {
    const chorus = aRole(1, "space-sketch", [jo.id, alex.id]);
    const narrator: Role = {
      ...aRole(2, "space-sketch", [alex.id]),
      name: "Narrator",
      size: "lead",
    };
    const alien: Role = {
      ...aRole(3, "space-sketch", [alex.id]),
      name: "Alien 1",
      size: "support",
    };
    const captain: Role = { ...aRole(4, "space-sketch", [sam.id]), size: "lead" };
    const elsewhere = aRole(5, "finale", [alex.id]);
    const roles = [{ ...chorus, name: "Chorus" }, alien, narrator, captain, elsewhere];

    expect(micRolesText("space-sketch", alex.id, roles)).toBe("Narrator, Alien 1, Chorus");
  });

  it("is nothing for a free mic", () => {
    expect(micRolesText("space-sketch", null, [aRole(1, "space-sketch", [alex.id])])).toBe("");
  });
});

describe("micPlotListOf", () => {
  const order = aRunningOrder(
    [anItem("Opening Number"), anItem("Space Sketch")],
    [anItem("Finale")],
  );
  const alien: Role = { ...aRole(1, "space-sketch", [alex.id]), name: "Alien 1", size: "lead" };
  const show = {
    order,
    cast: [alex, sam, jo],
    roles: [alien, aRole(2, "space-sketch", [jo.id])],
    plots: [
      {
        itemId: "space-sketch",
        mics: [
          { channel: 1, castMemberId: alex.id },
          { channel: 20, castMemberId: jo.id },
        ],
      },
    ],
    notes: [{ itemId: "space-sketch", text: "Mics 19–24 on for songs only", revision: 1 }],
  };

  it("lists each half's items in running order", () => {
    expect(micPlotListOf(show).map((half) => half.map((item) => item.title))).toEqual([
      ["Opening Number", "Space Sketch"],
      ["Finale"],
    ]);
  });

  it("gives every item all 24 channels, each with who is on it and their roles, blank when free", () => {
    const [, sketch] = micPlotListOf(show)[0] ?? [];

    expect(sketch?.mics).toHaveLength(24);
    expect(sketch?.mics[0]).toEqual({ name: "Alex Morgan", role: "Alien 1" });
    expect(sketch?.mics[19]).toEqual({ name: "Jo Reed", role: "Role 2" });
    expect(sketch?.mics[1]).toEqual({ name: "", role: "" });
  });

  it("holds each item's Mic plot notes, and none for an item without", () => {
    const [opening, sketch] = micPlotListOf(show)[0] ?? [];

    expect(sketch?.notes).toBe("Mics 19–24 on for songs only");
    expect(opening?.notes).toBe("");
  });
});
