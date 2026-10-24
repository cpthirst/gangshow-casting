import type { CastMember, Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import {
  biggestParts,
  castBySection,
  castingScore,
  dotLabel,
  type PartCounts,
  partsByMember,
  showByItem,
  spokenParts,
  timelineOf,
  timelineSummary,
} from "./overview.ts";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
let nextId = 1;
const person = (
  firstName: string,
  lastName: string,
  section: CastMember["section"],
): CastMember => ({ id: nextId++, firstName, lastName, section, group: "", revision: 1 });

const shape = (sections: ReturnType<typeof castBySection>) =>
  sections.map(({ label, members }) => [label, members.map((m) => m.firstName)]);

describe("castBySection", () => {
  it("groups people as Scouts, Explorers, Network, then Not set", () => {
    const cast = [
      person("Jo", "Newcomer", null),
      person("Kit", "Person", "network"),
      person("Alex", "Sample", "explorers"),
      person("Sam", "Example", "scouts"),
    ];

    expect(shape(castBySection(cast))).toEqual([
      ["Scouts", ["Sam"]],
      ["Explorers", ["Alex"]],
      ["Network", ["Kit"]],
      ["Not set", ["Jo"]],
    ]);
  });

  it("leaves out sections with nobody in them", () => {
    const cast = [person("Sam", "Example", "scouts"), person("Jo", "Newcomer", null)];

    expect(castBySection(cast).map((section) => section.label)).toEqual(["Scouts", "Not set"]);
  });

  it("lists each section by last name, then first name, for now", () => {
    const cast = [
      person("Ben", "Carter", "scouts"),
      person("Zoe", "Adams", "scouts"),
      person("Amy", "Carter", "scouts"),
    ];

    expect(shape(castBySection(cast))).toEqual([["Scouts", ["Zoe", "Amy", "Ben"]]]);
  });

  it("has no sections for an empty cast", () => {
    expect(castBySection([])).toEqual([]);
  });
});

describe("partsByMember", () => {
  let roleId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[]): Role => ({
    id: roleId,
    itemId,
    name: `Role ${roleId++}`,
    size,
    castMemberIds,
    revision: 1,
  });
  const inShow = new Set(["pirate-sketch", "campfire-song"]);

  it("counts each person's roles by size", () => {
    const roles = [
      role("pirate-sketch", "lead", [12]),
      role("pirate-sketch", "ensemble", [12, 13]),
      role("campfire-song", "ensemble", [12]),
      role("campfire-song", "support", [13]),
    ];

    const parts = partsByMember(roles, inShow);

    expect(parts.get(12)).toEqual({ lead: 1, support: 0, cameo: 0, ensemble: 2 });
    expect(parts.get(13)).toEqual({ lead: 0, support: 1, cameo: 0, ensemble: 1 });
  });

  it("counts two parts in one item twice, and an ensemble once however many are in it", () => {
    const roles = [
      role("pirate-sketch", "lead", [12]),
      role("pirate-sketch", "cameo", [12]),
      role("pirate-sketch", "ensemble", [12, 13, 14, 15, 16]),
    ];

    expect(partsByMember(roles, inShow).get(12)).toEqual({
      lead: 1,
      support: 0,
      cameo: 1,
      ensemble: 1,
    });
  });

  it("only counts roles in items of the saved running order", () => {
    const roles = [role("pirate-sketch", "lead", [12]), role("cut-item", "lead", [12])];

    expect(partsByMember(roles, inShow).get(12)?.lead).toBe(1);
  });

  it("has nothing for someone in no roles", () => {
    expect(partsByMember([], inShow).get(12)).toBeUndefined();
  });
});

describe("spokenParts", () => {
  it("reads the counts in words, biggest size first", () => {
    expect(spokenParts({ lead: 1, support: 0, cameo: 0, ensemble: 3 })).toBe("1 lead, 3 ensemble");
  });
});

describe("castingScore", () => {
  const counts = (over: Partial<PartCounts>): PartCounts => ({
    lead: 0,
    support: 0,
    cameo: 0,
    ensemble: 0,
    ...over,
  });

  it.each([
    [{ lead: 1 }, 8],
    [{ support: 2 }, 6],
    [{ cameo: 3 }, 6],
    [{ support: 3 }, 9],
    [{ ensemble: 4 }, 4],
    [{ lead: 1, support: 1, cameo: 1, ensemble: 1 }, 14],
  ])("scores %j as %i (lead 8, support 3, cameo 2, ensemble 1)", (over, score) => {
    expect(castingScore(counts(over))).toBe(score);
  });
});

