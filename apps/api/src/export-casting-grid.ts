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

/** The grid as sheet rows: a bold heading row (an item left out of the printed programme in
 *  red italics), then a row per person with each role letter on its dot's fill. Text goes in
 *  as text, so a name that looks like a formula stays a name. */
function sheetOf({ items, rows }: CastingGridExportRequest) {
  const heading = [
    bold("First name"),
    bold("Last name"),
    bold("Section"),
    ...items.map(({ heading, printed }) =>
      printed
        ? bold(heading)
        : { ...bold(heading), fontStyle: "italic" as const, textColor: unprintedHeadingColour },
    ),
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

  const file = await writeExcelFile(sheetOf(grid.data)).toBuffer();
  return {
    statusCode: 200,
    headers: { "content-type": XLSX },
    // API Gateway wants a binary body as base64.
    body: file.toString("base64"),
    isBase64Encoded: true,
  };
}
