import type { IStylesOptions } from "docx";

// How both Word exports look: Word's default font, Aptos, with headings spaced more the
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
