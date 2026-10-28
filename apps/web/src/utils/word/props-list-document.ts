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
import type { PropsListHalf, PropsListItem } from "@/utils/props.ts";
import {
  A4,
  CELL_SPACING,
  cell,
  itemHeadingRuns,
  logoHeader,
  MARGIN,
  TEXT_WIDTH,
  widthsOf,
  wordStyles,
} from "./word-styles.ts";

// The props list (production-props FR22, FR23): the production's title, each half and each item
// as Word headings, as in the Item Overview, with each item's props notes and a table of its
// props, their quantities and carriers (FR29). Text goes in as plain runs, never as markup
// (ADR 0022).

// Qty is narrow, so the table still fits a portrait page.
const PROP_COLUMNS = [
  { name: "Prop", share: 34 },
  { name: "Qty", share: 8 },
  { name: "Character", share: 29 },
  { name: "Cast", share: 29 },
];

const line = (text: string, emphasis = false) =>
  new Paragraph({
    spacing: CELL_SPACING,
    children: [new TextRun({ text, bold: emphasis, italics: emphasis })],
  });

/** The prop's name, with what's left to sort out about its carriers on lines below it, in
 *  bold italics so they stand out, as they do in red on the card. */
const propCell = (name: string, notes: string[], rowSpan: number) =>
  new TableCell({
    rowSpan,
    children: [line(name), ...notes.map((note) => line(note, true))],
  });

/** One row per character, the prop's and quantity's cells running down beside them all; a
 *  prop with no characters has a row with empty Character and Cast cells. */
const propRows = ({ name, quantity, roles, notes }: PropsListItem["props"][number]) => {
  const rowSpan = Math.max(1, roles.length);
  const propCells = [propCell(name, notes, rowSpan), cell(String(quantity), { rowSpan })];
  const [first, ...rest] = roles;
  if (!first) return [new TableRow({ children: [...propCells, cell(""), cell("")] })];
  return [
    new TableRow({ children: [...propCells, cell(first.name), cell(first.cast)] }),
    ...rest.map((role) => new TableRow({ children: [cell(role.name), cell(role.cast)] })),
  ];
};

const propsTable = (props: PropsListItem["props"]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // Fixed, so Word keeps these widths rather than fitting each table to its text.
    layout: TableLayoutType.FIXED,
    columnWidths: widthsOf(
      TEXT_WIDTH,
      PROP_COLUMNS.map(({ share }) => share),
    ),
    rows: [
      // Repeated at the top of each page the table runs onto.
      new TableRow({
        tableHeader: true,
        children: PROP_COLUMNS.map(({ name }) => cell(name, { bold: true })),
      }),
      ...props.flatMap(propRows),
    ],
  });

// Notes keep the line breaks they were typed with.
const notesParagraph = (notes: string) =>
  new Paragraph({
    children: notes
      .split(/\r?\n/)
      .map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : 0 })),
  });

const itemBlocks = (item: PropsListItem) => [
  new Paragraph({ heading: HeadingLevel.HEADING_3, children: itemHeadingRuns(item) }),
  ...(item.notes === "" ? [] : [notesParagraph(item.notes)]),
  item.props.length === 0
    ? new Paragraph({ children: [new TextRun({ text: "No props" })] })
    : propsTable(item.props),
];

/** The whole show's props list, as a Word document. */
export const propsListDocument = (title: string, halves: PropsListHalf[]) =>
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

/** The props list as a .docx file. */
export const propsListFile = (title: string, halves: PropsListHalf[]) =>
  Packer.toBlob(propsListDocument(title, halves));
