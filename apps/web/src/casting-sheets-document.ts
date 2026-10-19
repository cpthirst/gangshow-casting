import type { CastMember, Role } from "@app/shared";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  HeightRule,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { sectionLabel } from "./cast.ts";
import type { LatestShow } from "./latest-show.ts";
import { castBySection, itemHeading } from "./overview.ts";
import { runningClock } from "./running-order.ts";
import { CELL_SPACING, wordStyles } from "./word-styles.ts";

// A casting sheet for every cast member, to print and hand out (casting-overview-by-item
// FR9–FR13): one page each, headed with the show and who it's for, then the printed
// programme with a tick where they're in an item and room to note costume from home. Only
// their name, section and group: a sheet handed to a young person shows nobody else's
// details (ADR 0022).

// In twentieths of a point. A4 with half-inch margins top and bottom, and item rows 0.7 cm
// tall, room to write in: 30 items and the headings fit one page (FR12).
const A4 = { width: 11906, height: 16838 };
const MARGIN = { top: 720, bottom: 720, left: 1080, right: 1080 };
const ITEM_ROW_HEIGHT = 397;

const COLUMNS = [
  { name: "Item Name", width: 60 },
  { name: "Am I cast", width: 15 },
  { name: "Costume from home", width: 25 },
];

/** "Scouts · 1st Anytown", leaving out whatever isn't set: never the screen's "Not set" on
 *  a sheet handed to a young person. */
const detailsOf = ({ section, group }: CastMember) =>
  [section === null ? "" : sectionLabel(section), group].filter((part) => part !== "").join(" · ");

const cell = (text: string, options: { bold?: boolean; centred?: boolean; span?: number } = {}) =>
  new TableCell({
    columnSpan: options.span ?? 1,
    children: [
      new Paragraph({
        alignment: options.centred ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: CELL_SPACING,
        children: [new TextRun({ text, bold: options.bold ?? false })],
      }),
    ],
  });

/** The printed programme, half by half: what every sheet lists. */
/** One half of the printed programme, as every sheet lists it. */
interface PrintedHalf {
  name: string;
  items: { id: string; heading: string }[];
}

const printedHalves = (show: LatestShow): PrintedHalf[] =>
  runningClock(show.order).halves.map(({ half, rows }) => ({
    name: half.name,
    items: rows
      .filter(({ number }) => number !== null)
      .map(({ item, number }) => ({
        id: item.id,
        heading: itemHeading({ number, title: item.title }),
      })),
  }));

const isIn = (roles: Role[], memberId: number, itemId: string) =>
  roles.some((role) => role.itemId === itemId && role.castMemberIds.includes(memberId));

const itemsTable = (halves: PrintedHalf[], roles: Role[], member: CastMember) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: COLUMNS.map(({ width }) =>
      Math.round(((A4.width - MARGIN.left - MARGIN.right) * width) / 100),
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
                cell(item.heading),
                cell(isIn(roles, member.id, item.id) ? "✓" : "", { centred: true }),
                // Left blank, to be filled in by hand (FR13).
                cell(""),
              ],
            }),
        ),
      ]),
    ],
  });

const sheetOf = (show: LatestShow, halves: PrintedHalf[], member: CastMember, first: boolean) => {
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
  const halves = printedHalves(show);
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
