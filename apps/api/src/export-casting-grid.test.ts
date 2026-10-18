import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { exportCastingGrid } from "./export-casting-grid.ts";
import { readSheet, sheetXml } from "./xlsx.fixture.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const grid = {
  items: ["1.1 · Opening Number", "1.2 · Pirate Sketch", "2.1 · Dance One"],
  rows: [
    { firstName: "Sam", lastName: "Example", section: "Scouts", cells: [null, "L", "C"] },
    { firstName: "Alex", lastName: "Sample", section: "Explorers", cells: ["S", null, "E"] },
    { firstName: "Jo", lastName: "Newcomer", section: "Scouts", cells: [null, null, null] },
  ],
};

const request = (body: unknown, productionId = "2027") => ({
  pathParameters: { productionId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

/** The file in a 200 response: API Gateway sends a binary body as base64. */
const fileIn = (res: APIGatewayProxyStructuredResultV2) => {
  expect(res.isBase64Encoded).toBe(true);
  return new Uint8Array(Buffer.from(res.body ?? "", "base64"));
};

describe("export casting grid handler", () => {
  it("returns an Excel file", async () => {
    const res = await exportCastingGrid(request(grid));

    expect(res.statusCode).toBe(200);
    expect(res.headers?.["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    // An .xlsx is a zip, which starts with "PK".
    expect(Buffer.from(fileIn(res)).subarray(0, 2).toString()).toBe("PK");
  });

  it("puts first name, last name and section first, then a column per item in order", async () => {
    const sheet = readSheet(fileIn(await exportCastingGrid(request(grid))));

    expect(sheet[0]).toEqual([
      "First name",
      "Last name",
      "Section",
      "1.1 · Opening Number",
      "1.2 · Pirate Sketch",
      "2.1 · Dance One",
    ]);
  });

  it("has a row per person, in the order sent", async () => {
    const sheet = readSheet(fileIn(await exportCastingGrid(request(grid))));

    expect(sheet.slice(1).map((row) => row.slice(0, 3))).toEqual([
      ["Sam", "Example", "Scouts"],
      ["Alex", "Sample", "Explorers"],
      ["Jo", "Newcomer", "Scouts"],
    ]);
  });

  it("holds the role-size letter in a filled cell and nothing in an empty one", async () => {
    const sheet = readSheet(fileIn(await exportCastingGrid(request(grid))));

    expect(sheet.slice(1).map((row) => row.slice(3))).toEqual([
      ["", "L", "C"],
      ["S", "", "E"],
      ["", "", ""],
    ]);
  });

  it("writes a name that looks like a formula as plain text, never a formula", async () => {
    const sneaky = {
      items: ["1.1 · Opening Number"],
      rows: [{ firstName: "=1+1", lastName: "@SUM(A1)", section: "Scouts", cells: ["L"] }],
    };

    const file = fileIn(await exportCastingGrid(request(sneaky)));

    expect(readSheet(file)[1]?.slice(0, 2)).toEqual(["=1+1", "@SUM(A1)"]);
    expect(sheetXml(file)).not.toContain("<f>");
  });

  it("makes a file for a show with no cast yet: just the headings", async () => {
    const empty = { items: ["1.1 · Opening Number"], rows: [] };

    const sheet = readSheet(fileIn(await exportCastingGrid(request(empty))));

    expect(sheet).toEqual([["First name", "Last name", "Section", "1.1 · Opening Number"]]);
  });

  it.each([
    ["a group", { group: "1st Somewhere" }],
    ["casting notes", { singing: "Strong alto" }],
    ["a role name", { roleName: "Captain Hook" }],
  ])("refuses a row that carries %s with 400, returning no file", async (_name, extra) => {
    const res = await exportCastingGrid(
      request({ ...grid, rows: [{ ...grid.rows[0], ...extra }] }),
    );

    expect(res.statusCode).toBe(400);
    expect(res.isBase64Encoded).toBeUndefined();
  });

  it.each([
    ["not JSON", "{nope"],
    ["empty", ""],
    ["a row with a missing cell", { ...grid, rows: [{ ...grid.rows[0], cells: ["L"] }] }],
  ])("refuses a body that is %s with 400", async (_name, body) => {
    expect((await exportCastingGrid(request(body))).statusCode).toBe(400);
  });

  it("returns 404 for a production id that can't be one", async () => {
    expect((await exportCastingGrid(request(grid, "../etc"))).statusCode).toBe(404);
  });
});
