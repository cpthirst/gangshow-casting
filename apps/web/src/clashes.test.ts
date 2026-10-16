import type { Role, RoleSize } from "@app/shared";
import { describe, expect, it } from "vitest";
import { type Clash, clashesOf, describeClash, findClashes } from "./clashes.ts";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";

// First half: Opening Number, Pirate Sketch, Dance One. Second half: Campfire Song, Finale.
const show = aRunningOrder(
  [anItem("Opening Number"), anItem("Pirate Sketch"), anItem("Dance One")],
  [anItem("Campfire Song"), anItem("Finale")],
);

let nextId = 1;
const role = (itemId: string, size: RoleSize, castMemberIds: number[], name = `Role ${nextId}`) =>
  ({ id: nextId++, itemId, name, size, castMemberIds, revision: 1 }) satisfies Role;

const SAM = 12;
const ALEX = 13;

describe("back-to-back clashes", () => {
  it("finds named parts in two items in a row as an error", () => {
    const clashes = findClashes(show, [
      role("opening-number", "lead", [SAM]),
      role("pirate-sketch", "support", [SAM]),
    ]);

    expect(clashes).toEqual([
      {
        castMemberId: SAM,
        kind: "back-to-back",
        severity: "error",
        first: { itemId: "opening-number", title: "Opening Number", part: "lead" },
        second: { itemId: "pirate-sketch", title: "Pirate Sketch", part: "support" },
        gapMinutes: 0,
      },
    ]);
  });

  it("uses someone's biggest part in an item", () => {
    const clashes = findClashes(show, [
      role("pirate-sketch", "ensemble", [SAM]),
      role("pirate-sketch", "lead", [SAM]),
      role("opening-number", "cameo", [SAM]),
    ]);

    expect(clashes.map((clash) => clash.second.part)).toEqual(["lead"]);
  });

  it("doesn't count items with another item between them", () => {
    const clashes = findClashes(show, [
      role("opening-number", "lead", [SAM]),
      role("dance-one", "lead", [SAM]),
    ]);

    // A 5-minute gap: a quick change (casting-rules E2.S3), but not back-to-back.
    expect(clashes.map((clash) => clash.kind)).not.toContain("back-to-back");
  });

  it("doesn't count items either side of the interval", () => {
    const clashes = findClashes(show, [
      role("dance-one", "lead", [SAM]),
      role("campfire-song", "lead", [SAM]),
    ]);

    expect(clashes).toEqual([]);
  });

  it("finds each person's clashes separately", () => {
    const clashes = findClashes(show, [
      role("campfire-song", "lead", [SAM]),
      role("finale", "cameo", [SAM, ALEX]),
      role("opening-number", "support", [ALEX]),
    ]);

    expect(clashes.map((clash) => clash.castMemberId)).toEqual([SAM]);
  });

  it("ignores roles in items that aren't in the running order", () => {
    const clashes = findClashes(show, [
      role("opening-number", "lead", [SAM]),
      role("cut-item", "lead", [SAM]),
    ]);

    expect(clashes).toEqual([]);
  });
});

describe("back-to-back with an ensemble", () => {
  it.each([
    ["a named part then an ensemble", "lead", "ensemble"],
    ["an ensemble then a named part", "ensemble", "cameo"],
    ["two ensembles", "ensemble", "ensemble"],
  ] as const)("finds %s as a warning", (_, firstPart, secondPart) => {
    const clashes = findClashes(show, [
      role("opening-number", firstPart, [SAM]),
      role("pirate-sketch", secondPart, [SAM]),
    ]);

    expect(clashes.map((clash) => clash.severity)).toEqual(["warning"]);
  });

  it("describes a warning as a warning", () => {
    const [clash] = findClashes(show, [
      role("opening-number", "lead", [SAM]),
      role("pirate-sketch", "ensemble", [SAM]),
    ]);

    expect(clash && describeClash(clash)).toBe(
      "Warning: back-to-back. Lead in 'Opening Number', then Ensemble in 'Pirate Sketch'",
    );
  });

  it("lists someone's clashes in an item worst first", () => {
    // The warning (Opening Number → Pirate Sketch) comes first in the show.
    const clashes = findClashes(show, [
      role("opening-number", "ensemble", [SAM]),
      role("pirate-sketch", "lead", [SAM]),
      role("dance-one", "support", [SAM]),
    ]);

    expect(clashesOf(clashes, SAM, "pirate-sketch").map((clash) => clash.severity)).toEqual([
      "error",
      "warning",
    ]);
  });
});

