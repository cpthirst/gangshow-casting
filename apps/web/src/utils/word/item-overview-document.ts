import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ShowHalf, ShowItem } from "@/utils/overview.ts";
import { roleSizeLabel } from "@/utils/roles.ts";
import {
  A4,
  cell,
  itemHeadingRuns,
  logoHeader,
  MARGIN,
  TEXT_WIDTH,
  widthsOf,
  wordStyles,
} from "./word-styles.ts";

// The By item view as a Word document (casting-overview-by-item FR8): the production's title,
// each half and each item as Word headings, so Word's navigation pane lists them, and each
// item's roles as a table. Text goes in as plain runs, never as markup (ADR 0022).

// Each column's share of the page: the cast gets most of it, as an ensemble lists many names.
const ROLE_COLUMNS = [
  { name: "Role name", share: 25 },
  { name: "Role type", share: 15 },
  { name: "Cast", share: 60 },
];
const rolesTable = (roles: ShowItem["roles"]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // Fixed, so Word keeps these widths rather than fitting each table to its text.
    layout: TableLayoutType.FIXED,
    columnWidths: widthsOf(
      TEXT_WIDTH,
      ROLE_COLUMNS.map(({ share }) => share),
    ),
    rows: [
      // Repeated at the top of each page the table runs onto.
      new TableRow({
        tableHeader: true,
        children: ROLE_COLUMNS.map(({ name }) => cell(name, { bold: true })),
      }),
      ...roles.map(
        (role) =>
          new TableRow({
            children: [
              cell(role.name),
              cell(roleSizeLabel(role.size)),
              cell(
                role.cast.length === 0
                  ? "Uncast"
                  : role.cast.map((member) => member.name).join(", "),
              ),
            ],
          }),
      ),
    ],
  });

const itemBlocks = (item: ShowItem) => [
  new Paragraph({ heading: HeadingLevel.HEADING_3, children: itemHeadingRuns(item) }),
  item.roles.length === 0
    ? new Paragraph({ children: [new TextRun({ text: "No roles have been added yet." })] })
    : rolesTable(item.roles),
];

/** The Item Overview: what the By item view shows, as a Word document. */
export const itemOverviewDocument = (title: string, halves: ShowHalf[]) =>
  new Document({
    title,
    styles: wordStyles,
    sections: [
      {
        properties: { page: { size: A4, margin: MARGIN } },
        headers: { default: logoHeader() },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: title })],
          }),
          ...halves.flatMap((half) => [
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: half.name })],
            }),
            ...half.items.flatMap(itemBlocks),
          ]),
        ],
      },
    ],
  });

/** The Item Overview as a .docx file. */
export const itemOverviewFile = (title: string, halves: ShowHalf[]) =>
  Packer.toBlob(itemOverviewDocument(title, halves));
