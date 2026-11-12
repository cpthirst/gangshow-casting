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
import type { LatestCostumeSheets, LatestShow } from "@/services/latest-show.ts";
import { sectionLabel } from "@/utils/cast.ts";
import { costumeOf } from "@/utils/costumes.ts";
import { castBySection } from "@/utils/overview.ts";
import { sortRoles } from "@/utils/roles.ts";
import { runningClock } from "@/utils/running-order.ts";
import {
  A4,
  CELL_SPACING,
  LINE_HEIGHT,
  logoHeader,
  SMALL_LOGO,
  widthsOf,
  wordStyles,
} from "./word-styles.ts";

// A sheet for every cast member, to print and hand out, in two kinds that share one layout:
// one each, starting on a new page, headed with the show and who it's for, then every item.
// The casting sheets tick the items they're in (casting-overview-by-item FR9–FR13, as amended
// by production-costume-sheets FR12); the costume sheets give their role and costume in each
// (production-costume-sheets FR10, FR11). Only their name, section and group: a sheet handed
// to a young person shows nobody else's details (ADR 0022).

// In twentieths of a point. A4 with narrow margins, and item rows two lines of text tall.
// A long show carries on over the page, header row repeated. The logo is small and a
// quarter inch from the top, so it takes little room from the items.
const MARGIN = { top: 720, bottom: 720, left: 1080, right: 1080, header: 360 };
const ITEM_ROW_HEIGHT = 2 * LINE_HEIGHT;

interface Column {
  name: string;
  /** Its percentage of the table's width. */
  share: number;
  centred?: boolean;
}

/** What one kind of sheet says about a person's items. */
interface SheetKind<Show extends LatestShow> {
  /** What the document holds, for its title: "casting sheets". */
  holds: string;
  /** Every column, # and Item Name first. */
  columns: Column[];
  /** The cells after # and Item Name for the person in the item: a row each, at least one. */
  rowsFor: (show: Show, member: CastMember, itemId: string) => CellText[][];
}

/** A line of a cell's text. */
interface Line {
  text: string;
  italic?: boolean;
}

/** A cell's text: one plain line, or several lines set as they say. */
type CellText = string | Line[];

const TICK = "✓";
const NUMBER: Column = { name: "#", share: 7, centred: true };
/** Where Item Name is in every kind's columns: second, after #. */
const ITEM_NAME_COLUMN = 1;
const itemName = (share: number): Column => ({ name: "Item Name", share });

/** The roles the person holds in the item. */
const rolesHeld = (roles: Role[], member: CastMember, itemId: string) =>
  roles.filter((role) => role.itemId === itemId && role.castMemberIds.includes(member.id));

const castingSheets: SheetKind<LatestShow> = {
  holds: "casting sheets",
  columns: [NUMBER, itemName(83), { name: "Cast", share: 10, centred: true }],
  rowsFor: (show, member, itemId) => [
    [rolesHeld(show.roles, member, itemId).length > 0 ? TICK : ""],
  ],
};

/** A row for each role the person holds in the item, in its role order: a tick over the
 *  role's name, as "(Narrator)" in italics, then what they wear in it; never the costume's
 *  notes, which are Wardrobe's own. */
const costumeSheets: SheetKind<LatestCostumeSheets> = {
  holds: "costume sheets",
  columns: [
    NUMBER,
    itemName(28),
    { name: "Role", share: 19, centred: true },
    { name: "From Wardrobe", share: 25 },
    { name: "From Cast Member", share: 21 },
  ],
  rowsFor: (show, member, itemId) => {
    const held = rolesHeld(show.roles, member, itemId);
    if (held.length === 0) return [["", "", ""]];
    return sortRoles(held).map((role) => {
      const { fromWardrobe, fromCastMember } = costumeOf(show.costumes, role, member);
      const tickedRole = [{ text: TICK }, { text: `(${role.name})`, italic: true }];
      return [tickedRole, fromWardrobe, fromCastMember];
    });
  },
};

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

const cell = (content: CellText, options: CellOptions = {}) =>
  new TableCell({
    columnSpan: options.span ?? 1,
    children: (typeof content === "string" ? [{ text: content }] : content).map(
      ({ text, italic }) =>
        new Paragraph({
          alignment: options.centred ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: CELL_SPACING,
          children: [
            new TextRun({
              text,
              bold: options.bold ?? false,
              ...(italic ? { italics: true } : {}),
              ...(options.unprinted
                ? { italics: true, color: unprintedHeadingColour.slice(1).toUpperCase() }
                : {}),
            }),
          ],
        }),
    ),
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

function itemsTable<Show extends LatestShow>(
  kind: SheetKind<Show>,
  show: Show,
  halves: SheetHalf[],
  member: CastMember,
) {
  const { columns } = kind;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // Fixed, so Word keeps these widths rather than fitting the table to its text.
    layout: TableLayoutType.FIXED,
    columnWidths: widthsOf(
      A4.width - MARGIN.left - MARGIN.right,
      columns.map(({ share }) => share),
    ),
    rows: [
      new TableRow({
        tableHeader: true,
        children: columns.map(({ name }) => cell(name, { bold: true })),
      }),
      ...halves.flatMap((half) => [
        new TableRow({ children: [cell(half.name, { bold: true, span: columns.length })] }),
        ...half.items.flatMap((item) =>
          kind.rowsFor(show, member, item.id).map(
            (cells) =>
              new TableRow({
                height: { value: ITEM_ROW_HEIGHT, rule: HeightRule.ATLEAST },
                children: [
                  item.number === null ? "" : String(item.number),
                  item.title,
                  ...cells,
                ].map((content, i) =>
                  cell(content, {
                    centred: columns[i]?.centred ?? false,
                    unprinted: i === ITEM_NAME_COLUMN && item.number === null,
                  }),
                ),
              }),
          ),
        ),
      ]),
    ],
  });
}

function sheetOf<Show extends LatestShow>(
  kind: SheetKind<Show>,
  show: Show,
  halves: SheetHalf[],
  member: CastMember,
  first: boolean,
) {
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
    itemsTable(kind, show, halves, member),
  ];
}

/** A page per cast member, by section, then surname, then first name. */
function sheetsDocument<Show extends LatestShow>(kind: SheetKind<Show>, show: Show) {
  const members = castBySection(show.cast).flatMap((section) => section.members);
  const halves = halvesOf(show);
  return new Document({
    styles: wordStyles,
    title: `${show.order.title} ${kind.holds}`,
    sections: [
      {
        properties: { page: { size: A4, margin: MARGIN } },
        headers: { default: logoHeader(SMALL_LOGO) },
        children: members.flatMap((member, i) => sheetOf(kind, show, halves, member, i === 0)),
      },
    ],
  });
}

/** The Casting Sheets: a tick for each item the person is in. */
export const castingSheetsDocument = (show: LatestShow) => sheetsDocument(castingSheets, show);

/** The Costume Sheets: the person's role and costume in each item. */
export const costumeSheetsDocument = (show: LatestCostumeSheets) =>
  sheetsDocument(costumeSheets, show);

/** The Casting Sheets as a .docx file. */
export const castingSheetsFile = (show: LatestShow) => Packer.toBlob(castingSheetsDocument(show));

/** The Costume Sheets as a .docx file. */
export const costumeSheetsFile = (show: LatestCostumeSheets) =>
  Packer.toBlob(costumeSheetsDocument(show));
