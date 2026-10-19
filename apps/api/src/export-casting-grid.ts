import {
  CastingGridExportRequest,
  gridLetterColours,
  gridTextColour,
  ProductionId,
  unprintedHeadingColour,
} from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import writeExcelFile from "write-excel-file/node";
import type { ApiEvent } from "./handler.ts";
import { parseJson } from "./json.ts";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const bold = (value: string) => ({ value, fontWeight: "bold" as const });

// An item's column is 60 pixels wide: Excel stores a width in its own units, and at its
// default font 60 pixels is 8.57 of them (60 / 7).
const ITEM_COLUMN_WIDTH = 8.57;
// Excel's tallest row, in points: a heading longer than about 400 points of text is cut short.
const TALLEST_ROW = 409;
// Room above and below the text, in points.
const ROW_PADDING = 10;

// Roughly how wide each character is in bold 11 pt Calibri, in points. The file names no
// font, so Excel uses its own default (Calibri, or the slightly narrower Aptos Narrow in
// newer Excel). The estimate errs wide, with Calibri's wider letters and some padding, so a
// heading is rarely cut short; letters outside the table count as an average one.
const NARROW = new Set("iljI.,:;'!|·()[]");
const MEDIUM = new Set("frtJ-");
const WIDE = new Set("mwMW");
const characterWidth = (character: string) => {
  if (character === " ") return 2.5;
  if (NARROW.has(character)) return 2.8;
  if (MEDIUM.has(character)) return 3.9;
  if (WIDE.has(character)) return 9.8;
  if (character >= "A" && character <= "Z") return 6.5;
  return 5.6;
};

/** How long a heading's text runs, in points: its height once turned to read upwards. */
const textLength = (text: string) =>
  [...text].reduce((length, character) => length + characterWidth(character), 0);

/** Just tall enough for the longest item heading to read upwards, within Excel's limit. */
const headingRowHeight = (items: CastingGridExportRequest["items"]) =>
  Math.min(
    TALLEST_ROW,
    Math.ceil(Math.max(0, ...items.map(({ heading }) => textLength(heading))) + ROW_PADDING),
  );

/** The grid as sheet rows: a bold heading row, with each item's heading turned to read
 *  upwards (one left out of the printed programme in red italics), then a row per person with
 *  each role letter on its dot's fill. Text goes in as text, so a name that looks like a
 *  formula stays a name. */
function sheetOf({ items, rows }: CastingGridExportRequest) {
  const height = headingRowHeight(items);
  const heading = [
    // write-excel-file takes a row's height from its first cell.
    { ...bold("First name"), height },
    bold("Last name"),
    bold("Section"),
    ...items.map(({ heading, printed }) => ({
      ...bold(heading),
      textRotation: 90,
      align: "center" as const,
      alignVertical: "bottom" as const,
      ...(printed ? {} : { fontStyle: "italic" as const, textColor: unprintedHeadingColour }),
    })),
  ];
  return [
    heading,
    ...rows.map(({ firstName, lastName, section, cells }) => [
      firstName,
      lastName,
      section,
      ...cells.map((letter) =>
        letter === null
          ? null
          : {
              value: letter,
              backgroundColor: gridLetterColours[letter],
              textColor: gridTextColour,
              align: "center" as const,
            },
      ),
    ]),
  ];
}

// POST /api/productions/{productionId}/casting-grid/export: the grid the page sends, as an
// Excel file (ADR 0019). Open to every signed-in role, as it changes nothing (ADR 0021); the
// strict body holds only names, section, item headings and role letters.
export async function exportCastingGrid(
  event: ApiEvent,
): Promise<APIGatewayProxyStructuredResultV2> {
  const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
  if (!productionId.success) return { statusCode: 404 };
  const grid = CastingGridExportRequest.safeParse(parseJson(event.body));
  if (!grid.success) return { statusCode: 400 };

  // The name columns keep Excel's own width; each item's is fixed.
  const columns = [{}, {}, {}, ...grid.data.items.map(() => ({ width: ITEM_COLUMN_WIDTH }))];
  const file = await writeExcelFile(sheetOf(grid.data), { columns }).toBuffer();
  return {
    statusCode: 200,
    headers: { "content-type": XLSX },
    // API Gateway wants a binary body as base64.
    body: file.toString("base64"),
    isBase64Encoded: true,
  };
}
