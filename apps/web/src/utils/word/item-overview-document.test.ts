import { unprintedHeadingColour } from "@app/shared";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import type { ShowHalf, ShowItem } from "@/utils/overview.ts";
import {
  type Block,
  columnShares,
  defaultHeaders,
  documentXml,
  logoBytes,
  outline,
  pageOf,
  readDocx,
} from "./docx.fixture.ts";
import { itemOverviewDocument } from "./item-overview-document.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const item = (number: number | null, title: string, roles: ShowItem["roles"] = []): ShowItem => ({
  itemId: title.toLowerCase().replaceAll(" ", "-"),
  title,
  number,
  roles,
});
let roleId = 1;
const role = (name: string, size: ShowItem["roles"][number]["size"], ...names: string[]) => ({
  id: roleId++,
  name,
  size,
  cast: names.map((name, i) => ({ id: i + 1, name })),
});

const show: ShowHalf[] = [
  {
    id: "first-half",
    name: "Act One",
    items: [
      item(1, "Opening", [
        role("Fairy Godmother", "lead", "Ava Example"),
        role("Villagers", "ensemble", "Ben Sample", "Cara Test"),
      ]),
      item(null, "Scene Change Music", [role("Narrator", "support")]),
    ],
  },
  { id: "second-half", name: "Act Two", items: [item(1, "Finale")] },
];

async function documentOf(halves: ShowHalf[], title = "Gang Show 2027") {
  return new Uint8Array(await Packer.toBuffer(itemOverviewDocument(title, halves)));
}

const tableAfter = (blocks: Block[], heading: string) => {
  const at = blocks.findIndex(
    (block) => block.kind === "paragraph" && block.text.startsWith(heading),
  );
  const next = blocks[at + 1];
  return next?.kind === "table" ? next : undefined;
};

describe("the Item Overview document", () => {
  it("heads the show, each half and each item with Word's heading styles", async () => {
    const blocks = readDocx(await documentOf(show));

    expect(outline(blocks).filter((line) => line.startsWith("Heading"))).toEqual([
      "Heading1: Gang Show 2027",
      "Heading2: Act One",
      "Heading3: 1 Opening",
      "Heading3: Scene Change Music · Not in printed programme",
      "Heading2: Act Two",
      "Heading3: 1 Finale",
    ]);
  });

  it("puts a table of each item's roles under it, with a header row", async () => {
    const table = tableAfter(readDocx(await documentOf(show)), "1 Opening");

    expect(table?.rows).toEqual([
      { header: true, cells: ["Role name", "Role type", "Cast"] },
      { header: false, cells: ["Fairy Godmother", "Lead", "Ava Example"] },
      { header: false, cells: ["Villagers", "Ensemble", "Ben Sample, Cara Test"] },
    ]);
  });

  it("shows an unprinted item's title in the grid's red italics, with no number", async () => {
    const heading = readDocx(await documentOf(show)).find(
      (block) => block.kind === "paragraph" && block.text.startsWith("Scene Change Music"),
    );

    const title = heading?.kind === "paragraph" ? heading.runs[0] : undefined;
    expect(title).toMatchObject({ text: "Scene Change Music", italic: true });
    expect(`#${title?.color?.toLowerCase()}`).toBe(unprintedHeadingColour);
  });

  it("sets each roles table at 25% role name, 15% role type and 60% cast", async () => {
    const file = await documentOf(show);

    expect(columnShares(file)).toEqual([
      [25, 15, 60],
      [25, 15, 60],
    ]);
    // On A4, the page the widths are worked out for.
    expect(pageOf(file)).toMatchObject({ width: 11906, height: 16838 });
    // Fixed, so Word keeps the widths rather than fitting each table to its text.
    expect(documentXml(file).match(/<w:tblLayout w:type="fixed"\/>/g)).toHaveLength(2);
  });

  it("says Uncast for a role nobody plays", async () => {
    const table = tableAfter(readDocx(await documentOf(show)), "Scene Change Music");

    expect(table?.rows[1]?.cells).toEqual(["Narrator", "Support", "Uncast"]);
  });

  it("says an item with no roles has none yet, with no table", async () => {
    const blocks = readDocx(await documentOf(show));

    expect(tableAfter(blocks, "1 Finale")).toBeUndefined();
    expect(outline(blocks).at(-1)).toBe("-: No roles have been added yet.");
  });

  it("writes names as plain text, never as markup", async () => {
    const file = await documentOf(
      [{ id: "first-half", name: "Act One", items: [item(1, "<b>Bold</b> & Co")] }],
      'Gang Show "2027"',
    );

    expect(outline(readDocx(file)).slice(0, 3)).toEqual([
      'Heading1: Gang Show "2027"',
      "Heading2: Act One",
      "Heading3: 1 <b>Bold</b> & Co",
    ]);
    expect(documentXml(file)).not.toContain("<b>");
  });

  it("heads every page with the Chester Gang Show logo, on the left", async () => {
    const headers = defaultHeaders(await documentOf(show));

    expect(headers).toEqual([{ alignments: ["left"], pictures: [logoBytes()] }]);
  });
});
