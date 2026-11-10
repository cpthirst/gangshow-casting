import { describe, expect, it, vi } from "vitest";
import { departmentPages } from "./departments.ts";
import { accessLabel, helpFor, pageHelp, whoCanChange } from "./help.ts";

// A shared list in which Tech, not Stage, shares the props with the Director.
vi.mock("@app/shared", async (importOriginal) => {
  const shared = await importOriginal<typeof import("@app/shared")>();
  const props = { ...shared.departments.props, permissions: ["tech", "director"] };
  return { ...shared, departments: { ...shared.departments, props } };
});

describe("Help's access labels", () => {
  it("name whoever the shared list says may change a department", () => {
    const propsPage = pageHelp.find(({ page }) => page === "props-item");
    const changing = propsPage?.lines.flatMap(({ access, changeAccess = access }) =>
      changeAccess === "everyone" ? [] : [accessLabel(changeAccess)],
    );

    expect(changing).toEqual(Array(4).fill("Accounts with Tech or Director, and admins"));
  });
});

describe("Who can change a page, in its Help", () => {
  it("names whoever the shared list says may change the page's department", () => {
    expect(whoCanChange(helpFor("props-item"))).toBe(
      "Only Tech, Director and admins can change the props.",
    );
  });

  it.each([
    ["casting-item", "Only Casting and admins can change the casting."],
    ["scenery-item", "Only Stage, Tech, Director and admins can change the scenery."],
    ["sfx-item", "Only Tech, Director and admins can change the SFX."],
    ["mic-plot-item", "Only Tech, Director and admins can change the mic plot."],
    ["wardrobe-item", "Only Wardrobe, Director and admins can change the wardrobe."],
  ])("names who can change the %s page", (page, line) => {
    expect(whoCanChange(helpFor(page))).toBe(line);
  });

  it("says only admins can change the running order, labelling each change Admins only", () => {
    const help = helpFor("running-order");
    const changing = help.lines.filter(({ access }) => access !== "everyone");

    expect(whoCanChange(help)).toBe("Only admins can change the running order.");
    expect(changing.length).toBeGreaterThan(0);
    for (const { access } of changing) expect(accessLabel(access)).toBe("Admins only");
  });

  it("says in the running order's summary that an admin saves the changes", () => {
    expect(helpFor("running-order").summary).toBe(
      "The show's items in the order they're performed. Changes stay on your screen until an admin saves them.",
    );
  });

  it("says nothing for a page no department owns", () => {
    expect(whoCanChange(helpFor("production-overview"))).toBeUndefined();
  });
});

describe("The department switch, in Help", () => {
  const switchLine = (page: string) =>
    helpFor(page).lines.find(({ name }) => name === "Departments");

  it.each(departmentPages.map(({ route }) => route))(
    "is on the %s page's Help, with every department's icon",
    (page) => {
      expect(switchLine(page)?.icons).toEqual(departmentPages.map(({ icon }) => icon));
    },
  );

  it("isn't on the Casting item page's Help", () => {
    expect(switchLine("casting-item")).toBeUndefined();
  });
});

describe("The Cast page's Help", () => {
  it("describes the Junior and the Senior gang", () => {
    const gang = helpFor("cast").lines.find(({ name }) => name === "Gang")?.does ?? "";

    for (const words of ["Junior", "Beavers", "Cubs", "Senior", "Scouts", "Explorers", "Network"])
      expect(gang).toContain(words);
    expect(gang).toMatch(/no section/);
  });
});