describe("castBySection ordered by casting score", () => {
  // Names are chosen so score order and surname order disagree: a broken score sort fails.
  const scout = (firstName: string, lastName: string) => person(firstName, lastName, "scouts");
  const names = (sections: ReturnType<typeof castBySection>) =>
    sections.map(({ members }) => members.map((m) => `${m.firstName} ${m.lastName}`));
  const parts = (entries: [CastMember, Partial<PartCounts>][]) =>
    new Map(
      entries.map(([member, over]) => [
        member.id,
        { lead: 0, support: 0, cameo: 0, ensemble: 0, ...over },
      ]),
    );

  it("puts the highest score first", () => {
    const kit = scout("Kit", "Abel");
    const sam = scout("Sam", "Example");
    const zoe = scout("Zoe", "Young");

    const sections = castBySection(
      [kit, sam, zoe],
      parts([
        [kit, { ensemble: 4 }],
        [sam, { lead: 1 }],
        [zoe, { support: 3 }],
      ]),
    );

    expect(names(sections)).toEqual([["Zoe Young", "Sam Example", "Kit Abel"]]);
  });

  it("puts one lead above two supports or three cameos", () => {
    const sam = scout("Sam", "Young");
    const alex = scout("Alex", "Abel");
    const ben = scout("Ben", "Carter");

    const sections = castBySection(
      [alex, ben, sam],
      parts([
        [sam, { lead: 1 }],
        [alex, { support: 2 }],
        [ben, { cameo: 3 }],
      ]),
    );

    expect(names(sections)[0]?.[0]).toBe("Sam Young");
  });

  it("breaks a tied score by total roles, more first", () => {
    const ann = scout("Ann", "Adams");
    const ben = scout("Ben", "Young");

    const sections = castBySection(
      [ann, ben],
      parts([
        [ann, { support: 2 }],
        [ben, { cameo: 3 }],
      ]),
    );

    expect(names(sections)).toEqual([["Ben Young", "Ann Adams"]]);
  });

  it("then by last name and first name", () => {
    const amy = scout("Amy", "Carter");
    const zoe = scout("Zoe", "Adams");
    const ben = scout("Ben", "Carter");

    const sections = castBySection(
      [ben, amy, zoe],
      parts([
        [amy, { lead: 1 }],
        [zoe, { lead: 1 }],
        [ben, { lead: 1 }],
      ]),
    );

    expect(names(sections)).toEqual([["Zoe Adams", "Amy Carter", "Ben Carter"]]);
  });

  it("puts people with no parts at the bottom", () => {
    const jo = scout("Jo", "Adams");
    const sam = scout("Sam", "Example");

    const sections = castBySection([jo, sam], parts([[sam, { ensemble: 1 }]]));

    expect(names(sections)).toEqual([["Sam Example", "Jo Adams"]]);
  });

  it("orders each section on its own, keeping the sections' order", () => {
    const samAdams = scout("Sam", "Adams");
    const zoeZulu = scout("Zoe", "Zulu");
    const alexAbbott = person("Alex", "Abbott", "explorers");
    const kimYoung = person("Kim", "Young", "explorers");

    const sections = castBySection(
      [kimYoung, samAdams, alexAbbott, zoeZulu],
      parts([
        [samAdams, { ensemble: 1 }],
        [zoeZulu, { lead: 1 }],
        [alexAbbott, { cameo: 1 }],
        // Outscores every Scout, but is only ordered among the Explorers.
        [kimYoung, { lead: 3 }],
      ]),
    );

    expect(sections.map(({ label }) => label)).toEqual(["Scouts", "Explorers"]);
    expect(names(sections)).toEqual([
      ["Zoe Zulu", "Sam Adams"],
      ["Kim Young", "Alex Abbott"],
    ]);
  });
});

