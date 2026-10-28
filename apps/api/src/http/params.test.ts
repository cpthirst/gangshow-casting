import { describe, expect, it } from "vitest";
import { productionIdOf, wholeNumber } from "./params.ts";

describe("productionIdOf", () => {
  it("gives the path's production id", () => {
    expect(productionIdOf({ pathParameters: { productionId: "2027" } })).toBe("2027");
  });

  it.each([
    ["no path parameters", {}],
    ["no production id", { pathParameters: {} }],
    [
      "an id that could reach outside the data folder",
      { pathParameters: { productionId: "../etc" } },
    ],
  ])("gives nothing for %s", (_, event) => {
    expect(productionIdOf(event)).toBeUndefined();
  });
});

describe("wholeNumber", () => {
  it("reads a positive whole number", () => {
    expect(wholeNumber("42")).toBe(42);
  });

  it.each(["0", "-1", "1.5", "042", "1234567890", "", undefined])("refuses %s", (text) => {
    expect(wholeNumber(text)).toBeUndefined();
  });
});
