import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter, isMenuGroup, menuPages } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
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
  it("describes the Admin area's pages to an admin, and links to each", async () => {
    await signInAs(["admin"]);

    const { wrapper } = await openWelcome();

    const terms = wrapper.findAll("dt").map((term) => term.text());
    expect(terms).toEqual(["Show", "Casting", "Production", "Admin"]);
    const admin = wrapper.findAll("dd")[3];
    expect(admin?.findAll("a").map((link) => [link.text(), link.attributes("href")])).toEqual([
      ["Accounts", "/admin/accounts"],
      ["Productions", "/admin/productions"],
      ["Usage", "/admin/usage"],
    ]);
  });

  it.each([[["casting", "stage", "tech", "wardrobe", "director"]], [["read-only"]], [[]]])(
    "leaves the Admin area out for a team member in %j",
    async (groups) => {
      await signInAs(groups);

      const { wrapper } = await openWelcome();

      expect(wrapper.findAll("dt").map((term) => term.text())).toEqual([
        "Show",
        "Casting",
        "Production",
      ]);
      expect(wrapper.find("[data-test=area-admin]").exists()).toBe(false);
      expect(wrapper.get(".welcome-areas").text()).not.toContain("Accounts");
    },
  );

  it("shows the logo above a Welcome heading and a short introduction to the app", async () => {
    const { wrapper } = await openWelcome();

    const logo = wrapper.get("img.welcome-logo");
    expect(logo.attributes("alt")).toBe("Chester Gang Show");
    expect(wrapper.get("h1").text()).toBe("Welcome");
    const parts = wrapper.get(".welcome").element.children;
    expect([...parts].map((part) => part.tagName)).toEqual(["IMG", "H1", "P", "P"]);
    const intro = wrapper.get("[data-test=intro]").text();
    expect(intro).toContain("iCUE");
    // It's more than a casting tool, and nothing in it is still to come.
    expect(intro).toContain("and what each department needs for each item.");
    expect(intro).not.toMatch(/to come|coming/i);
    expect(intro).toContain("Chester Gang Show");
    expect(intro.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
  });

  it.each([
    ["show", "running-order"],
    ["casting", "casting-overview"],
    ["production", "production-overview"],
    ["admin", "accounts"],
  ])("takes the %s area's name to the first page in that menu group", async (area, first) => {
    const { wrapper, router } = await openWelcome();
    const group = menuPages.find((entry) => isMenuGroup(entry) && entry.name === area);
    expect(group && isMenuGroup(group) ? group.pages[0]?.name : undefined).toBe(first);

    await wrapper.get(`[data-test=area-${area}]`).trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe(first);
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
});
