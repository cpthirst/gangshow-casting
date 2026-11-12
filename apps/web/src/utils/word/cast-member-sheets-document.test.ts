import { type CastMember, type Costume, type Role, unprintedHeadingColour } from "@app/shared";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import {
  alexMorgan,
  captainHook,
  joBrown,
  kimLee,
  pirates,
  samPatel,
  smee,
} from "@/utils/casting.fixture.ts";
import { alexAsHook } from "@/utils/costumes.fixture.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { castingSheetsDocument, costumeSheetsDocument } from "./cast-member-sheets-document.ts";
import {
  type Block,
  columnShares,
  defaultHeaders,
  documentXml,
  logoBytes,
  pageOf,
  readDocx,
  rowHeights,
} from "./docx.fixture.ts";

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

  it("lists a Beaver under Beavers, before the older sections", async () => {
    const cast = [member("Sam", "Clark", "scouts"), member("Poppy", "Example", "beavers")];

    const sheets = pages(readDocx(await sheetsOf(cast)));

    expect(sheets[0]?.slice(1, 3)).toEqual(["Heading2: Poppy Example", "-: Beavers"]);
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

  it("has a #, Item Name and Cast header row, and no Costume from home", async () => {
    const [table] = await tablesOf([ava]);

    expect(table?.[0]).toEqual({ header: true, cells: ["#", "Item Name", "Cast"] });
    expect(itemRows(table)).toHaveLength(4);
  });

  it("lists every item in show order, each number in its own column, a row naming each half", async () => {
    const [table] = await tablesOf([ava]);

    expect(table?.slice(1).map((row) => row.cells.slice(0, 2))).toEqual([
      ["Act One"],
      ["1", "Opening"],
      ["", "Scene Change Music"],
      ["2", "Campfire Song"],
      ["Act Two"],
      ["1", "Finale"],
    ]);
  });

  it("sets the columns at 7%, 83% and 10% of the page, Item Name taking the width", async () => {
    const file = await sheetsOf([ava], { order: show, roles });

    expect(columnShares(file)).toEqual([[7, 83, 10]]);
  });

  it("ticks the items the person is in, whatever their part, and leaves the rest empty", async () => {
    const [table] = await tablesOf([ava]);

    const ticks = itemRows(table).map((row) => row.cells[2]);
    expect(ticks).toEqual(["✓", "✓", "", "✓"]);
  });

  it("ticks nothing for someone with no parts", async () => {
    const [, table] = await tablesOf([ava, member("Bea", "Zed", "scouts")]);

    const ticks = itemRows(table).map((row) => row.cells[2]);
    expect(ticks).toEqual(["", "", "", ""]);
  });

  it("prints on A4, with the table's first row marked to repeat on any page it runs onto", async () => {
    const file = await sheetsOf([ava], { order: show, roles });

    const page = pageOf(file);
    expect([page.width, page.height]).toEqual([11906, 16838]);
    const [table] = readDocx(file).flatMap((block) => (block.kind === "table" ? [block.rows] : []));
    expect(table?.[0]?.header).toBe(true);
  });

  it("heads every sheet with the Chester Gang Show logo, on the left", async () => {
    const headers = defaultHeaders(
      await sheetsOf([
        member("Ava", "Example", "scouts", "1st Anytown"),
        member("Ben", "Sample", null),
      ]),
    );

    expect(headers).toEqual([
      { alignments: ["left"], pictures: [logoBytes()], pictureWidths: [2.4] },
    ]);
  });

  it("sets the logo a quarter inch from the top, so it takes little room from the items", async () => {
    const file = await sheetsOf([member("Ava", "Example", "scouts")]);

    // Half the other exports' logo (above), a quarter inch from the top of the page.
    expect(pageOf(file).header).toBe(360);
  });
});

