import { AddRoleRequest, type CastMember, type Role, type RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "../App.vue";
import { CAST_PATH } from "../cast.ts";
import { ROLES_PATH } from "../roles.ts";
import { createAppRouter } from "../router.ts";
import { anItem, aRunningOrder } from "../running-order.fixture.ts";

enableAutoUnmount(afterEach);

const show = aRunningOrder(
  [anItem("Opening Number"), anItem("Pirate Sketch")],
  [anItem("Campfire Song"), anItem("Mystery Act", { printed: false })],
);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const member = (
  id: number,
  firstName: string,
  lastName: string,
  more: Partial<CastMember> = {},
) => ({
  id,
  firstName,
  lastName,
  section: null,
  group: "",
  revision: 1,
  ...more,
});
const theCast: CastMember[] = [
  member(12, "Sam", "Example", { section: "scouts", group: "1st Somewhere" }),
  member(13, "Alex", "Sample", { section: "explorers", group: "Riverside ESU" }),
  member(14, "Jo", "Newcomer"),
  member(15, "Zoë", "Adams"),
];

/** A stand-in API holding one saved running order, the cast and the roles added so far. */
function savedRunningOrderIs(order: RunningOrder, roles: Role[] = []) {
  const stored = [...roles];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === ROLES_PATH) return json({ productionId: "2027", roles: stored });
      if (url === CAST_PATH) return json({ productionId: "2027", members: theCast });
      const addTo = /\/items\/([^/]+)\/roles$/.exec(url)?.[1];
      if (addTo && init?.method === "POST") {
        const details = AddRoleRequest.parse(JSON.parse(String(init.body)));
        const role = { ...details, id: stored.length + 1, itemId: addTo, revision: 1 };
        stored.push(role);
        return json(role, 201);
      }
      return json(order);
    }),
  );
}

// The whole app, so routing, the menu and the tab title are real.
async function openAppAt(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}

describe("Casting item page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("opens from the Items list, showing the item's name and position", async () => {
    savedRunningOrderIs(show);
    const { wrapper, router } = await openAppAt("/casting/items");

    await wrapper.get("main a[href='/casting/items/pirate-sketch']").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Pirate Sketch");
    expect(wrapper.get("[data-test=position]").text()).toBe("Item 2 · First half");
    expect(router.currentRoute.value.fullPath).toBe("/casting/items/pirate-sketch");
    expect(document.title).toBe("Pirate Sketch · Chester Gang Show casting");
  });

  it("shows only the half for an item not in the printed programme", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/mystery-act");

    expect(wrapper.get("[data-test=position]").text()).toBe(
      "Second half · Not in printed programme",
    );
  });

  it("says when no roles have been added", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.get("main").text()).toContain("No roles have been added yet.");
  });

  it("names the item in the browser tab", async () => {
    savedRunningOrderIs(show);
    await openAppAt("/casting/items/pirate-sketch");

    expect(document.title).toBe("Pirate Sketch · Chester Gang Show casting");
  });

  it("loads directly from its URL", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/campfire-song");

    expect(wrapper.get("main h1").text()).toBe("Campfire Song");
    expect(wrapper.get("[data-test=position]").text()).toBe("Item 1 · Second half");
  });

  it("marks Items as the current page in the menu", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const current = wrapper.findAll("nav a[aria-current=page]");
    expect(current.map((link) => link.text())).toEqual(["Items"]);
  });

  it("puts All items in a breadcrumb above the item's title", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const breadcrumb = wrapper.get("main nav[aria-label=Breadcrumb]");
    expect(breadcrumb.get("a").text()).toBe("All items");
    // compareDocumentPosition sets FOLLOWING when the heading comes after the breadcrumb.
    const heading = wrapper.get("main h1").element;
    expect(
      breadcrumb.element.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("goes back to the Items list from All items", async () => {
    savedRunningOrderIs(show);
    const { wrapper, router } = await openAppAt("/casting/items/pirate-sketch");

    const allItems = wrapper.findAll("main a").find((link) => link.text() === "All items");
    await allItems?.trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/casting/items");
    expect(wrapper.get("main h1").text()).toBe("Items");
  });

  it("shows not found for an item that isn't in the running order", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/no-such-item");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(wrapper.get("main nav[aria-label=Breadcrumb] a").text()).toBe("All items");
    expect(document.title).toBe("Item not found · Chester Gang Show casting");
  });

  it("shows not found when there's no saved running order at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === ROLES_PATH
          ? json({ productionId: "2027", roles: [] })
          : new Response(null, { status: 404 }),
      ),
    );
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
  });

  it("goes back to the Items list from an item that isn't found", async () => {
    savedRunningOrderIs(show);
    const { wrapper, router } = await openAppAt("/casting/items/no-such-item");

    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/casting/items");
    expect(wrapper.get("main h1").text()).toBe("Items");
  });

  it("reports a failed load rather than not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the item.");
    expect(wrapper.get("main").text()).not.toContain("Item not found");
  });

  it("reports a server error as a failed load, not as not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the item.");
  });
});