describe("time between appearances", () => {
  // Opening Number 5, Pirate Sketch 4, Dance One 3, Song Two 2, Sketch Two 6 minutes; then
  // the interval; then Campfire Song 5, Finale 8.
  const timed = (intervalMinutes = 20) => ({
    ...aRunningOrder(
      [
        anItem("Opening Number", { minutes: 5 }),
        anItem("Pirate Sketch", { minutes: 4 }),
        anItem("Dance One", { minutes: 3 }),
        anItem("Song Two", { minutes: 2 }),
        anItem("Sketch Two", { minutes: 6 }),
      ],
      [anItem("Campfire Song", { minutes: 5 }), anItem("Finale", { minutes: 8 })],
    ),
    intervalMinutes,
  });
  const samIn = (...itemIds: string[]) => itemIds.map((itemId) => role(itemId, "lead", [SAM]));
  const described = (clashes: Clash[], itemId: string) =>
    clashesOf(clashes, SAM, itemId).map(describeClash);

  it("warns about a gap under 5 minutes", () => {
    const clashes = findClashes(timed(), samIn("opening-number", "dance-one"));

    expect(described(clashes, "dance-one")).toEqual([
      "Warning: short gap. Only 4 minutes between 'Opening Number' and 'Dance One' (needs at least 5 minutes)",
    ]);
    expect(described(clashes, "opening-number")).toEqual(described(clashes, "dance-one"));
  });

  it("adds up every item between, so 5 minutes is a quick change", () => {
    const clashes = findClashes(timed(), samIn("pirate-sketch", "sketch-two"));

    expect(clashes.map((clash) => [clash.kind, clash.severity, clash.gapMinutes])).toEqual([
      ["quick-change", "info", 5],
    ]);
  });

  it("notes a quick change for a gap from 5 to under 8 minutes", () => {
    const clashes = findClashes(timed(), samIn("opening-number", "song-two"));

    expect(described(clashes, "song-two")).toEqual([
      "Info: quick change. 7 minutes between 'Opening Number' and 'Song Two'",
    ]);
  });

  it("needs nothing for a gap of exactly 8 minutes", () => {
    const clashes = findClashes(timed(8), samIn("sketch-two", "campfire-song"));

    expect(clashes).toEqual([]);
  });

  it("counts the interval towards the gap", () => {
    const clashes = findClashes(timed(4), samIn("sketch-two", "campfire-song"));

    expect(described(clashes, "campfire-song")).toEqual([
      "Warning: short gap. Only 4 minutes between 'Sketch Two' and 'Campfire Song' (needs at least 5 minutes)",
    ]);
  });

  it("needs nothing across a long interval", () => {
    expect(findClashes(timed(20), samIn("sketch-two", "campfire-song"))).toEqual([]);
  });

  it("compares each appearance only with the next one", () => {
    const clashes = findClashes(timed(), samIn("opening-number", "pirate-sketch", "dance-one"));

    expect(described(clashes, "opening-number")).toEqual([
      "Error: back-to-back. Lead in 'Opening Number', then Lead in 'Pirate Sketch'",
    ]);
  });

  it("reports back-to-back appearances once, not also as a timing warning", () => {
    const clashes = findClashes(timed(), samIn("opening-number", "pirate-sketch"));

    expect(clashes.map((clash) => clash.kind)).toEqual(["back-to-back"]);
  });

  it("lists a timing warning before a quick change", () => {
    // Pirate Sketch → Sketch Two is a 5-minute quick change, first in the show; Sketch Two →
    // Campfire Song is only the 3-minute interval.
    const clashes = findClashes(timed(3), samIn("pirate-sketch", "sketch-two", "campfire-song"));

    expect(clashesOf(clashes, SAM, "sketch-two").map((clash) => clash.severity)).toEqual([
      "warning",
      "info",
    ]);
  });
});

describe("a person's clashes in an item", () => {
  const clashes = findClashes(show, [
    role("opening-number", "lead", [SAM]),
    role("pirate-sketch", "support", [SAM]),
  ]);

  it("are found from either item", () => {
    expect(clashesOf(clashes, SAM, "opening-number")).toHaveLength(1);
    expect(clashesOf(clashes, SAM, "pirate-sketch")).toHaveLength(1);
    expect(clashesOf(clashes, SAM, "dance-one")).toEqual([]);
    expect(clashesOf(clashes, ALEX, "pirate-sketch")).toEqual([]);
  });

  it("are described naming both items and parts, the same from either item", () => {
    const fromEach = ["opening-number", "pirate-sketch"].map((itemId) =>
      clashesOf(clashes, SAM, itemId).map(describeClash),
    );

    expect(fromEach).toEqual([
      ["Error: back-to-back. Lead in 'Opening Number', then Support in 'Pirate Sketch'"],
      ["Error: back-to-back. Lead in 'Opening Number', then Support in 'Pirate Sketch'"],
    ]);
  });
});
