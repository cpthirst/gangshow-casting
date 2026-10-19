import type { CastMember, Role } from "@app/shared";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { castingSheetsDocument } from "./casting-sheets-document.ts";
import { type Block, documentXml, pageOf, readDocx, rowHeights } from "./docx.fixture.ts";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
let nextId = 1;
const member = (
  firstName: string,
  lastName: string,
  section: CastMember["section"],
  group = "",
): CastMember => ({
  id: nextId++,
  firstName,
  lastName,
  section,
  group,
  singing: "",
  acting: "",
  revision: 1,
});

const order = aRunningOrder([anItem("Opening")], [anItem("Finale")]);

async function sheetsOf(cast: CastMember[], show: { order?: typeof order; roles?: Role[] } = {}) {
  const doc = castingSheetsDocument({ order: show.order ?? order, roles: show.roles ?? [], cast });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** Each page's paragraphs, split where a paragraph starts a new page. */
const pages = (blocks: Block[]) =>
  blocks.reduce<string[][]>((all, block) => {
    if (block.kind !== "paragraph") return all;
    if (block.pageBreakBefore || all.length === 0) all.push([]);
    all.at(-1)?.push(`${block.style ?? "-"}: ${block.text}`);
    return all;
  }, []);

describe("the Casting Sheets document", () => {
  it("has a page for every cast member, whether or not they're in anything", async () => {
    const cast = [member("Ava", "Example", "scouts"), member("Cara", "Test", "scouts")];

    const sheets = pages(readDocx(await sheetsOf(cast)));

    expect(sheets.map((page) => page[1])).toEqual(["Heading2: Ava Example", "Heading2: Cara Test"]);
  });

  it("orders the pages by section, then surname, then first name", async () => {
    const cast = [
      member("Dan", "Evans", null),
      member("Sam", "Clark", "network"),
      member("Zoe", "Adams", "explorers"),
      member("Tom", "Brown", "scouts"),
      member("Amy", "Brown", "scouts"),
    ];

    const names = pages(readDocx(await sheetsOf(cast))).map((page) => page[1]);

    expect(names).toEqual([
      "Heading2: Amy Brown",
      "Heading2: Tom Brown",
      "Heading2: Zoe Adams",
      "Heading2: Sam Clark",
      "Heading2: Dan Evans",
    ]);
  });

  it("heads each page with the show, then the person, their section and their group", async () => {
    const sheets = pages(
      readDocx(await sheetsOf([member("Ava", "Example", "scouts", "1st Anytown")])),
    );

    expect(sheets[0]?.slice(0, 3)).toEqual([
      "Heading1: Gang Show 2027",
      "Heading2: Ava Example",
      "-: Scouts · 1st Anytown",
    ]);
  });

  it.each([
    ["no group", member("Sam", "Clark", "network"), "-: Network"],
    ["no section", member("Kit", "Person", null, "2nd Anytown"), "-: 2nd Anytown"],
  ])("leaves out what isn't set: %s", async (_case, person, details) => {
    const sheets = pages(readDocx(await sheetsOf([person])));

    expect(sheets[0]?.[2]).toBe(details);
  });

  it("shows only the name when neither section nor group is set", async () => {
    const sheets = pages(readDocx(await sheetsOf([member("Dan", "Evans", null)])));

    expect(sheets[0]).toEqual(["Heading1: Gang Show 2027", "Heading2: Dan Evans"]);
  });

  it("holds nothing about the cast beyond name, section and group", async () => {
    const noted = {
      ...member("Ava", "Example", "scouts"),
      singing: "Strong alto voice",
      acting: "Shy",
    };

    const xml = documentXml(await sheetsOf([noted]));

    expect(xml).not.toContain("Strong alto voice");
    expect(xml).not.toContain("Shy");
  });
});

describe("each casting sheet's table of items", () => {
  const ava = member("Ava", "Example", "scouts");
  const cara = member("Cara", "Test", "scouts");
  const show = aRunningOrder(
    [anItem("Opening"), anItem("Scene Change Music", { printed: false }), anItem("Campfire Song")],
    [anItem("Finale")],
  );
  show.halves[0].name = "Act One";
  show.halves[1].name = "Act Two";
  let roleId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[]): Role => ({
    id: roleId,
    itemId,
    name: `Role ${roleId++}`,
    size,
    castMemberIds,
    revision: 1,
  });
  const roles = [
    role("opening", "lead", [ava.id]),
    role("finale", "ensemble", [ava.id, cara.id]),
    role("scene-change-music", "cameo", [ava.id]),
  ];

  /** The rows for items: not the header row, nor the rows naming a half. */
  const itemRows = (table: { header: boolean; cells: string[] }[] | undefined) =>
    (table ?? []).filter((row) => !row.header && row.cells.length === 3);

  async function tablesOf(cast: CastMember[]) {
    const file = await sheetsOf(cast, { order: show, roles });
    return readDocx(file).flatMap((block) => (block.kind === "table" ? [block.rows] : []));
  }

  it("has an Item Name, Am I cast and Costume from home header row", async () => {
    const [table] = await tablesOf([ava]);

    expect(table?.[0]).toEqual({
      header: true,
      cells: ["Item Name", "Am I cast", "Costume from home"],
    });
  });

  it("lists the printed items in show order with their numbers, a row naming each half", async () => {
    const [table] = await tablesOf([ava]);

    expect(table?.slice(1).map((row) => row.cells[0])).toEqual([
      "Act One",
      "1 Opening",
      "2 Campfire Song",
      "Act Two",
      "1 Finale",
    ]);
  });

  it("leaves out items not in the printed programme, even for someone cast in one", async () => {
    const [table] = await tablesOf([ava]);

    expect(table?.map((row) => row.cells[0])).not.toContain("Scene Change Music");
  });

  it("ticks the items the person is in, whatever their part, and leaves the rest empty", async () => {
    const [table] = await tablesOf([ava]);

    const ticks = itemRows(table).map((row) => row.cells[1]);
    expect(ticks).toEqual(["✓", "", "✓"]);
  });

  it("ticks nothing for someone with no parts", async () => {
    const [, table] = await tablesOf([ava, member("Bea", "Zed", "scouts")]);

    const ticks = itemRows(table).map((row) => row.cells[1]);
    expect(ticks).toEqual(["", "", ""]);
  });

  it("leaves Costume from home empty on every item", async () => {
    const [table] = await tablesOf([ava]);

    const costumes = itemRows(table).map((row) => row.cells[2]);
    expect(costumes).toEqual(["", "", ""]);
  });

  it("makes each item row tall enough to write in, and 30 of them fit on one A4 page", async () => {
    const thirty = aRunningOrder(Array.from({ length: 30 }, (_, i) => anItem(`Item ${i + 1}`)));
    const file = await sheetsOf([ava], { order: thirty, roles: [] });

    const page = pageOf(file);
    const heights = rowHeights(file).filter((height) => height !== undefined);
    // Every item row has its height set.
    expect(heights).toHaveLength(30);
    // A4 portrait, in twentieths of a point.
    expect([page.width, page.height]).toEqual([11906, 16838]);
    // At least 0.7 cm a row, room to write by hand.
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(397);
    // Word sizes the headings, the header row and the half rows itself, so allow about 4 cm
    // for them. A title long enough to wrap makes its row taller: the story accepts that.
    const ROOM_FOR_HEADINGS = 2268;
    expect(
      heights.reduce((sum, height) => sum + height, 0) + ROOM_FOR_HEADINGS,
    ).toBeLessThanOrEqual(page.bodyHeight);
  });
});
