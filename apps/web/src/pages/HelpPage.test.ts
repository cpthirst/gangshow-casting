import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { icons } from "@/utils/icons.ts";
import HelpPage from "./HelpPage.vue";

async function openHelp() {
  const router = createAppRouter(createMemoryHistory());
  await router.push("/help");
  await router.isReady();
  const wrapper = mount(HelpPage, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

const ACCESS_LABELS = [
  "Everyone",
  "Accounts with Casting, and admins",
  "Accounts with Stage, and admins",
  "Admins only",
];

type Wrapper = Awaited<ReturnType<typeof openHelp>>["wrapper"];

const sectionFor = (wrapper: Wrapper, page: string) =>
  wrapper.get(`section[aria-labelledby='help-${page}']`);

const runningOrder = (wrapper: Wrapper) => sectionFor(wrapper, "running-order");

const lines = (wrapper: Wrapper, page = "running-order") =>
  sectionFor(wrapper, page).findAll("[data-test=help-line]");

const lineNamed = (wrapper: Wrapper, name: string, page = "running-order") => {
  const found = lines(wrapper, page).find(
    (line) => line.get("[data-test=help-name]").text() === name,
  );
  if (!found) throw new Error(`No help line named ${name}`);
  return found;
};

const accessOf = (wrapper: Wrapper, name: string, page = "running-order") =>
  lineNamed(wrapper, name, page).get("[data-test=help-access]").text();

const sectionTitles = (wrapper: Wrapper) =>
  wrapper.findAll("section.help-section h2").map((heading) => heading.text());

async function followLink(wrapper: Wrapper, router: Wrapper["vm"]["$router"], page: string) {
  await sectionFor(wrapper, page).get("a").trigger("click");
  await flushPromises();
  return router.currentRoute.value.name;
}

beforeEach(useLocalSignIn);

describe("Help page", () => {
  it("opens with a Help heading", async () => {
    const { wrapper } = await openHelp();

    expect(wrapper.get("h1").text()).toBe("Help");
  });

  it("has a Running order section that links to the Running order page", async () => {
    const { wrapper, router } = await openHelp();

    await runningOrder(wrapper).get("a").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("running-order");
  });

  it("explains each of the Running order's actions in one line", async () => {
    const { wrapper } = await openHelp();

    expect(lines(wrapper).map((line) => line.get("[data-test=help-name]").text())).toEqual([
      "Read the order",
      "Drag",
      "Move",
      "Edit",
      "Remove",
      "Add item",
      "Save as Draft",
      "Reset",
    ]);
    for (const line of lines(wrapper)) {
      expect(line.get("[data-test=help-does]").text()).not.toBe("");
    }
  });

  it("shows the Running order's own icons beside the words for each move", async () => {
    const { wrapper } = await openHelp();

    const moveLine = lineNamed(wrapper, "Move");
    const shown = moveLine.findAll("svg").map((svg) => svg.attributes("data-icon"));
    expect(shown).toEqual([
      icons.moveUp.iconName,
      icons.moveDown.iconName,
      icons.moveToOtherHalf.iconName,
    ]);
    expect(lineNamed(wrapper, "Drag").get("svg").attributes("data-icon")).toBe(icons.drag.iconName);
  });

  it("labels every line, in words, with who can use it", async () => {
    const { wrapper } = await openHelp();

    for (const line of lines(wrapper)) {
      expect(ACCESS_LABELS).toContain(line.get("[data-test=help-access]").text());
    }
    for (const name of ["Remove", "Add item", "Save as Draft"]) {
      expect(accessOf(wrapper, name)).toBe("Admins only");
    }
    for (const name of ["Drag", "Move", "Edit", "Reset"]) {
      expect(accessOf(wrapper, name)).toBe("Accounts with Casting, and admins");
    }
    // So a read-only reviewer sees what they can do here, not only what they can't.
    expect(accessOf(wrapper, "Read the order")).toBe("Everyone");
  });

  it("lines every action's words up, with or without an icon", async () => {
    const { wrapper } = await openHelp();

    for (const line of lines(wrapper)) {
      expect(line.find(".help-icons").exists()).toBe(true);
    }
  });

  it("keeps each page's help to at most 8 lines", async () => {
    const { wrapper } = await openHelp();

    for (const section of wrapper.findAll("section.help-section")) {
      expect(section.findAll("[data-test=help-line]").length).toBeLessThanOrEqual(8);
    }
  });

  it("shows every role the same help", async () => {
    const { wrapper: asAdmin } = await openHelp();
    const shown = asAdmin.html();

    for (const groups of [["read-only"], ["casting"], ["admin"]]) {
      await signInAs(groups);
      const { wrapper } = await openHelp();
      expect(wrapper.html()).toBe(shown);
    }
  });

  describe("the Cast section", () => {
    it("follows the Running order's and links to the Cast page", async () => {
      const { wrapper, router } = await openHelp();

      expect(sectionTitles(wrapper).slice(0, 2)).toEqual(["Running order", "Cast"]);
      expect(await followLink(wrapper, router, "cast")).toBe("cast");
    });

    it("explains each action in a line, with the page's icons and who can use it", async () => {
      const { wrapper } = await openHelp();

      expect(
        lines(wrapper, "cast").map((line) => line.get("[data-test=help-name]").text()),
      ).toEqual(["Filter", "Clear filters", "Add cast member", "Edit", "Delete"]);
      expect(lineNamed(wrapper, "Edit", "cast").get("svg").attributes("data-icon")).toBe(
        icons.edit.iconName,
      );
      expect(lineNamed(wrapper, "Delete", "cast").get("svg").attributes("data-icon")).toBe(
        icons.remove.iconName,
      );
      expect(
        ["Filter", "Clear filters", "Add cast member", "Edit", "Delete"].map((name) =>
          accessOf(wrapper, name, "cast"),
        ),
      ).toEqual([
        "Everyone",
        "Everyone",
        "Accounts with Casting, and admins",
        "Accounts with Casting, and admins",
        "Admins only",
      ]);
    });
  });

  describe("the Overview section", () => {
    it("follows the Cast section and links to the Overview page", async () => {
      const { wrapper, router } = await openHelp();

      expect(sectionTitles(wrapper).slice(1, 3)).toEqual(["Cast", "Overview"]);
      expect(await followLink(wrapper, router, "casting-overview")).toBe("casting-overview");
    });

    it("explains each view, export and the clash icon, all open to everyone", async () => {
      await signInAs(["read-only"]);
      const { wrapper } = await openHelp();

      const overviewLines = lines(wrapper, "casting-overview");
      expect(overviewLines.map((line) => line.get("[data-test=help-name]").text())).toEqual([
        "By person",
        "By item",
        "Grid",
        "Export to Excel",
        "Export to Word",
        "Clash",
      ]);
      const iconOf = (name: string) =>
        lineNamed(wrapper, name, "casting-overview").get("svg").attributes("data-icon");
      expect(iconOf("Export to Excel")).toBe(icons.exportFile.iconName);
      expect(iconOf("Export to Word")).toBe(icons.exportWord.iconName);
      expect(iconOf("Clash")).toBe(icons.error.iconName);
      for (const line of overviewLines) {
        expect(line.get("[data-test=help-access]").text()).toBe("Everyone");
      }
    });
  });

  describe("the Items and item sections", () => {
    const names = (wrapper: Wrapper, page: string) =>
      lines(wrapper, page).map((line) => line.get("[data-test=help-name]").text());

    it("follow the Overview's, both linking to the Items page", async () => {
      const { wrapper, router } = await openHelp();

      expect(sectionTitles(wrapper).slice(2, 5)).toEqual(["Overview", "Items", "An item"]);
      expect(await followLink(wrapper, router, "casting-items")).toBe("casting-items");
      await router.push("/help");
      expect(await followLink(wrapper, router, "casting-item")).toBe("casting-items");
    });

    it("explain the Items list's icon, clash and badge, open to everyone", async () => {
      const { wrapper } = await openHelp();

      expect(names(wrapper, "casting-items")).toEqual([
        "Open an item",
        "Clash",
        "Not in printed programme",
      ]);
      expect(
        lineNamed(wrapper, "Open an item", "casting-items").get("svg").attributes("data-icon"),
      ).toBe(icons.cast.iconName);
      for (const line of lines(wrapper, "casting-items")) {
        expect(line.get("[data-test=help-access]").text()).toBe("Everyone");
      }
    });

    it("say how to reach an item, then explain its actions and who can use each", async () => {
      const { wrapper } = await openHelp();

      expect(sectionFor(wrapper, "casting-item").get("p").text()).toContain("Casting → Items");
      expect(names(wrapper, "casting-item")).toEqual([
        "All items",
        "Previous and Next",
        "Add role",
        "Edit",
        "Remove",
        "Notes",
      ]);
      const iconOf = (name: string) =>
        lineNamed(wrapper, name, "casting-item").get("svg").attributes("data-icon");
      expect(iconOf("Edit")).toBe(icons.edit.iconName);
      expect(iconOf("Remove")).toBe(icons.remove.iconName);
      const access = (name: string) =>
        lineNamed(wrapper, name, "casting-item")
          .findAll("[data-test=help-access]")
          .map((label) => label.text());
      expect(access("All items")).toEqual(["Everyone"]);
      expect(access("Previous and Next")).toEqual(["Everyone"]);
      for (const name of ["Add role", "Edit", "Remove"]) {
        expect(access(name)).toEqual(["Accounts with Casting, and admins"]);
      }
      expect(access("Notes")).toEqual([
        "Reading: Everyone",
        "Changing: Accounts with Casting, and admins",
      ]);
    });
  });

  describe("the Production sections", () => {
    const names = (wrapper: Wrapper, page: string) =>
      lines(wrapper, page).map((line) => line.get("[data-test=help-name]").text());
    const summaryOf = (wrapper: Wrapper, page: string) => sectionFor(wrapper, page).get("p").text();

    it("follow the casting's, as Stage, an item's props, Tech and Costume, each linking to its page", async () => {
      const { wrapper, router } = await openHelp();

      expect(sectionTitles(wrapper).slice(5)).toEqual([
        "Stage",
        "An item's props",
        "Tech",
        "Costume",
      ]);
      await router.push("/help");
      expect(await followLink(wrapper, router, "props-item")).toBe("stage");
      for (const page of ["stage", "tech", "costume"]) {
        await router.push("/help");
        expect(await followLink(wrapper, router, page)).toBe(page);
      }
    });

    it("say how to reach an item's props, then explain its actions and who can use each", async () => {
      const { wrapper } = await openHelp();

      expect(summaryOf(wrapper, "props-item")).toContain("Production → Stage");
      expect(names(wrapper, "props-item")).toEqual(["All items", "Previous and Next", "Add prop"]);
      expect(accessOf(wrapper, "All items", "props-item")).toBe("Everyone");
      expect(accessOf(wrapper, "Previous and Next", "props-item")).toBe("Everyone");
      expect(accessOf(wrapper, "Add prop", "props-item")).toBe("Accounts with Stage, and admins");
    });

    it("name the views on Stage and Tech, open to everyone", async () => {
      const { wrapper } = await openHelp();

      expect(names(wrapper, "stage")).toEqual(["Scenery", "Props"]);
      expect(names(wrapper, "tech")).toEqual(["Mic plot", "SFX"]);
      for (const line of [...lines(wrapper, "stage"), ...lines(wrapper, "tech")]) {
        expect(line.get("[data-test=help-access]").text()).toBe("Everyone");
      }
    });

    it("say each department's permission is what lets someone change its page", async () => {
      const { wrapper } = await openHelp();

      expect(summaryOf(wrapper, "stage")).toContain(
        "Accounts with Stage, and admins, can change it.",
      );
      expect(summaryOf(wrapper, "tech")).toContain(
        "Accounts with Tech, and admins, can change it.",
      );
      expect(summaryOf(wrapper, "costume")).toContain(
        "Accounts with Costume, and admins, can change it.",
      );
    });

    it("say the Costume page is coming soon, with no views to explain", async () => {
      const { wrapper } = await openHelp();

      expect(summaryOf(wrapper, "costume")).toContain("Coming soon");
      expect(lines(wrapper, "costume")).toEqual([]);
    });
  });
});
