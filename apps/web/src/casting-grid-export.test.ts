import { describe, expect, it } from "vitest";
import { exportFileName } from "./casting-grid-export.ts";

describe("exportFileName", () => {
  it("names the file for the production and the date", () => {
    expect(exportFileName("Gang Show 2027", new Date(2027, 2, 12))).toBe(
      "Gang Show 2027 casting grid 2027-03-12.xlsx",
    );
  });

  it("uses the day on the user's clock, not UTC's", () => {
    // Just after midnight in the evening's time zone is still the same local day.
    expect(exportFileName("Show", new Date(2027, 11, 1, 0, 30))).toBe(
      "Show casting grid 2027-12-01.xlsx",
    );
  });

  it("swaps characters a file name can't hold for a space", () => {
    expect(exportFileName('Pirates: "The/Show"?', new Date(2027, 0, 5))).toBe(
      "Pirates The Show casting grid 2027-01-05.xlsx",
    );
  });
});
