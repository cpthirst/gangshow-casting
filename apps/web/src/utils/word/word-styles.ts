import { unprintedHeadingColour } from "@app/shared";
import {
  AlignmentType,
  Header,
  ImageRun,
  type IStylesOptions,
  Paragraph,
  TableCell,
  TextRun,
} from "docx";
import logo from "@/assets/logo-small.jpg?inline";
import { itemHeading } from "@/utils/overview.ts";

// How the Word exports look: Word's default font, Aptos, with headings spaced more the
// higher they are, so the document reads like one made in Word today. Sizes are in
// half-points and spacing in twentieths of a point, as Word stores them.

const FONT = "Aptos";
/** Body text: 11 pt. */
const BODY_SIZE = 22;

/** One line of body text, in twentieths of a point: Word sets a line at about 1.2 times
 *  the text's size. */
export const LINE_HEIGHT = Math.round((BODY_SIZE / 2) * 1.2 * 20);

/** A4 portrait, in twentieths of a point. */
export const A4 = { width: 11906, height: 16838 };

/** A4 with inch margins, and the text width between them, so fixed column widths always
 *  match the page. */
export const MARGIN = { top: 1440, bottom: 1440, left: 1440, right: 1440 };
export const TEXT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

/** Column widths across a page's text width, from each column's percentage share. */
export const widthsOf = (textWidth: number, shares: number[]) =>
  shares.map((share) => Math.round((textWidth * share) / 100));

const heading = (size: number, before: number, after: number) => ({
  run: { font: FONT, size, bold: true },
  paragraph: { spacing: { before, after } },
});

export const wordStyles: IStylesOptions = {
  default: {
    document: { run: { font: FONT, size: BODY_SIZE }, paragraph: { spacing: { after: 120 } } },
    heading1: heading(36, 360, 200),
    heading2: heading(28, 280, 140),
    heading3: heading(24, 200, 100),
  },
};

/** Text in a table cell: no space after it, so rows stay as tall as they're set. */
export const CELL_SPACING = { after: 0 };

/** A table cell holding one line of plain text; rowSpan runs it down beside that many rows. */
export const cell = (text: string, { bold = false, rowSpan = 1 } = {}) =>
  new TableCell({
    rowSpan,
    children: [new Paragraph({ spacing: CELL_SPACING, children: [new TextRun({ text, bold })] })],
  });

/** An item's heading, as on screen: an unprinted item's title in the grid's red italics,
 *  then the badge's words. */
export const itemHeadingRuns = (item: { number: number | null; title: string }) =>
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

// Half the logo's 360 × 146 pixels: about 5 cm across.
const LOGO_SIZE = { width: 180, height: 73 };

/** The Chester Gang Show logo, on the left of every page's header. The image is inlined, so
 *  the document needs nothing from the network to be made. */
export const logoHeader = () =>
  new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new ImageRun({ type: "jpg", data: logo, transformation: LOGO_SIZE })],
      }),
    ],
  });