const aRole = (itemId: string, name: string, size: Role["size"] = "lead"): Role => ({
  id: 1,
  itemId,
  name,
  size,
  castMemberIds: [],
  revision: 1,
});

describe("Adding roles to an item", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  type Page = Awaited<ReturnType<typeof openAppAt>>["wrapper"];

  /** The error shown next to a field: the one its aria-describedby points at. */
  const errorFor = (wrapper: Page, field: string) => {
    const id = wrapper.get(`[name=${field}]`).attributes("aria-describedby");
    return id ? document.getElementById(id)?.textContent?.trim() : undefined;
  };

  // Each role as "<name> <size>", read from its card.
  const rolesShown = (wrapper: Awaited<ReturnType<typeof openAppAt>>["wrapper"]) =>
    wrapper
      .findAll("[data-test=role]")
      .map((role) => `${role.get(".role-name").text()} ${role.get("[data-test=size]").text()}`);

  async function addRole(
    wrapper: Awaited<ReturnType<typeof openAppAt>>["wrapper"],
    name: string,
    size: string,
  ) {
    await wrapper.get("[data-test=add-role]").trigger("click");
    await wrapper.get("input[name=name]").setValue(name);
    await wrapper.get("select[name=size]").setValue(size);
    await wrapper.get("form[aria-label='Add role']").trigger("submit");
    await flushPromises();
  }

  it("adds a role with its name and size, replacing the empty state", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await addRole(wrapper, "Captain Hook", "lead");

    expect(rolesShown(wrapper)).toEqual(["Captain Hook Lead"]);
    expect(wrapper.text()).not.toContain("No roles have been added yet.");
  });

  it("still lists a role added earlier when the page is opened again", async () => {
    savedRunningOrderIs(show);
    const first = await openAppAt("/casting/items/pirate-sketch");
    await addRole(first.wrapper, "Captain Hook", "lead");
    first.wrapper.unmount();

    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(rolesShown(wrapper)).toEqual(["Captain Hook Lead"]);
  });

  it("keeps added roles when the page is opened again", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "Captain Hook")]);

    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(rolesShown(wrapper)).toEqual(["Captain Hook Lead"]);
  });

  it("shows only the roles that belong to this item", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "Captain Hook")]);

    const { wrapper } = await openAppAt("/casting/items/campfire-song");

    expect(rolesShown(wrapper)).toEqual([]);
    expect(wrapper.text()).toContain("No roles have been added yet.");
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("asks for a role name when it's %s, adding nothing", async (_case, name) => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await addRole(wrapper, name, "lead");

    expect(errorFor(wrapper, "name")).toBe("Enter a role name");
    expect(rolesShown(wrapper)).toEqual([]);
  });

  it("refuses a role name over 60 characters, adding nothing", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await addRole(wrapper, "x".repeat(61), "lead");

    expect(errorFor(wrapper, "name")).toBe("Role names can be up to 60 characters");
    expect(rolesShown(wrapper)).toEqual([]);
  });

  it("asks for a role size, adding nothing", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await addRole(wrapper, "Captain Hook", "");

    expect(errorFor(wrapper, "size")).toBe("Choose a role size");
    expect(rolesShown(wrapper)).toEqual([]);
  });

  it("adds nothing when cancelled", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await wrapper.get("[data-test=add-role]").trigger("click");
    await wrapper.get("input[name=name]").setValue("Captain Hook");

    await wrapper.get("[data-test=cancel]").trigger("click");
    await flushPromises();

    expect(wrapper.find("form[aria-label='Add role']").exists()).toBe(false);
    expect(rolesShown(wrapper)).toEqual([]);
  });

  it("reports roles that can't be loaded rather than showing no roles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === ROLES_PATH ? new Response(null, { status: 500 }) : json(show),
      ),
    );
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the item.");
    expect(wrapper.text()).not.toContain("No roles have been added yet.");
  });

  it("says when a role couldn't be added, keeping what was typed", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    const fetch = vi.mocked(globalThis.fetch);
    const answer = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, init) =>
      init?.method === "POST"
        ? new Response(null, { status: 500 })
        : (answer?.(url, init) ?? json({})),
    );

    await addRole(wrapper, "Captain Hook", "lead");

    expect(wrapper.get("form [role=alert]").text()).toBe("Couldn't add the role. Try again.");
    expect(wrapper.get<HTMLInputElement>("input[name=name]").element.value).toBe("Captain Hook");
  });
});

