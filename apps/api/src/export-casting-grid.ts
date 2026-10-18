import { CastingGridExportRequest, ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import writeExcelFile from "write-excel-file/node";
import type { ApiEvent } from "./handler.ts";
import { parseJson } from "./json.ts";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The grid as sheet rows: a bold heading row, then a row per person. Text goes in as text,
 *  so a name that looks like a formula stays a name. */
function sheetOf({ items, rows }: CastingGridExportRequest) {
  const heading = ["First name", "Last name", "Section", ...items].map((value) => ({
    value,
    fontWeight: "bold" as const,
  }));
  return [
    heading,
    ...rows.map(({ firstName, lastName, section, cells }) => [
      firstName,
      lastName,
      section,
      ...cells,
    ]),
  ];
}

// POST /api/productions/{productionId}/casting-grid/export: the grid the admin sees as an
// Excel file (ADR 0019). Admin-only, which the entry point enforces before this runs
// (ADR 0018); the strict body holds only names, section, item headings and role letters.
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