describe("the Costume Sheets document", () => {
  const alex: CastMember = { ...alexMorgan, section: "scouts", group: "1st Anytown" };
  const jo: CastMember = { ...joBrown, section: "explorers", group: "Anytown Unit" };
  const sam = samPatel;
  const show = aRunningOrder(
    [anItem("Opening Number"), anItem("Bonus Sketch", { printed: false }), anItem("Pirate Dance")],
    [anItem("Finale")],
  );
  show.halves[0].name = "Act One";
  show.halves[1].name = "Act Two";
  const roles = [
    captainHook(alex),
    { ...pirates, castMemberIds: [jo.id] },
    { ...smee, castMemberIds: [jo.id] },
  ];
  const joCostume = (role: Role, fromWardrobe: string, fromCastMember: string): Costume => ({
    itemId: "opening-number",
    roleId: role.id,
    castMemberId: jo.id,
    fromWardrobe,
    fromCastMember,
    notes: "",
    revision: 1,
  });
  const costumes = [
    alexAsHook,
    joCostume(pirates, "Bandana", "Boots"),
    joCostume(smee, "Striped shirt", "Red hat"),
  ];

  async function costumeSheetsOf(cast: CastMember[], extraRoles: Role[] = []) {
    const doc = costumeSheetsDocument({
      order: show,
      roles: [...roles, ...extraRoles],
      cast,
      costumes,
    });
    return new Uint8Array(await Packer.toBuffer(doc));
  }

  const costumeTablesOf = (file: Uint8Array) =>
    readDocx(file).flatMap((block) => (block.kind === "table" ? [block.rows] : []));

  /** Each table's item rows' cells: not the header row, nor the rows naming a half. */
  const itemRowsOf = (file: Uint8Array) =>
    costumeTablesOf(file).map((rows) =>
      rows.filter((row) => !row.header && row.cells.length === 5).map((row) => row.cells),
    );

  it("has a page for each person in section order, headed with the show, their name, section and group", async () => {
    const sheets = pages(readDocx(await costumeSheetsOf([sam, jo, alex])));

    expect(sheets).toEqual([
      ["Heading1: Gang Show 2027", "Heading2: Alex Morgan", "-: Scouts · 1st Anytown"],
      ["Heading1: Gang Show 2027", "Heading2: Jo Brown", "-: Explorers · Anytown Unit"],
      ["Heading1: Gang Show 2027", "Heading2: Sam Patel"],
    ]);
  });

  it("names nobody on a sheet but the person it's for", async () => {
    const xml = documentXml(await costumeSheetsOf([alex, jo, sam, kimLee]));

    for (const name of ["Alex Morgan", "Jo Brown", "Sam Patel", "Kim Lee"]) {
      expect(xml.split(name)).toHaveLength(2);
    }
  });

  it("has a #, Item Name, Role, From Wardrobe and From Cast Member header row", async () => {
    const [table] = costumeTablesOf(await costumeSheetsOf([alex]));

    expect(table?.[0]).toEqual({
      header: true,
      cells: ["#", "Item Name", "Role", "From Wardrobe", "From Cast Member"],
    });
  });

  it("lists every item in show order, each number in its own column, a row naming each half", async () => {
    const [table] = costumeTablesOf(await costumeSheetsOf([alex]));

    expect(table?.slice(1).map((row) => row.cells.slice(0, 2))).toEqual([
      ["Act One"],
      ["1", "Opening Number"],
      ["", "Bonus Sketch"],
      ["2", "Pirate Dance"],
      ["Act Two"],
      ["1", "Finale"],
    ]);
  });

  it("shows the person's role and costume in each item they're in, never its notes, and nothing in the rest", async () => {
    const file = await costumeSheetsOf([alex]);

    expect(itemRowsOf(file)).toEqual([
      [
        ["1", "Opening Number", "✓(Captain Hook)", "Red coat, hook", "Black shoes"],
        ["", "Bonus Sketch", "", "", ""],
        ["2", "Pirate Dance", "", "", ""],
        ["1", "Finale", "", "", ""],
      ],
    ]);
    expect(documentXml(file)).not.toContain("Hem the coat");
  });

  it("shows a role as a centred tick with its name in italic parentheses on the line below", async () => {
    const xml = documentXml(await costumeSheetsOf([alex]));

    const roleCell = /<w:tc>(?:(?!<w:tc>).)*?\(Captain Hook\).*?<\/w:tc>/s.exec(xml)?.[0] ?? "";
    const lines = [...roleCell.matchAll(/<w:p>.*?<\/w:p>/gs)].map(([line]) => ({
      text: [...line.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(([, t]) => t).join(""),
      centred: line.includes('<w:jc w:val="center"/>'),
      italic: /<w:i\/>/.test(line),
    }));
    expect(lines).toEqual([
      { text: "✓", centred: true, italic: false },
      { text: "(Captain Hook)", centred: true, italic: true },
    ]);
  });

  it("gives each of the person's roles in an item its own row, with its own costume", async () => {
    const [rows] = itemRowsOf(await costumeSheetsOf([jo]));

    expect(rows?.filter(([, title]) => title === "Opening Number")).toEqual([
      ["1", "Opening Number", "✓(Smee)", "Striped shirt", "Red hat"],
      ["1", "Opening Number", "✓(Pirates)", "Bandana", "Boots"],
    ]);
  });

  it("gives each person in a shared role only their own costume, on their own sheet", async () => {
    const sharedPirates = { ...pirates, castMemberIds: [jo.id, sam.id] };
    const doc = costumeSheetsDocument({
      order: show,
      roles: [sharedPirates],
      cast: [jo, sam],
      costumes: [
        joCostume(pirates, "Bandana", "Boots"),
        { ...joCostume(pirates, "Eyepatch", "Sandals"), castMemberId: sam.id },
      ],
    });

    const [joRows, samRows] = itemRowsOf(new Uint8Array(await Packer.toBuffer(doc)));

    expect(joRows?.[0]).toEqual(["1", "Opening Number", "✓(Pirates)", "Bandana", "Boots"]);
    expect(samRows?.[0]).toEqual(["1", "Opening Number", "✓(Pirates)", "Eyepatch", "Sandals"]);
    expect(joRows?.flat()).not.toContain("Eyepatch");
    expect(samRows?.flat()).not.toContain("Bandana");
  });

  it("shows a role nobody has given a costume yet, with the costume columns empty", async () => {
    const dancer: Role = { ...pirates, id: 9, itemId: "pirate-dance", castMemberIds: [alex.id] };

    const [rows] = itemRowsOf(await costumeSheetsOf([alex], [dancer]));

    expect(rows?.[2]).toEqual(["2", "Pirate Dance", "✓(Pirates)", "", ""]);
  });
});

describe("what the casting and costume sheets share", () => {
  const ava = member("Ava", "Example", "scouts");
  const show = aRunningOrder([anItem("Opening"), anItem("Bonus Sketch", { printed: false })]);
  const sheets = {
    casting: castingSheetsDocument({ order: show, roles: [], cast: [ava] }),
    costume: costumeSheetsDocument({ order: show, roles: [], cast: [ava], costumes: [] }),
  };

  it.each(Object.entries(sheets))(
    "the %s sheets show an item not in the printed programme in the grid's red italics",
    async (_kind, doc) => {
      const xml = documentXml(new Uint8Array(await Packer.toBuffer(doc)));

      const run = /<w:r>(?:(?!<w:r>).)*?Bonus Sketch<\/w:t><\/w:r>/s.exec(xml)?.[0] ?? "";
      expect(run).toMatch(/<w:i\/>/);
      expect(run).toContain(`<w:color w:val="${unprintedHeadingColour.slice(1).toUpperCase()}"/>`);
    },
  );

  it.each(Object.entries(sheets))(
    "the %s sheets make every item row two lines of text tall",
    async (_kind, doc) => {
      const file = new Uint8Array(await Packer.toBuffer(doc));

      // Two lines of 11 pt text (a line is 1.2 times the size), in twentieths of a point,
      // for each item, the unprinted one included.
      expect(rowHeights(file).filter((height) => height !== undefined)).toEqual([528, 528]);
    },
  );
});
