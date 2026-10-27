import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter, isMenuGroup, menuPages } from "@/router/index.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import WelcomePage from "./WelcomePage.vue";

async function openWelcome() {
  const router = createAppRouter(createMemoryHistory());
  await router.push("/");
  await router.isReady();
  const wrapper = mount(WelcomePage, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

beforeEach(useLocalSignIn);

describe("Welcome page", () => {
  it("shows the logo above a Welcome heading and a short introduction to the app", async () => {
    const { wrapper } = await openWelcome();

    const logo = wrapper.get("img.welcome-logo");
    expect(logo.attributes("alt")).toBe("Chester Gang Show");
    expect(wrapper.get("h1").text()).toBe("Welcome");
    const parts = wrapper.get(".welcome").element.children;
    expect([...parts].map((part) => part.tagName)).toEqual(["IMG", "H1", "P", "P"]);
    const intro = wrapper.get("[data-test=intro]").text();
    expect(intro).toContain("iCUE");
    // It's more than a casting tool: say what's coming, so people know where it's going.
    expect(intro).toMatch(/props lists, sound effects and mic plots/);
    expect(intro).toContain("Chester Gang Show");
    expect(intro.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
  });

  it("explains what is under Show, Production and Casting, and points to the menu", async () => {
    const { wrapper } = await openWelcome();

    expect(wrapper.get("section.welcome-areas").text()).toContain("Use the menu");
    const areas = wrapper.findAll("dt").map((term) => term.text());
    expect(areas).toEqual(["Show", "Casting", "Production"]);
    const production = wrapper.findAll("dd")[2]?.text().replace(/\s+/g, " ") ?? "";
    expect(production).toContain(
      "the Overview, with the show's items in running order and a button to open each department's page for them",
    );
    expect(production).not.toContain("a page each");
    expect(production).toContain(
      "Each department's permission (Stage, Tech or Wardrobe) is what lets someone change its pages",
    );
  });

  it.each([
    ["show", "running-order"],
    ["casting", "casting-overview"],
    ["production", "production-overview"],
  ])("takes the %s area's name to the first page in that menu group", async (area, first) => {
    const { wrapper, router } = await openWelcome();
    const group = menuPages.find((entry) => isMenuGroup(entry) && entry.name === area);
    expect(group && isMenuGroup(group) ? group.pages[0]?.name : undefined).toBe(first);

    await wrapper.get(`[data-test=area-${area}]`).trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe(first);
  });

  it("calls the department Wardrobe, never Costume", async () => {
    const { wrapper } = await openWelcome();

    expect(wrapper.text()).toContain("Wardrobe");
    expect(wrapper.text()).not.toContain("Costume");
  });

  it("tells someone new to check out Help first, before the guide to the menu", async () => {
    const { wrapper } = await openWelcome();

    const note = wrapper.get("[data-test=help-note]");
    expect(note.text()).toContain("New here?");
    expect(note.get("a").attributes("href")).toBe("/help");
    expect(wrapper.get(".welcome").element.contains(note.element)).toBe(true);
  });

  it("links to the pages it names, and to Help", async () => {
    const { wrapper, router } = await openWelcome();

    const hrefs = wrapper.findAll("a").map((link) => link.attributes("href"));
    for (const href of [
      "/running-order",
      "/cast",
      "/casting/overview",
      "/casting/items",
      "/production/overview",
      "/help",
    ]) {
      expect(hrefs).toContain(href);
    }
    await wrapper.get("a[href='/help']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("help");
  });

  it("no longer carries the page-by-page help", async () => {
    const { wrapper } = await openWelcome();

    expect(wrapper.find("section.help-section").exists()).toBe(false);
  });
});
