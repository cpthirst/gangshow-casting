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
          { name: "Telescope", roles: [{ name: "Captain", cast: "Sam Taylor" }] },
          { name: "Treasure chest", roles: [] },
          {
            name: "3 umbrellas",
            roles: [
              { name: "Pirate 1", cast: "Jo Brown" },
              { name: "Pirate 2", cast: "" },
            ],
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

  it("tables each item's props with their characters and cast, a row for each character", async () => {
    const table = blockAfter(readDocx(await documentOf(show)), "1 Pirate Sketch", 2);

    expect(table?.kind === "table" ? table.rows : undefined).toEqual([
      { header: true, cells: ["Prop", "Character", "Cast"] },
      { header: false, cells: ["Telescope", "Captain", "Sam Taylor"] },
      { header: false, cells: ["Treasure chest", "", ""] },
      { header: false, cells: ["3 umbrellas", "Pirate 1", "Jo Brown"] },
      // The prop's cell runs down beside each of its characters.
      { header: false, cells: ["", "Pirate 2", "Uncast"] },
    ]);
    expect(documentXml(await documentOf(show))).toContain('<w:vMerge w:val="restart"/>');
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

    expect(headers).toEqual([{ alignments: ["left"], pictures: [logoBytes()] }]);
  });

  it("writes names and notes as plain text, never as markup", async () => {
    const file = await documentOf(
      [
        {
          name: "First half",
          items: [
            item(1, "<b>Bold</b> & Co", [{ name: "<i>Hat</i>", roles: [] }], "<script>x</script>"),
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
