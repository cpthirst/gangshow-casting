import { describe, expect, it, vi } from "vitest";
import { featureName, whatHappened } from "./usage-report.ts";

// A shared list that calls the mic plot "Radio mics".
vi.mock("@app/shared", async (importOriginal) => {
  const shared = await importOriginal<typeof import("@app/shared")>();
  const micPlot = { ...shared.departments["mic-plot"], name: "Radio mics" };
  return { ...shared, departments: { ...shared.departments, "mic-plot": micPlot } };
});

const titles = { page: () => "", item: () => undefined };

describe("the Usage page's department names", () => {
  it("follow the shared list's name for a department, in the activity and the totals", () => {
    const visit = { event: "mic-plot", productionId: "2027", itemId: "cut-sketch" } as const;

    expect(whatHappened(visit, titles)).toBe(
      "opened a Radio mics page of an item no longer in the running order",
    );
    expect(featureName("mic-plot-page", () => "")).toBe("Radio mics pages");
  });
});
