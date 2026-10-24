import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "../router.ts";
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

beforeEach(useLocalSignIn);

describe("Welcome page", () => {
  it("shows the logo above a Welcome heading and a short introduction to the app", async () => {
    const { wrapper } = await openWelcome();

    const logo = wrapper.get("img.welcome-logo");
    expect(logo.attributes("alt")).toBe("Chester Gang Show");
    expect(wrapper.get("h1").text()).toBe("Welcome");
    const parts = wrapper.get(".welcome").element.children;
    expect([...parts].map((part) => part.tagName)).toEqual(["IMG", "H1", "P"]);
    const intro = wrapper.get("[data-test=intro]").text();
    expect(intro).toContain("iCUE");
    // It's more than a casting tool: say what's coming, so people know where it's going.
    expect(intro).toMatch(/props lists, sound effects and mic plots/);
    expect(intro).toContain("Chester Gang Show");
  });

  it("explains what is under Show, Production and Casting, and points to the menu", async () => {
    const { wrapper } = await openWelcome();

    expect(wrapper.get("section.welcome-areas").text()).toContain("Use the menu");
    const areas = wrapper.findAll("dt").map((term) => term.text());
    expect(areas).toEqual(["Show", "Production", "Casting"]);
    const production = wrapper.findAll("dd")[1]?.text() ?? "";
    for (const page of ["Mic plot", "Props", "Scenery", "SFX"]) expect(production).toContain(page);
  });

  it("links to the pages it names, and to Help", async () => {
    const { wrapper, router } = await openWelcome();

    const hrefs = wrapper.findAll("a").map((link) => link.attributes("href"));
    expect(hrefs).toEqual([
      "/running-order",
      "/cast",
      "/casting/overview",
      "/casting/items",
      "/help",
    ]);
    await wrapper.get("a[href='/help']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("help");
  });

  it("no longer carries the page-by-page help", async () => {
    const { wrapper } = await openWelcome();

    expect(wrapper.find("section.help-section").exists()).toBe(false);
  });
});