describe("a person's timeline", () => {
  // First half: Opening Number, Pirate Sketch, Dance One. Second half: Entr'acte (not in the
  // printed programme), Finale.
  const show = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch"), anItem("Dance One")],
    [anItem("Entr'acte", { printed: false }), anItem("Finale")],
  );
  let roleId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[]): Role => ({
    id: roleId++,
    itemId,
    name: `Role ${roleId}`,
    size,
    castMemberIds,
    revision: 1,
  });
  const SAM = 12;
  const parts = biggestParts([
    role("pirate-sketch", "ensemble", [SAM]),
    role("pirate-sketch", "lead", [SAM]),
    role("entr'acte", "cameo", [SAM]),
    role("opening-number", "ensemble", [13]),
  ]);
  const slots = (halves: ReturnType<typeof timelineOf>) =>
    halves.map((half) => half.map(({ title, number, part }) => [title, number, part]));

  it("has a slot per item, by half, in show order, with their biggest part where they appear", () => {
    expect(slots(timelineOf(show, parts.get(SAM)))).toEqual([
      [
        ["Opening Number", 1, undefined],
        ["Pirate Sketch", 2, "lead"],
        ["Dance One", 3, undefined],
      ],
      [
        ["Entr'acte", null, "cameo"],
        // Numbers start again in each half, as in the printed programme.
        ["Finale", 1, undefined],
      ],
    ]);
  });

  it("labels a dot with its number, title and their part", () => {
    const [first] = timelineOf(show, parts.get(SAM));

    expect(first?.map(dotLabel)).toEqual([
      "1 · Opening Number",
      "2 · Pirate Sketch: Lead",
      "3 · Dance One",
    ]);
  });

  it("labels an item not in the printed programme as such", () => {
    const [, second] = timelineOf(show, parts.get(SAM));

    expect(second?.map(dotLabel)).toEqual([
      "Entr'acte (not in printed programme): Cameo",
      "1 · Finale",
    ]);
  });

  it("sums the timeline up in one sentence", () => {
    expect(timelineSummary(timelineOf(show, parts.get(SAM)))).toBe(
      "In 2 of 5 items: Pirate Sketch, Entr'acte",
    );
    expect(timelineSummary(timelineOf(show, parts.get(99)))).toBe("In none of the 5 items");
  });

  it("is all empty for someone in no roles", () => {
    const halves = timelineOf(show, parts.get(99));

    expect(halves.flat().every((slot) => slot.part === undefined)).toBe(true);
    expect(halves.flat()).toHaveLength(5);
  });
});

describe("the show by item", () => {
  let roleId = 1;
  const role = (
    itemId: string,
    name: string,
    size: Role["size"],
    castMemberIds: number[] = [],
  ) => ({
    id: roleId++,
    itemId,
    name,
    size,
    castMemberIds,
    revision: 1,
  });
  const ava = person("Ava", "Example", "scouts");
  const cara = person("Cara", "Test", "scouts");
  const ben = person("Ben", "Sample", "explorers");
  const order = aRunningOrder([anItem("Opening"), anItem("Campfire Song")], [anItem("Finale")]);
  order.halves[0].name = "Act One";
  order.halves[1].name = "Act Two";

  it("lists each half's items in show order, with their programme numbers", () => {
    const halves = showByItem(order, [], [ava]);

    expect(halves.map(({ name, items }) => [name, items.map((i) => [i.number, i.title])])).toEqual([
      [
        "Act One",
        [
          [1, "Opening"],
          [2, "Campfire Song"],
        ],
      ],
      ["Act Two", [[1, "Finale"]]],
    ]);
  });

  it("gives each role its name, size and the names of who plays it", () => {
    const halves = showByItem(order, [role("opening", "Fairy Godmother", "lead", [ava.id])], [ava]);

    expect(halves[0]?.items[0]?.roles).toEqual([
      {
        id: expect.any(Number),
        name: "Fairy Godmother",
        size: "lead",
        cast: [{ id: ava.id, name: "Ava Example" }],
      },
    ]);
  });

  it("lists everyone in an ensemble in surname order, as the item's page does", () => {
    const halves = showByItem(
      order,
      [role("opening", "Villagers", "ensemble", [cara.id, ben.id])],
      [cara, ava, ben],
    );

    expect(halves[0]?.items[0]?.roles[0]?.cast.map((member) => member.name)).toEqual([
      "Ben Sample",
      "Cara Test",
    ]);
  });

  it("orders an item's roles by size, then by name ignoring case", () => {
    const roles = [
      role("finale", "Villagers", "ensemble"),
      role("finale", "zebra", "cameo"),
      role("finale", "Apple", "cameo"),
      role("finale", "Fairy Godmother", "lead"),
    ];

    const names = showByItem(order, roles, [])[1]?.items[0]?.roles.map((r) => r.name);

    expect(names).toEqual(["Fairy Godmother", "Apple", "zebra", "Villagers"]);
  });

  it("leaves out roles in items that aren't in the running order", () => {
    const halves = showByItem(order, [role("cut-item", "Narrator", "lead")], []);

    expect(halves.flatMap((half) => half.items.flatMap((item) => item.roles))).toEqual([]);
  });
});
