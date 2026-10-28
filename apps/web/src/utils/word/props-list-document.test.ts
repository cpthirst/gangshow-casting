import { unprintedHeadingColour } from "@app/shared";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import type { PropsListHalf, PropsListItem } from "@/utils/props.ts";
import {
  type Block,
  defaultHeaders,
  documentXml,
  logoBytes,
  outline,
  readDocx,
} from "./docx.fixture.ts";
import { propsListDocument } from "./props-list-document.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const item = (
  number: number | null,
  title: string,
  props: PropsListItem["props"] = [],
  notes = "",
): PropsListItem => ({ number, title, props, notes });

const show: PropsListHalf[] = [
  {
    name: "First half",
    items: [
      item(
        1,
        "Pirate Sketch",
        [
          {
            name: "Telescope",
            quantity: 1,
            roles: [{ name: "Captain", cast: "Sam Taylor" }],
            notes: [],
          },
          { name: "Treasure chest", quantity: 2, roles: [], notes: [] },
          {
            name: "Umbrella",
            quantity: 10,
            roles: [
              { name: "Pirate 1", cast: "Jo Brown" },
              { name: "Pirate 2", cast: "Uncast" },
            ],
            notes: [],
          },
          {
            name: "Lantern",
            quantity: 3,
            roles: [{ name: "Villagers", cast: "Jo Brown" }],
            notes: ["2 left to choose"],
          },
        ],
        "Chest set stage left before the blackout",
      ),
      item(null, "Interval Announcement"),
    ],
  },
  { name: "Second half", items: [item(1, "Finale")] },
];

async function documentOf(halves: PropsListHalf[], title = "Gang Show 2027") {
  return new Uint8Array(await Packer.toBuffer(propsListDocument(title, halves)));
}

const blockAfter = (blocks: Block[], heading: string, offset = 1) =>
  blocks[
    blocks.findIndex((block) => block.kind === "paragraph" && block.text.startsWith(heading)) +
      offset
  ];

describe("the props list document", () => {
  it("heads the show, each half and each item in running order, as the Item Overview does", async () => {
    const blocks = readDocx(await documentOf(show));

    expect(outline(blocks).filter((line) => line.startsWith("Heading"))).toEqual([
      "Heading1: Gang Show 2027",
      "Heading2: First half",
      "Heading3: 1 Pirate Sketch",
      "Heading3: Interval Announcement · Not in printed programme",
      "Heading2: Second half",
      "Heading3: 1 Finale",
    ]);
  });

  it("puts each item's props notes under its heading, before its table", async () => {
    const blocks = readDocx(await documentOf(show));

    expect(blockAfter(blocks, "1 Pirate Sketch")).toMatchObject({
      kind: "paragraph",
      text: "Chest set stage left before the blackout",
    });
    expect(blockAfter(blocks, "1 Pirate Sketch", 2)?.kind).toBe("table");
  });

  it("tables each item's props with their quantity, characters and cast, a row for each character", async () => {
    const table = blockAfter(readDocx(await documentOf(show)), "1 Pirate Sketch", 2);

    expect(table?.kind === "table" ? table.rows : undefined).toEqual([
      { header: true, cells: ["Prop", "Qty", "Character", "Cast"] },
      { header: false, cells: ["Telescope", "1", "Captain", "Sam Taylor"] },
      { header: false, cells: ["Treasure chest", "2", "", ""] },
      { header: false, cells: ["Umbrella", "10", "Pirate 1", "Jo Brown"] },
      // The prop's and quantity's cells run down beside each of its characters.
      { header: false, cells: ["", "", "Pirate 2", "Uncast"] },
      // What's left to sort out goes under the prop's name, as a second paragraph in its
      // cell (the reader joins a cell's paragraphs with nothing between them).
      { header: false, cells: ["Lantern2 left to choose", "3", "Villagers", "Jo Brown"] },
    ]);
    expect(documentXml(await documentOf(show))).toContain('<w:vMerge w:val="restart"/>');
  });

  it("prints what's left to sort out about a prop's carriers in bold italics, so it stands out", async () => {
    const xml = documentXml(await documentOf(show));

    const run = [...xml.matchAll(/<w:r>(.*?)<\/w:r>/gs)].find(([, run = ""]) =>
      run.includes(">2 left to choose<"),
    )?.[1];
    expect(run).toMatch(/<w:b\/>/);
    expect(run).toMatch(/<w:i\/>/);
  });

  it("says an item with no props has none, with no table and no notes", async () => {
    const blocks = readDocx(await documentOf(show));

    expect(blockAfter(blocks, "1 Finale")).toMatchObject({ kind: "paragraph", text: "No props" });
    expect(blockAfter(blocks, "Interval Announcement")).toMatchObject({ text: "No props" });
  });

  it("shows an unprinted item's title in the grid's red italics, with no number", async () => {
    const heading = blockAfter(readDocx(await documentOf(show)), "Interval Announcement", 0);

    const title = heading?.kind === "paragraph" ? heading.runs[0] : undefined;
    expect(title).toMatchObject({ text: "Interval Announcement", italic: true });
    expect(`#${title?.color?.toLowerCase()}`).toBe(unprintedHeadingColour);
  });

  it("heads every page with the Chester Gang Show logo, on the left", async () => {
    const headers = defaultHeaders(await documentOf(show));

    // About 5 cm across.
    expect(headers).toEqual([
      { alignments: ["left"], pictures: [logoBytes()], pictureWidths: [4.8] },
    ]);
  });

  it("writes names and notes as plain text, never as markup", async () => {
    const file = await documentOf(
      [
        {
          name: "First half",
          items: [
            item(
              1,
              "<b>Bold</b> & Co",
              [{ name: "<i>Hat</i>", quantity: 1, roles: [], notes: [] }],
              "<script>x</script>",
            ),
          ],
        },
      ],
      'Gang Show "2027"',
    );

    expect(outline(readDocx(file)).slice(0, 4)).toEqual([
      'Heading1: Gang Show "2027"',
      "Heading2: First half",
      "Heading3: 1 <b>Bold</b> & Co",
      "-: <script>x</script>",
    ]);
    expect(documentXml(file)).not.toMatch(/<b>|<i>|<script>/);
  });
});
