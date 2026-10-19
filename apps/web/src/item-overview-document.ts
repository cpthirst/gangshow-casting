import { unprintedHeadingColour } from "@app/shared";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { itemHeading, type ShowHalf, type ShowItem } from "./overview.ts";
import { roleSizeLabel } from "./roles.ts";
import { A4, CELL_SPACING, widthsOf, wordStyles } from "./word-styles.ts";

// The By item view as a Word document (casting-overview-by-item FR8): the production's title,
// each half and each item as Word headings, so Word's navigation pane lists them, and each
// item's roles as a table. Text goes in as plain runs, never as markup (ADR 0022).

// Each column's share of the page: the cast gets most of it, as an ensemble lists many names.
const ROLE_COLUMNS = [
  { name: "Role name", share: 25 },
  { name: "Role type", share: 15 },
  { name: "Cast", share: 60 },
];
// A4 with inch margins, set here so the fixed column widths always match the page.
const MARGIN = { top: 1440, bottom: 1440, left: 1440, right: 1440 };
const TEXT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

const cell = (text: string, bold = false) =>
  new TableCell({
    children: [new Paragraph({ spacing: CELL_SPACING, children: [new TextRun({ text, bold })] })],
  });

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
        children: ROLE_COLUMNS.map(({ name }) => cell(name, true)),
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

// As on screen: an unprinted item's title in the grid's red italics, then the badge's words.
const headingRuns = (item: ShowItem) =>
  item.number === null
    ? [
        new TextRun({
          text: item.title,
          italics: true,
          color: unprintedHeadingColour.slice(1).toUpperCase(),
        }),
        new TextRun({ text: " · Not in printed programme" }),
      ]
    : [new TextRun({ text: itemHeading(item) })];

const itemBlocks = (item: ShowItem) => [
  new Paragraph({ heading: HeadingLevel.HEADING_3, children: headingRuns(item) }),
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
