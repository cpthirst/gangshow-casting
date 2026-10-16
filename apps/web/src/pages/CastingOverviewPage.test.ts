import type { CastMember } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "../App.vue";
import { CAST_PATH } from "../cast.ts";
import { createAppRouter } from "../router.ts";

enableAutoUnmount(afterEach);

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
let nextId = 1;
const person = (firstName: string, lastName: string, section: CastMember["section"]) => ({
  id: nextId++,
  firstName,
  lastName,
  section,
  group: "",
  revision: 1,
});

function castIs(members: CastMember[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === CAST_PATH
        ? new Response(JSON.stringify({ productionId: "2027", members }))
        : new Response(JSON.stringify({ status: "ok", version: "dev" })),
    ),
  );
}

async function openOverview() {
  const router = createAppRouter(createMemoryHistory());
  await router.push("/casting/overview");
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const sections = (wrapper: VueWrapper) =>
  wrapper.findAll("main section").map((section) => ({
    heading: section.get("h2").text().replace(/\s+/g, " "),
    people: section.findAll("[data-test=person] .person-name").map((name) => name.text()),
  }));

describe("Casting overview page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("lists everyone under their section", async () => {
    castIs([
      person("Sam", "Example", "scouts"),
      person("Alex", "Sample", "explorers"),
      person("Kit", "Person", "network"),
    ]);

    const wrapper = await openOverview();

    expect(sections(wrapper).map(({ heading, people }) => [heading, people])).toEqual([
      ["Scouts 1 person", ["Sam Example"]],
      ["Explorers 1 person", ["Alex Sample"]],
      ["Network 1 person", ["Kit Person"]],
    ]);
  });

  it("orders the sections, with people who have no section last", async () => {
    castIs([
      person("Jo", "Newcomer", null),
      person("Kit", "Person", "network"),
      person("Alex", "Sample", "explorers"),
      person("Sam", "Example", "scouts"),
    ]);

    const wrapper = await openOverview();

    const headings = wrapper.findAll("main section h2 .section-name").map((h) => h.text());
    expect(headings).toEqual(["Scouts", "Explorers", "Network", "Not set"]);
    expect(sections(wrapper)[3]?.people).toEqual(["Jo Newcomer"]);
  });

  it("doesn't show a section with nobody in it", async () => {
    castIs([person("Sam", "Example", "scouts"), person("Alex", "Sample", "explorers")]);

    const wrapper = await openOverview();

    expect(wrapper.text()).not.toContain("Network");
  });

  it("says how many people are in each section", async () => {
    castIs([
      person("Sam", "Example", "scouts"),
      person("Zoe", "Adams", "scouts"),
      person("Ben", "Carter", "scouts"),
      person("Alex", "Sample", "explorers"),
    ]);

    const wrapper = await openOverview();

    expect(wrapper.findAll("main section h2 .section-count").map((c) => c.text())).toEqual([
      "3 people",
      "1 person",
    ]);
  });

  it("shows each person as a card like a role card, name in bold", async () => {
    castIs([person("Sam", "Example", "scouts")]);

    const wrapper = await openOverview();

    const card = wrapper.get("[data-test=person]");
    expect(card.classes()).toContain("role-card");
    expect(card.get(".person-name").classes()).toContain("role-name");
  });

  it("presents each section as a list, so screen readers say how many", async () => {
    castIs([
      person("Sam", "Example", "scouts"),
      person("Zoe", "Adams", "scouts"),
      person("Ben", "Carter", "scouts"),
    ]);

    const wrapper = await openOverview();

    const list = wrapper.get("main section ul[role=list]");
    expect(list.findAll(":scope > li")).toHaveLength(3);
    // Named by its heading, so the list is announced as "Scouts".
    expect(list.attributes("aria-labelledby")).toBe(
      wrapper.get("main section h2").attributes("id"),
    );
  });

  it("reports a cast that can't be loaded rather than an empty one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === CAST_PATH
          ? new Response(null, { status: 500 })
          : new Response(JSON.stringify({ status: "ok", version: "dev" })),
      ),
    );

    const wrapper = await openOverview();

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the cast.");
    expect(wrapper.find("main section").exists()).toBe(false);
  });

  it("says when there's nobody in the cast yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === CAST_PATH
          ? new Response(null, { status: 404 })
          : new Response(JSON.stringify({ status: "ok", version: "dev" })),
      ),
    );

    const wrapper = await openOverview();

    expect(wrapper.get("main").text()).toContain("No cast members yet.");
  });

  it("replaces the placeholder at the same address", async () => {
    castIs([person("Sam", "Example", "scouts")]);

    const wrapper = await openOverview();

    expect(wrapper.get("main").text()).not.toContain("Coming soon");
    expect(wrapper.get("main h1").text()).toBe("Overview");
  });
});