describe("Role names within an item", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  type Page = Awaited<ReturnType<typeof openAppAt>>["wrapper"];

  const nameError = (wrapper: Page) => {
    const id = wrapper.get("[name=name]").attributes("aria-describedby");
    return id ? document.getElementById(id)?.textContent?.trim() : undefined;
  };

  const roleNames = (wrapper: Page) =>
    wrapper.findAll("[data-test=role] .role-name").map((name) => name.text());

  async function addRole(wrapper: Page, name: string, size = "cameo") {
    await wrapper.get("[data-test=add-role]").trigger("click");
    await wrapper.get("input[name=name]").setValue(name);
    await wrapper.get("select[name=size]").setValue(size);
    await wrapper.get("form[aria-label='Add role']").trigger("submit");
    await flushPromises();
  }

  it("refuses a name the item already has, saying so next to the role name", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "Captain Hook")]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await addRole(wrapper, "Captain Hook");

    expect(nameError(wrapper)).toBe("Pirate Sketch already has a role called Captain Hook");
    expect(roleNames(wrapper)).toEqual(["Captain Hook"]);
  });

  it("treats case and surrounding spaces as the same name", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "Captain Hook")]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await addRole(wrapper, " captain hook ");

    expect(nameError(wrapper)).toBe("Pirate Sketch already has a role called Captain Hook");
    expect(roleNames(wrapper)).toEqual(["Captain Hook"]);
  });

  it("allows the same name in a different item", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "Narrator")]);
    const { wrapper } = await openAppAt("/casting/items/campfire-song");

    await addRole(wrapper, "Narrator", "support");

    expect(roleNames(wrapper)).toEqual(["Narrator"]);
  });

  it("explains when someone else has just added the same name", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    const fetch = vi.mocked(globalThis.fetch);
    const answer = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, init) =>
      init?.method === "POST"
        ? json({ error: "name-taken" }, 400)
        : (answer?.(url, init) ?? json({})),
    );

    await addRole(wrapper, "Captain Hook");

    expect(wrapper.get("form [role=alert]").text()).toBe(
      "Pirate Sketch already has a role called Captain Hook",
    );
  });
});

