import { describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import { useConfirm } from "@/composables/useConfirm.ts";
import { createAppRouter, isAdminOnlyPage, isMenuGroup, menuFor, menuPages } from "./index.ts";

const page = (name: string, adminOnly?: true) => ({
  path: `/${name}`,
  name,
  component: { render: () => null },
  meta: { title: name },
  ...(adminOnly && { adminOnly }),
});
const group = (name: string, ...pages: ReturnType<typeof page>[]) => ({
  name,
  title: name,
  pages,
});

const namesIn = (entries: ReturnType<typeof menuFor>) =>
  entries.map((entry) =>
    isMenuGroup(entry) ? [entry.name, entry.pages.map(({ name }) => name)] : entry.name,
  );

describe("the menu each person sees", () => {
  const entries = [
    page("open"),
    page("secret", true),
    group("mixed", page("open-inside"), page("secret-inside", true)),
    group("all-secret", page("secret-one", true), page("secret-two", true)),
  ];

  it("gives an admin every page and group", () => {
    expect(namesIn(menuFor(true, entries))).toEqual([
      "open",
      "secret",
      ["mixed", ["open-inside", "secret-inside"]],
      ["all-secret", ["secret-one", "secret-two"]],
    ]);
  });

  it("leaves out admin-only pages for anyone else, inside a group too", () => {
    expect(namesIn(menuFor(false, entries))).toEqual(["open", ["mixed", ["open-inside"]]]);
  });

  it("leaves out a group with nothing left to show, rather than an empty label", () => {
    const groups = menuFor(false, entries).filter(isMenuGroup);

    expect(groups.map(({ name }) => name)).not.toContain("all-secret");
  });
});

describe("the menu's pages", () => {
  const pageNames = (admin: boolean) =>
    menuFor(admin).flatMap((entry) =>
      (isMenuGroup(entry) ? entry.pages : [entry]).map(({ name }) => name),
    );

  it("gives anyone but an admin every page outside Admin, in order", () => {
    expect(pageNames(false)).toEqual([
      "welcome",
      "running-order",
      "cast",
      "casting-overview",
      "casting-items",
      "production-overview",
      "cast-flow",
      "help",
    ]);
  });
});

describe("the Production group", () => {
  it.each([
    ["an admin", true],
    ["anyone else", false],
  ])("lists Overview, then Cast flow, to %s", (_who, admin) => {
    const production = menuFor(admin).find((entry) => entry.name === "production");

    expect(production).toMatchObject({
      pages: [
        { name: "production-overview", meta: { title: "Overview" } },
        { name: "cast-flow", path: "/production/cast-flow", meta: { title: "Cast flow" } },
      ],
    });
  });
});

describe("the Admin group", () => {
  it("holds Accounts, Productions and Usage, in that order, at their addresses", () => {
    const admin = menuPages.find((entry) => isMenuGroup(entry) && entry.name === "admin");

    expect(admin).toMatchObject({
      title: "Admin",
      pages: [
        { name: "accounts", path: "/admin/accounts", meta: { title: "Accounts" } },
        { name: "productions", path: "/admin/productions", meta: { title: "Productions" } },
        { name: "usage", path: "/admin/usage", meta: { title: "Usage" } },
      ],
    });
  });

  it.each(["accounts", "productions", "usage"])("counts %s as admin-only", (name) => {
    expect(isAdminOnlyPage(name)).toBe(true);
  });

  it("doesn't count a page everyone can open as admin-only", () => {
    expect(isAdminOnlyPage("cast")).toBe(false);
  });
});

describe("addresses", () => {
  const arrivingAt = async (path: string) => {
    const router = createAppRouter(createMemoryHistory());
    await router.push(path);
    return router.currentRoute.value;
  };

  it.each([
    ["/accounts", "/admin/accounts", "accounts"],
    ["/usage", "/admin/usage", "usage"],
    ["/admin", "/admin/accounts", "accounts"],
  ])("sends %s to %s", async (from, path, name) => {
    expect(await arrivingAt(from)).toMatchObject({ path, name });
  });

  it("has no old address for Productions, which was never released there", async () => {
    expect((await arrivingAt("/productions")).name).toBe("not-found");
  });
});

describe("a question left open", () => {
  it("is cancelled when the page changes, so a yes never acts on the page that's gone", async () => {
    const router = createAppRouter(createMemoryHistory());
    await router.push("/admin/productions");
    const deleteProduction = vi.fn();
    const answered = useConfirm()("Delete production 2027?", "Delete production").then(
      (yes) => yes && deleteProduction(),
    );

    await router.push("/cast");

    await expect(answered).resolves.toBe(false);
    expect(deleteProduction).not.toHaveBeenCalled();
  });
});
