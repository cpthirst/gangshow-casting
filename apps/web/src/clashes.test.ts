import type { Role, RoleSize } from "@app/shared";
import { describe, expect, it } from "vitest";
import { clashesOf, describeClash, findClashes } from "./clashes.ts";
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

    expect(clashes).toEqual([]);
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

    expect(clash && describeClash(clash, "pirate-sketch")).toBe(
      "Warning: back-to-back. Also Lead in 'Opening Number', straight before this item",
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

  it("are described from the later item, naming the earlier one", () => {
    const [clash] = clashesOf(clashes, SAM, "pirate-sketch");
    expect(clash && describeClash(clash, "pirate-sketch")).toBe(
      "Error: back-to-back. Also Lead in 'Opening Number', straight before this item",
    );
  });

  it("are described from the earlier item, naming the later one", () => {
    const [clash] = clashesOf(clashes, SAM, "opening-number");
    expect(clash && describeClash(clash, "opening-number")).toBe(
      "Error: back-to-back. Also Support in 'Pirate Sketch', straight after this item",
    );
  });
});
