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
  "Accounts with Stage or Director, and admins",
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

  it("never calls the department Costume", async () => {
    const { wrapper } = await openHelp();

    expect(wrapper.text()).not.toContain("Costume");
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

    it("follow the casting's, as the Production overview and an item's props, each linking to its page", async () => {
      const { wrapper, router } = await openHelp();

      expect(sectionTitles(wrapper).slice(5)).toEqual([
        "Production overview",
        "An item's scenery",
        "An item's props",
      ]);
      await router.push("/help");
      expect(await followLink(wrapper, router, "scenery-item")).toBe("production-overview");
      await router.push("/help");
      expect(await followLink(wrapper, router, "props-item")).toBe("production-overview");
      await router.push("/help");
      expect(await followLink(wrapper, router, "production-overview")).toBe("production-overview");
    });

    it("say how to reach an item's props, then explain its actions and who can use each", async () => {
      const { wrapper } = await openHelp();

      expect(summaryOf(wrapper, "props-item")).toContain("One item's props and notes.");
      expect(summaryOf(wrapper, "props-item")).toContain("Production → Overview");
      expect(names(wrapper, "props-item")).toEqual([
        "All items",
        "Previous and Next",
        "Add prop",
        "Edit",
        "Remove",
        "Props notes",
      ]);
      expect(accessOf(wrapper, "All items", "props-item")).toBe("Everyone");
      expect(accessOf(wrapper, "Previous and Next", "props-item")).toBe("Everyone");
      for (const action of ["Add prop", "Edit", "Remove"]) {
        expect(accessOf(wrapper, action, "props-item")).toBe(
          "Accounts with Stage or Director, and admins",
        );
      }
      expect(
        lineNamed(wrapper, "Props notes", "props-item")
          .findAll("[data-test=help-access]")
          .map((label) => label.text()),
      ).toEqual(["Reading: Everyone", "Changing: Accounts with Stage or Director, and admins"]);
    });

    it("say how to reach an item's scenery, then explain its links, files and notes, and that Stage, Tech or Director change it", async () => {
      const { wrapper } = await openHelp();

      expect(summaryOf(wrapper, "scenery-item")).toContain("Production → Overview");
      expect(names(wrapper, "scenery-item")).toEqual([
        "All items",
        "Previous and Next",
        "File tiles",
        "Scenery notes",
      ]);
      expect(accessOf(wrapper, "All items", "scenery-item")).toBe("Everyone");
      expect(accessOf(wrapper, "File tiles", "scenery-item")).toBe("Everyone");
      expect(
        lineNamed(wrapper, "Scenery notes", "scenery-item")
          .findAll("[data-test=help-access]")
          .map((label) => label.text()),
      ).toEqual([
        "Reading: Everyone",
        "Changing: Accounts with Stage, Tech or Director, and admins",
      ]);
    });

    it("name the Overview's five buttons in row order, each with its icon, its page and whether it's coming soon", async () => {
      const { wrapper } = await openHelp();

      expect(summaryOf(wrapper, "production-overview")).toContain("in running order");
      const buttons = ["Scenery", "Props", "SFX", "Mic plot", "Wardrobe"];
      expect(names(wrapper, "production-overview").slice(0, 5)).toEqual(buttons);
      const iconOf = (name: string) =>
        lineNamed(wrapper, name, "production-overview").get("svg").attributes("data-icon");
      expect(buttons.map(iconOf)).toEqual(
        [icons.scenery, icons.props, icons.sfx, icons.micPlot, icons.wardrobe].map(
          (icon) => icon.iconName,
        ),
      );
      const doesOf = (name: string) =>
        lineNamed(wrapper, name, "production-overview").get("[data-test=help-does]").text();
      expect(buttons.map(doesOf)).toEqual([
        expect.stringContaining("the item's scenery page"),
        expect.stringContaining("the item's props page"),
        expect.stringContaining("the item's SFX page"),
        expect.stringContaining("the item's mic plot page"),
        expect.stringContaining("the item's wardrobe page"),
      ]);
      expect(buttons.filter((name) => doesOf(name).includes("Coming soon"))).toEqual([
        "SFX",
        "Mic plot",
        "Wardrobe",
      ]);
    });

    it("label each button with the department that changes its page, as do Directors and admins, and that everyone can view it", async () => {
      const { wrapper } = await openHelp();

      const access = (name: string) =>
        lineNamed(wrapper, name, "production-overview")
          .findAll("[data-test=help-access]")
          .map((label) => label.text());
      for (const [name, department] of [
        ["Scenery", "Stage, Tech"],
        ["Props", "Stage"],
        ["SFX", "Tech"],
        ["Mic plot", "Tech"],
        ["Wardrobe", "Wardrobe"],
      ] as const) {
        expect(access(name)).toEqual([
          "Reading: Everyone",
          `Changing: Accounts with ${department} or Director, and admins`,
        ]);
      }
    });

    it("describe Generate Props List after the buttons, open to everyone", async () => {
      const { wrapper } = await openHelp();

      expect(names(wrapper, "production-overview").at(-1)).toBe("Generate Props List");
      const line = lineNamed(wrapper, "Generate Props List", "production-overview");
      expect(line.get("[data-test=help-does]").text()).toContain("Word");
      expect(line.get("svg").attributes("data-icon")).toBe(icons.exportWord.iconName);
      expect(line.get("[data-test=help-access]").text()).toBe("Everyone");
    });

    it("don't name Stage, Tech or Wardrobe as pages", async () => {
      const { wrapper } = await openHelp();

      expect(sectionTitles(wrapper)).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^(Stage|Tech|Wardrobe)$/)]),
      );
      expect(wrapper.text()).not.toMatch(
        /Production → (Stage|Tech|Wardrobe)|(Stage|Tech|Wardrobe) (page|view)|the (Scenery|Props|Mic plot|SFX) view/,
      );
    });
  });
});