describe("Role cards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const roleWith = (
    id: number,
    name: string,
    size: Role["size"],
    castMemberIds: number[] = [],
  ) => ({
    ...aRole("pirate-sketch", name, size),
    id,
    castMemberIds,
  });

  const cardNames = (wrapper: Awaited<ReturnType<typeof openAppAt>>["wrapper"]) =>
    wrapper.findAll("[data-test=role] .role-name").map((name) => name.text());

  it("shows each role as a card with a pill for its size", async () => {
    savedRunningOrderIs(show, [roleWith(1, "Captain Hook", "lead")]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const card = wrapper.get("[data-test=role]");
    expect(card.classes()).toContain("role-card");
    expect(card.get(".role-name").text()).toBe("Captain Hook");
    expect(card.get("[data-test=size]").text()).toBe("Lead");
    expect(card.get("[data-test=size]").classes()).toContain("pill");
  });

  it("orders roles by size: lead, support, cameo, then ensemble", async () => {
    savedRunningOrderIs(show, [
      roleWith(1, "Pirates", "ensemble"),
      roleWith(2, "Parrot", "cameo"),
      roleWith(3, "Captain Hook", "lead"),
      roleWith(4, "Smee", "support"),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(cardNames(wrapper)).toEqual(["Captain Hook", "Smee", "Parrot", "Pirates"]);
  });

  it("orders roles of the same size alphabetically, ignoring case", async () => {
    savedRunningOrderIs(show, [
      roleWith(1, "smee", "support"),
      roleWith(2, "Bosun", "support"),
      roleWith(3, "Cook", "support"),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(cardNames(wrapper)).toEqual(["Bosun", "Cook", "smee"]);
  });

  it("marks a role nobody is cast in as uncast", async () => {
    savedRunningOrderIs(show, [roleWith(1, "Parrot", "cameo")]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.get("[data-test=role] [data-test=uncast]").text()).toBe("Uncast");
  });

  it("doesn't mark a role with someone in it as uncast", async () => {
    savedRunningOrderIs(show, [roleWith(1, "Captain Hook", "lead", [12])]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.find("[data-test=role] [data-test=uncast]").exists()).toBe(false);
  });

  it("names every size in words, not only by colour", async () => {
    savedRunningOrderIs(show, [
      roleWith(1, "Captain Hook", "lead"),
      roleWith(2, "Smee", "support"),
      roleWith(3, "Parrot", "cameo"),
      roleWith(4, "Pirates", "ensemble"),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const sizes = wrapper.findAll("[data-test=role] [data-test=size]").map((pill) => pill.text());
    expect(sizes).toEqual(["Lead", "Support", "Cameo", "Ensemble"]);
  });

  it("presents the roles as a list, so screen readers announce how many", async () => {
    savedRunningOrderIs(show, [
      roleWith(1, "Captain Hook", "lead"),
      roleWith(2, "Smee", "support"),
      roleWith(3, "Parrot", "cameo"),
      roleWith(4, "Pirates", "ensemble"),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    // An explicit role: Safari drops list semantics from unstyled lists.
    const list = wrapper.get("ul[role=list][aria-label=Roles]");
    expect(list.findAll(":scope > li")).toHaveLength(4);
  });
});

describe("Casting someone when adding a role", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  type Page = Awaited<ReturnType<typeof openAppAt>>["wrapper"];

  const search = (wrapper: Page) =>
    wrapper.get<HTMLInputElement>("input[role=combobox][name=castMember]");
  const offered = (wrapper: Page) =>
    wrapper.findAll("[role=listbox] [role=option] .choice-name").map((name) => name.text());

  async function startRole(wrapper: Page, name: string, size: string) {
    await wrapper.get("[data-test=add-role]").trigger("click");
    await wrapper.get("input[name=name]").setValue(name);
    await wrapper.get("select[name=size]").setValue(size);
  }

  async function type(wrapper: Page, text: string) {
    await search(wrapper).setValue(text);
    await flushPromises();
  }

  async function save(wrapper: Page) {
    await wrapper.get("form[aria-label='Add role']").trigger("submit");
    await flushPromises();
  }

  const castOn = (wrapper: Page, roleName: string) =>
    wrapper
      .findAll("[data-test=role]")
      .find((card) => card.get(".role-name").text() === roleName)
      ?.find("[data-test=cast]")
      .text();

  it("casts the member chosen from the search, showing them on the card", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Captain Hook", "lead");

    await type(wrapper, "sam");
    const sam = wrapper.findAll("[role=option]").find((o) => o.text().includes("Sam Example"));
    await sam?.trigger("mousedown");
    await save(wrapper);

    expect(castOn(wrapper, "Captain Hook")).toBe("Sam Example");
    expect(wrapper.find("[data-test=role] [data-test=uncast]").exists()).toBe(false);
  });

  it("narrows the choices by first or last name as you type", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Captain Hook", "lead");

    await type(wrapper, "samp");

    expect(offered(wrapper)).toEqual(["Alex Sample"]);
  });

  it("matches names ignoring case and accents", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Captain Hook", "lead");

    await type(wrapper, "zoe");

    expect(offered(wrapper)).toEqual(["Zoë Adams"]);
  });

  it("shows each choice's section and group alongside the name", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Captain Hook", "lead");

    await type(wrapper, "example");

    const choice = wrapper.get("[role=option]");
    expect(choice.get(".choice-name").text()).toBe("Sam Example");
    expect(choice.get(".choice-details").text()).toBe("Scouts · 1st Somewhere");
  });

  it("chooses with the down arrow and Enter", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Captain Hook", "lead");
    await type(wrapper, "example");

    await search(wrapper).trigger("keydown", { key: "ArrowDown" });
    const active = search(wrapper).attributes("aria-activedescendant");
    expect(active && document.getElementById(active)?.textContent).toContain("Sam Example");
    await search(wrapper).trigger("keydown", { key: "Enter" });

    expect(search(wrapper).element.value).toBe("Sam Example");
    expect(search(wrapper).attributes("aria-expanded")).toBe("false");
    expect(wrapper.find("[data-test=role]").exists()).toBe(false);

    await save(wrapper);
    expect(castOn(wrapper, "Captain Hook")).toBe("Sam Example");
  });

  it("says when no cast members match", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Captain Hook", "lead");

    await type(wrapper, "xyz");

    expect(offered(wrapper)).toEqual([]);
    expect(wrapper.get("form [role=status]").text()).toBe("No cast members match");
    expect(search(wrapper).attributes("aria-expanded")).toBe("false");
  });

  it("adds the role uncast when the cast member is left blank", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Captain Hook", "lead");

    await save(wrapper);

    expect(wrapper.get("[data-test=role] [data-test=uncast]").text()).toBe("Uncast");
  });

  it("refuses typed text that wasn't chosen, saying so next to the field", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Captain Hook", "lead");
    await type(wrapper, "sam");

    await save(wrapper);

    const id = search(wrapper).attributes("aria-describedby");
    expect(id && document.getElementById(id)?.textContent?.trim()).toBe(
      "Choose a cast member from the list, or clear the field",
    );
    expect(wrapper.find("[data-test=role]").exists()).toBe(false);
  });

  it("lets one person play several roles in an item", async () => {
    savedRunningOrderIs(show, [{ ...aRole("pirate-sketch", "Captain Hook"), castMemberIds: [12] }]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startRole(wrapper, "Parrot", "cameo");
    await type(wrapper, "example");
    await search(wrapper).trigger("keydown", { key: "ArrowDown" });
    await search(wrapper).trigger("keydown", { key: "Enter" });

    await save(wrapper);

    expect(castOn(wrapper, "Captain Hook")).toBe("Sam Example");
    expect(castOn(wrapper, "Parrot")).toBe("Sam Example");
  });
});

describe("Role counts on the Items list", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("includes a role added on an item's page when you go back to the list", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items");
    const counts = () =>
      wrapper
        .findAll("[data-test=item]")
        .find((row) => row.get("[data-test=title]").text() === "Campfire Song")
        ?.get("[data-test=counts]");
    expect(counts()?.text()).toBe("No roles yet");

    await wrapper.get("main a[href='/casting/items/campfire-song']").trigger("click");
    await flushPromises();
    await wrapper.get("[data-test=add-role]").trigger("click");
    await wrapper.get("input[name=name]").setValue("Narrator");
    await wrapper.get("select[name=size]").setValue("support");
    await wrapper.get("form[aria-label='Add role']").trigger("submit");
    await flushPromises();
    await wrapper.get("main nav[aria-label=Breadcrumb] a").trigger("click");
    await flushPromises();

    expect(counts()?.get("[aria-hidden=true]").text()).toBe("Roles 1 · Cast 0");
  });
});
