import { type CastMember, type Role, unprintedHeadingColour } from "@app/shared";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  HeightRule,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { sectionLabel } from "./cast.ts";
import type { LatestShow } from "./latest-show.ts";
import { castBySection } from "./overview.ts";
import { runningClock } from "./running-order.ts";
import { A4, CELL_SPACING, LINE_HEIGHT, widthsOf, wordStyles } from "./word-styles.ts";

// A casting sheet for every cast member, to print and hand out (casting-overview-by-item
// FR9–FR13): one each, starting on a new page, headed with the show and who it's for, then
// every item, with a tick where they're in it and room to note costume from home. Only
// their name, section and group: a sheet handed to a young person shows nobody else's
// details (ADR 0022).

// In twentieths of a point. A4 with narrow margins, and item rows two lines of text tall,
// room to write in by hand. A long show carries on over the page, header row repeated.
const MARGIN = { top: 720, bottom: 720, left: 1080, right: 1080 };
const ITEM_ROW_HEIGHT = 2 * LINE_HEIGHT;

const COLUMNS = [
  { name: "#", share: 7 },
  { name: "Item Name", share: 40 },
  { name: "Cast", share: 10 },
  { name: "Costume from home", share: 43 },
];

/** "Scouts · 1st Anytown", leaving out whatever isn't set: never the screen's "Not set" on
 *  a sheet handed to a young person. */
const detailsOf = ({ section, group }: CastMember) =>
  [section === null ? "" : sectionLabel(section), group].filter((part) => part !== "").join(" · ");

interface CellOptions {
  bold?: boolean;
  centred?: boolean;
  span?: number;
  /** An item not in the printed programme: the grid's red italics. */
  unprinted?: boolean;
}

const cell = (text: string, options: CellOptions = {}) =>
  new TableCell({
    columnSpan: options.span ?? 1,
    children: [
      new Paragraph({
        alignment: options.centred ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: CELL_SPACING,
        children: [
          new TextRun({
            text,
            bold: options.bold ?? false,
            ...(options.unprinted
              ? { italics: true, color: unprintedHeadingColour.slice(1).toUpperCase() }
              : {}),
          }),
        ],
      }),
    ],
  });

/** One half of the show, as every sheet lists it: each item with its programme number,
 *  or null for an item left out of the printed programme. */
interface SheetHalf {
  name: string;
  items: { id: string; number: number | null; title: string }[];
}

const halvesOf = (show: LatestShow): SheetHalf[] =>
  runningClock(show.order).halves.map(({ half, rows }) => ({
    name: half.name,
    items: rows.map(({ item, number }) => ({ id: item.id, number, title: item.title })),
  }));

const isIn = (roles: Role[], memberId: number, itemId: string) =>
  roles.some((role) => role.itemId === itemId && role.castMemberIds.includes(memberId));

const itemsTable = (halves: SheetHalf[], roles: Role[], member: CastMember) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // Fixed, so Word keeps these widths rather than fitting the table to its text.
    layout: TableLayoutType.FIXED,
    columnWidths: widthsOf(
      A4.width - MARGIN.left - MARGIN.right,
      COLUMNS.map(({ share }) => share),
    ),
    rows: [
      new TableRow({
        tableHeader: true,
        children: COLUMNS.map(({ name }) => cell(name, { bold: true })),
      }),
      ...halves.flatMap((half) => [
        new TableRow({ children: [cell(half.name, { bold: true, span: COLUMNS.length })] }),
        ...half.items.map(
          (item) =>
            new TableRow({
              height: { value: ITEM_ROW_HEIGHT, rule: HeightRule.ATLEAST },
              children: [
                cell(item.number === null ? "" : String(item.number), { centred: true }),
                cell(item.title, { unprinted: item.number === null }),
                cell(isIn(roles, member.id, item.id) ? "✓" : "", { centred: true }),
                // Left blank, to be filled in by hand (FR13).
                cell(""),
              ],
            }),
        ),
      ]),
    ],
  });

const sheetOf = (show: LatestShow, halves: SheetHalf[], member: CastMember, first: boolean) => {
  const details = detailsOf(member);
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: !first,
      children: [new TextRun({ text: show.order.title })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: `${member.firstName} ${member.lastName}` })],
    }),
    ...(details === "" ? [] : [new Paragraph({ children: [new TextRun({ text: details })] })]),
    itemsTable(halves, show.roles, member),
  ];
};

/** The Casting Sheets: a page per cast member, by section, then surname, then first name. */
export function castingSheetsDocument(show: LatestShow) {
  const members = castBySection(show.cast).flatMap((section) => section.members);
  const halves = halvesOf(show);
  return new Document({
    styles: wordStyles,
    title: `${show.order.title} casting sheets`,
    sections: [
      {
        properties: { page: { size: A4, margin: MARGIN } },
        children: members.flatMap((member, i) => sheetOf(show, halves, member, i === 0)),
      },
    ],
  });
}

/** The Casting Sheets as a .docx file. */
export const castingSheetsFile = (show: LatestShow) => Packer.toBlob(castingSheetsDocument(show));
