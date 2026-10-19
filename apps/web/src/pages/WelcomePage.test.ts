import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryHistory } from "vue-router";
import { icons } from "../icons.ts";
import { createAppRouter } from "../router.ts";
import { signInAs } from "../sign-in.fixture.ts";
import { useLocalSignIn } from "../sign-in.ts";
import WelcomePage from "./WelcomePage.vue";

async function openWelcome() {
  const router = createAppRouter(createMemoryHistory());
  await router.push("/");
  await router.isReady();
  const wrapper = mount(WelcomePage, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

const ACCESS_LABELS = ["Everyone", "Casting team and admins", "Admins only"];

type Wrapper = Awaited<ReturnType<typeof openWelcome>>["wrapper"];

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

describe("Welcome page", () => {
  it("opens with a Welcome heading and a short introduction to the app", async () => {
    const { wrapper } = await openWelcome();

    expect(wrapper.get("h1").text()).toBe("Welcome");
    const intro = wrapper.get("[data-test=intro]").text();
    expect(intro).toContain("Chester Gang Show");
    expect(intro.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
  });

  it("has a Running order section that links to the Running order page", async () => {
    const { wrapper, router } = await openWelcome();

    await runningOrder(wrapper).get("a").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("running-order");
  });

  it("explains each of the Running order's actions in one line", async () => {
    const { wrapper } = await openWelcome();

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
    const { wrapper } = await openWelcome();

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
    const { wrapper } = await openWelcome();

    for (const line of lines(wrapper)) {
      expect(ACCESS_LABELS).toContain(line.get("[data-test=help-access]").text());
    }
    for (const name of ["Remove", "Add item", "Save as Draft"]) {
      expect(accessOf(wrapper, name)).toBe("Admins only");
    }
    for (const name of ["Drag", "Move", "Edit", "Reset"]) {
      expect(accessOf(wrapper, name)).toBe("Casting team and admins");
    }
    // So a read-only reviewer sees what they can do here, not only what they can't.
    expect(accessOf(wrapper, "Read the order")).toBe("Everyone");
  });

  it("lines every action's words up, with or without an icon", async () => {
    const { wrapper } = await openWelcome();

    for (const line of lines(wrapper)) {
      expect(line.find(".help-icons").exists()).toBe(true);
    }
  });

  it("keeps each page's help to at most 8 lines", async () => {
    const { wrapper } = await openWelcome();

    for (const section of wrapper.findAll("section.help-section")) {
      expect(section.findAll("[data-test=help-line]").length).toBeLessThanOrEqual(8);
    }
  });

  it("shows every role the same help", async () => {
    const { wrapper: asAdmin } = await openWelcome();
    const shown = asAdmin.html();

    for (const groups of [["read-only"], ["casting"], ["admin"]]) {
      await signInAs(groups);
      const { wrapper } = await openWelcome();
      expect(wrapper.html()).toBe(shown);
    }
  });

  describe("the Cast section", () => {
    it("follows the Running order's and links to the Cast page", async () => {
      const { wrapper, router } = await openWelcome();

      expect(sectionTitles(wrapper).slice(0, 2)).toEqual(["Running order", "Cast"]);
      expect(await followLink(wrapper, router, "cast")).toBe("cast");
    });

    it("explains each action in a line, with the page's icons and who can use it", async () => {
      const { wrapper } = await openWelcome();

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
        "Casting team and admins",
        "Casting team and admins",
        "Admins only",
      ]);
    });
  });

  describe("the Overview section", () => {
    it("follows the Cast section and links to the Overview page", async () => {
      const { wrapper, router } = await openWelcome();

      expect(sectionTitles(wrapper).slice(1, 3)).toEqual(["Cast", "Overview"]);
      expect(await followLink(wrapper, router, "casting-overview")).toBe("casting-overview");
    });

    it("explains each view, export and the clash icon, all open to everyone", async () => {
      await signInAs(["read-only"]);
      const { wrapper } = await openWelcome();

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
});
