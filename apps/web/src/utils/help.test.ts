import { describe, expect, it, vi } from "vitest";
import { accessLabel, pageHelp } from "./help.ts";

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
