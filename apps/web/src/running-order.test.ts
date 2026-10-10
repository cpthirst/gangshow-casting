import { describe, expect, it } from "vitest";
import { formatTime } from "./running-order.ts";

describe("formatTime", () => {
  it.each([
    [19 * 60 + 15, "7:15 pm"],
    [20 * 60 + 22, "8:22 pm"],
    [12 * 60 + 5, "12:05 pm"],
    [9 * 60, "9:00 am"],
    [0, "12:00 am"],
    [24 * 60 + 10, "12:10 am"],
  ])("shows %i minutes after midnight as %s", (minutes, expected) => {
    expect(formatTime(minutes)).toBe(expected);
  });
});
