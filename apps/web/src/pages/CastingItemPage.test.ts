import {
  AddRoleRequest,
  type CastMember,
  type Role,
  type RunningOrder,
  sameRoleName,
  UpdateRoleRequest,
} from "@app/shared";
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
      const removal = /\/roles\/(\d+)\?revision=(\d+)$/.exec(url);
      if (removal && init?.method === "DELETE") {
        const index = stored.findIndex((r) => r.id === Number(removal[1]));
        const current = stored[index];
        if (!current) return new Response(null, { status: 404 });
        if (current.revision !== Number(removal[2])) return new Response(null, { status: 409 });
        stored.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      const editId = Number(/\/roles\/(\d+)$/.exec(url)?.[1]);
      if (editId && init?.method === "PUT") {
        const { revision, ...details } = UpdateRoleRequest.parse(JSON.parse(String(init.body)));
        const index = stored.findIndex((r) => r.id === editId);
        const current = stored[index];
        if (!current) return new Response(null, { status: 404 });
        if (current.revision !== revision) return new Response(null, { status: 409 });
        const taken = stored.some(
          (r) =>
            r.id !== editId && r.itemId === current.itemId && sameRoleName(r.name, details.name),
        );
        if (taken) return json({ error: "name-taken" }, 400);
        const updated = { ...current, ...details, revision: revision + 1 };
        stored[index] = updated;
        return json(updated);
      }
      return json(order);
    }),
  );
  // The live roles, so a test can play someone else changing them.
  return stored;
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

  it("puts All items first in a nav above the item's title", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const nav = wrapper.get("main nav[aria-label='Item navigation']");
    expect(nav.get("a").text()).toBe("All items");
    // compareDocumentPosition sets FOLLOWING when the heading comes after the nav.
    const heading = wrapper.get("main h1").element;
    expect(
      nav.element.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // The page's items, in show order: Opening Number, Pirate Sketch | Campfire Song, Mystery Act.
  const stepLinks = (wrapper: Awaited<ReturnType<typeof openAppAt>>["wrapper"]) =>
    wrapper.findAll("main nav[aria-label='Item navigation'] a[rel]").map((link) => ({
      rel: link.attributes("rel"),
      text: link.text().replace(/\s+/g, " "),
      href: link.attributes("href"),
    }));

  it("marks All items, Previous and Next with chevrons screen readers skip", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const icons = wrapper
      .findAll("main nav[aria-label='Item navigation'] a")
      .map((link) => link.get("svg[aria-hidden=true]").attributes("data-icon"));
    expect(icons).toEqual(["chevron-left", "chevron-left", "chevron-right"]);
  });

  it("links to the previous and next items, named by title", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(stepLinks(wrapper)).toEqual([
      { rel: "prev", text: "Previous Opening Number", href: "/casting/items/opening-number" },
      { rel: "next", text: "Next Campfire Song", href: "/casting/items/campfire-song" },
    ]);
  });

  it("steps across the interval like the show", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/campfire-song");

    expect(stepLinks(wrapper).map((link) => link.text)).toEqual([
      "Previous Pirate Sketch",
      "Next Mystery Act",
    ]);
  });

  it("has no Previous on the first item, and no Next on the last", async () => {
    savedRunningOrderIs(show);
    const first = await openAppAt("/casting/items/opening-number");
    expect(stepLinks(first.wrapper).map((link) => link.rel)).toEqual(["next"]);
    first.wrapper.unmount();

    const { wrapper } = await openAppAt("/casting/items/mystery-act");
    expect(stepLinks(wrapper).map((link) => link.rel)).toEqual(["prev"]);
  });

  it("opens the next item, with its own roles and links", async () => {
    savedRunningOrderIs(show, [{ ...aRole("campfire-song", "Song Leader"), id: 5 }]);
    const { wrapper, router } = await openAppAt("/casting/items/pirate-sketch");

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/casting/items/campfire-song");
    expect(wrapper.get("main h1").text()).toBe("Campfire Song");
    expect(wrapper.text()).toContain("Song Leader");
    expect(stepLinks(wrapper).map((link) => link.text)).toEqual([
      "Previous Pirate Sketch",
      "Next Mystery Act",
    ]);
    expect(document.title).toBe("Campfire Song · Chester Gang Show casting");
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
    expect(wrapper.get("main nav[aria-label='Item navigation'] a").text()).toBe("All items");
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
    await wrapper.get("main nav[aria-label='Item navigation'] a.back-link").trigger("click");
    await flushPromises();

    expect(counts()?.get("[aria-hidden=true]").text()).toBe("Roles 1 · Cast 0");
  });
});

describe("Editing a role", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  type Page = Awaited<ReturnType<typeof openAppAt>>["wrapper"];

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
  const pirates = () => [
    roleWith(1, "Captain Hook", "lead", [12]),
    roleWith(2, "Smee", "support"),
    roleWith(3, "Parrot", "cameo"),
  ];

  const card = (wrapper: Page, name: string) =>
    wrapper.findAll("[data-test=role]").find((c) => c.get(".role-name").text() === name);
  const cardNames = (wrapper: Page) =>
    wrapper.findAll("[data-test=role] .role-name").map((name) => name.text());
  const castOn = (wrapper: Page, name: string) =>
    card(wrapper, name)?.find("[data-test=cast]").text();
  const editForm = (wrapper: Page, name: string) => wrapper.get(`form[aria-label='Edit ${name}']`);
  const search = (wrapper: Page) => wrapper.get<HTMLInputElement>("input[name=castMember]");

  async function startEditing(wrapper: Page, name: string) {
    await wrapper.get(`button[aria-label='Edit ${name}']`).trigger("click");
    await flushPromises();
  }

  async function choose(wrapper: Page, typed: string) {
    await search(wrapper).setValue(typed);
    await search(wrapper).trigger("keydown", { key: "ArrowDown" });
    await search(wrapper).trigger("keydown", { key: "Enter" });
  }

  async function save(wrapper: Page, name: string) {
    await editForm(wrapper, name).trigger("submit");
    await flushPromises();
  }

  it("casts someone in an uncast role", async () => {
    savedRunningOrderIs(show, pirates());
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await startEditing(wrapper, "Parrot");
    await choose(wrapper, "sample");
    await save(wrapper, "Parrot");

    expect(castOn(wrapper, "Parrot")).toBe("Alex Sample");
  });

  it("starts the form with the role's details and who's cast", async () => {
    savedRunningOrderIs(show, pirates());
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await startEditing(wrapper, "Captain Hook");

    const form = editForm(wrapper, "Captain Hook");
    expect(form.get<HTMLInputElement>("input[name=name]").element.value).toBe("Captain Hook");
    expect(form.get<HTMLSelectElement>("select[name=size]").element.value).toBe("lead");
    expect(search(wrapper).element.value).toBe("Sam Example");
  });

  it("recasts a role", async () => {
    savedRunningOrderIs(show, pirates());
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await startEditing(wrapper, "Captain Hook");
    await choose(wrapper, "newcomer");
    await save(wrapper, "Captain Hook");

    expect(castOn(wrapper, "Captain Hook")).toBe("Jo Newcomer");
  });

  it("makes a role uncast when the cast member is cleared", async () => {
    savedRunningOrderIs(show, pirates());
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await startEditing(wrapper, "Captain Hook");
    await search(wrapper).setValue("");
    await save(wrapper, "Captain Hook");

    expect(card(wrapper, "Captain Hook")?.get("[data-test=uncast]").text()).toBe("Uncast");
  });

  it("renames and resizes a role, moving it to its new place", async () => {
    savedRunningOrderIs(show, [...pirates(), roleWith(4, "Wendy", "lead")]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await startEditing(wrapper, "Smee");
    await editForm(wrapper, "Smee").get("input[name=name]").setValue("Mr Smee");
    await editForm(wrapper, "Smee").get("select[name=size]").setValue("lead");
    await save(wrapper, "Smee");

    expect(cardNames(wrapper)).toEqual(["Captain Hook", "Mr Smee", "Wendy", "Parrot"]);
  });

  it.each([
    ["", "Enter a role name"],
    ["captain hook", "Pirate Sketch already has a role called Captain Hook"],
  ])(
    "checks the edit like a new role (name %j), leaving the role unchanged",
    async (name, message) => {
      savedRunningOrderIs(show, pirates());
      const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

      await startEditing(wrapper, "Smee");
      await editForm(wrapper, "Smee").get("input[name=name]").setValue(name);
      await save(wrapper, "Smee");

      const describedBy = editForm(wrapper, "Smee")
        .get("input[name=name]")
        .attributes("aria-describedby");
      expect(describedBy && document.getElementById(describedBy)?.textContent?.trim()).toBe(
        message,
      );
      // The form holds the card while open; once closed, Smee is as it was.
      await editForm(wrapper, "Smee").get("[data-test=cancel]").trigger("click");
      await flushPromises();
      expect(cardNames(wrapper)).toContain("Smee");
    },
  );

  it("leaves the role unchanged when cancelled", async () => {
    savedRunningOrderIs(show, pirates());
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await startEditing(wrapper, "Smee");
    await editForm(wrapper, "Smee").get("input[name=name]").setValue("Mr Smee");
    await editForm(wrapper, "Smee").get("[data-test=cancel]").trigger("click");
    await flushPromises();

    expect(wrapper.find("form[aria-label='Edit Smee']").exists()).toBe(false);
    expect(cardNames(wrapper)).toContain("Smee");
  });

  it("doesn't overwrite someone else's edit, showing the latest roles", async () => {
    const stored = savedRunningOrderIs(show, pirates());
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startEditing(wrapper, "Smee");
    // Someone else renames Smee after this page loaded.
    stored[1] = { ...roleWith(2, "Bosun", "support"), revision: 2 };

    await editForm(wrapper, "Smee").get("input[name=name]").setValue("Mr Smee");
    await save(wrapper, "Smee");

    expect(wrapper.get("main [role=alert]").text()).toBe(
      "Someone else changed this role. Showing the latest roles.",
    );
    expect(cardNames(wrapper)).toContain("Bosun");
    expect(cardNames(wrapper)).not.toContain("Mr Smee");
  });

  it("explains when someone else removed the role being edited", async () => {
    const stored = savedRunningOrderIs(show, pirates());
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await startEditing(wrapper, "Smee");
    stored.splice(1, 1);

    await save(wrapper, "Smee");

    expect(wrapper.get("main [role=alert]").text()).toBe(
      "Someone else changed this role. Showing the latest roles.",
    );
    expect(cardNames(wrapper)).not.toContain("Smee");
  });
});

describe("Removing a role", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  type Page = Awaited<ReturnType<typeof openAppAt>>["wrapper"];

  const parrot = () => ({
    ...aRole("pirate-sketch", "Parrot", "cameo"),
    id: 3,
    castMemberIds: [12],
  });
  const smee = () => ({ ...aRole("pirate-sketch", "Smee", "support"), id: 2 });
  const cardNames = (wrapper: Page) =>
    wrapper.findAll("[data-test=role] .role-name").map((name) => name.text());

  async function remove(wrapper: Page, name: string) {
    await wrapper.get(`button[aria-label='Remove ${name}']`).trigger("click");
    await flushPromises();
  }

  it("asks first, naming the role and the item", async () => {
    savedRunningOrderIs(show, [smee(), parrot()]);
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await remove(wrapper, "Parrot");

    expect(confirm).toHaveBeenCalledWith(
      "Remove the role Parrot from Pirate Sketch? Anyone cast in it will be uncast.",
    );
  });

  it("removes the role for good once confirmed", async () => {
    savedRunningOrderIs(show, [smee(), parrot()]);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const first = await openAppAt("/casting/items/pirate-sketch");

    await remove(first.wrapper, "Parrot");

    expect(cardNames(first.wrapper)).toEqual(["Smee"]);
    first.wrapper.unmount();
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    expect(cardNames(wrapper)).toEqual(["Smee"]);
  });

  it("keeps the role when cancelled", async () => {
    savedRunningOrderIs(show, [smee(), parrot()]);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await remove(wrapper, "Parrot");

    expect(cardNames(wrapper)).toEqual(["Smee", "Parrot"]);
  });

  it("shows the empty state when the last role is removed", async () => {
    savedRunningOrderIs(show, [parrot()]);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await remove(wrapper, "Parrot");

    expect(wrapper.text()).toContain("No roles have been added yet.");
  });

  it("refuses to remove a role someone else edited, showing it as they left it", async () => {
    const stored = savedRunningOrderIs(show, [smee(), parrot()]);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    stored[1] = { ...parrot(), name: "Polly", revision: 2 };

    await remove(wrapper, "Parrot");

    expect(wrapper.get("main [role=alert]").text()).toBe(
      "Someone else changed this role. Showing the latest roles.",
    );
    expect(cardNames(wrapper)).toEqual(["Smee", "Polly"]);
  });

  it("explains when someone else already removed the role", async () => {
    const stored = savedRunningOrderIs(show, [smee(), parrot()]);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    stored.splice(1, 1);

    await remove(wrapper, "Parrot");

    expect(wrapper.get("main [role=alert]").text()).toBe(
      "Someone else changed this role. Showing the latest roles.",
    );
    expect(cardNames(wrapper)).toEqual(["Smee"]);
  });
});

describe("Ensemble members", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  type Page = Awaited<ReturnType<typeof openAppAt>>["wrapper"];

  const pirates = (castMemberIds: number[]) => [
    { ...aRole("pirate-sketch", "Pirates", "ensemble"), id: 9, castMemberIds },
  ];
  const form = (wrapper: Page) => wrapper.get("form[aria-label='Edit Pirates']");
  const castOnCard = (wrapper: Page) => wrapper.get("[data-test=role] [data-test=cast]").text();
  const members = (wrapper: Page) =>
    form(wrapper)
      .findAll("[data-test=member] .member-name")
      .map((name) => name.text());

  async function edit(wrapper: Page) {
    await wrapper.get("button[aria-label='Edit Pirates']").trigger("click");
    await flushPromises();
  }

  async function addMember(wrapper: Page, typed: string) {
    const search = form(wrapper).get("input[name=castMember]");
    await search.setValue(typed);
    await search.trigger("keydown", { key: "ArrowDown" });
    await search.trigger("keydown", { key: "Enter" });
  }

  async function save(wrapper: Page) {
    await form(wrapper).trigger("submit");
    await flushPromises();
  }

  it("adds a member to an ensemble", async () => {
    savedRunningOrderIs(show, pirates([12]));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await edit(wrapper);
    await addMember(wrapper, "sample");
    expect(members(wrapper)).toEqual(["Sam Example", "Alex Sample"]);
    await save(wrapper);

    expect(castOnCard(wrapper)).toBe("Sam Example, Alex Sample");
  });

  it("lists an ensemble's members by last name on the card", async () => {
    savedRunningOrderIs(show, pirates([12, 15, 14]));

    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(castOnCard(wrapper)).toBe("Zoë Adams, Sam Example, Jo Newcomer");
  });

  it("removes a member from an ensemble", async () => {
    savedRunningOrderIs(show, pirates([12, 13]));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await edit(wrapper);
    await form(wrapper)
      .get("button[aria-label='Remove Alex Sample from Pirates']")
      .trigger("click");
    await save(wrapper);

    expect(castOnCard(wrapper)).toBe("Sam Example");
  });

  it("leaves the ensemble uncast when its last member is removed", async () => {
    savedRunningOrderIs(show, pirates([12]));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await edit(wrapper);
    await form(wrapper)
      .get("button[aria-label='Remove Sam Example from Pirates']")
      .trigger("click");
    await save(wrapper);

    expect(wrapper.get("[data-test=role] [data-test=uncast]").text()).toBe("Uncast");
  });

  it("doesn't offer someone already in the ensemble", async () => {
    savedRunningOrderIs(show, pirates([12]));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await edit(wrapper);
    await form(wrapper).get("input[name=castMember]").setValue("sam");

    const offered = form(wrapper)
      .findAll("[role=option] .choice-name")
      .map((name) => name.text());
    expect(offered).toEqual(["Alex Sample"]);
  });

  it("refuses to narrow an ensemble that has several people, saying so by the size", async () => {
    savedRunningOrderIs(show, pirates([12, 13]));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await edit(wrapper);
    await form(wrapper).get("select[name=size]").setValue("cameo");
    await save(wrapper);

    const describedBy = form(wrapper).get("select[name=size]").attributes("aria-describedby");
    expect(describedBy && document.getElementById(describedBy)?.textContent?.trim()).toBe(
      "Leave one person in this ensemble before making it a Cameo role",
    );
    // Nothing was saved: the form is still open and nothing was sent.
    const puts = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(puts).toEqual([]);
    expect(wrapper.find("form[aria-label='Edit Pirates']").exists()).toBe(true);
  });

  it("keeps focus in the form and says who was removed", async () => {
    savedRunningOrderIs(show, pirates([12, 13]));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await edit(wrapper);
    await form(wrapper)
      .get("button[aria-label='Remove Alex Sample from Pirates']")
      .trigger("click");
    await flushPromises();

    expect(document.activeElement).toBe(form(wrapper).get("input[name=castMember]").element);
    expect(form(wrapper).get(".members + [role=status]").text()).toBe("Removed Alex Sample.");
  });

  it("lets an ensemble with one person become a single-person role", async () => {
    savedRunningOrderIs(show, pirates([12]));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    await edit(wrapper);
    await form(wrapper).get("select[name=size]").setValue("cameo");
    await save(wrapper);

    expect(wrapper.get("[data-test=role] [data-test=size]").text()).toBe("Cameo");
    expect(castOnCard(wrapper)).toBe("Sam Example");
  });
});

describe("Role card buttons", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("puts the icons first on each card, like the Running order and Items pages", async () => {
    savedRunningOrderIs(show, [{ ...aRole("pirate-sketch", "Parrot", "cameo"), id: 3 }]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const first = wrapper.get("[data-test=role] > *");
    expect(first.classes()).toContain("role-actions");
    expect(first.find("button[aria-label='Edit Parrot']").exists()).toBe(true);
  });

  it("puts each ensemble member's remove icon before their name", async () => {
    savedRunningOrderIs(show, [
      { ...aRole("pirate-sketch", "Pirates", "ensemble"), id: 9, castMemberIds: [12] },
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await wrapper.get("button[aria-label='Edit Pirates']").trigger("click");
    await flushPromises();

    const member = wrapper.get("[data-test=member]");
    expect(member.get(":scope > *").element.tagName).toBe("BUTTON");
  });

  it("uses icon buttons like the Running order, each named and explained", async () => {
    savedRunningOrderIs(show, [{ ...aRole("pirate-sketch", "Parrot", "cameo"), id: 3 }]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const edit = wrapper.get("button[aria-label='Edit Parrot']");
    const remove = wrapper.get("button[aria-label='Remove Parrot']");
    expect(edit.classes()).toContain("icon-button");
    expect(edit.get("svg[aria-hidden=true]").attributes("data-icon")).toBe("pen");
    expect(edit.attributes("data-tooltip")).toBe("Edit role");
    expect(remove.classes()).toContain("icon-button");
    expect(remove.get("svg[aria-hidden=true]").attributes("data-icon")).toBe("trash-can");
    expect(remove.attributes("data-tooltip")).toBe("Remove role");
  });

  it("uses an icon button to remove an ensemble member", async () => {
    savedRunningOrderIs(show, [
      { ...aRole("pirate-sketch", "Pirates", "ensemble"), id: 9, castMemberIds: [12] },
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");
    await wrapper.get("button[aria-label='Edit Pirates']").trigger("click");
    await flushPromises();

    const remove = wrapper.get("button[aria-label='Remove Sam Example from Pirates']");
    expect(remove.classes()).toContain("icon-button");
    expect(remove.get("svg[aria-hidden=true]").attributes("data-icon")).toBe("trash-can");
    expect(remove.attributes("data-tooltip")).toBe("Remove from the ensemble");
  });
});

describe("Clashes on an item's page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  // First half: Opening Number, Pirate Sketch, Dance One. Second half: Campfire Song, Finale.
  const clashShow = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch"), anItem("Dance One")],
    [anItem("Campfire Song"), anItem("Finale")],
  );
  let nextRoleId = 100;
  const cast = (itemId: string, size: Role["size"], castMemberIds: number[], name?: string) => ({
    ...aRole(itemId, name ?? `Role ${nextRoleId}`, size),
    id: nextRoleId++,
    castMemberIds,
  });
  const SAM = 12;
  const ALEX = 13;

  type Page = Awaited<ReturnType<typeof openAppAt>>["wrapper"];
  /** Every place a person's name appears on the page. */
  const namesOf = (wrapper: Page, name: string) =>
    wrapper.findAll("[data-test=cast-name]").filter((el) => el.text().startsWith(name));
  /** Whether any of a person's clash descriptions is a back-to-back clash. */
  const isBackToBack = (wrapper: Page, name: string) =>
    namesOf(wrapper, name).some((el) => el.text().includes("back-to-back"));
  const clashOf = (wrapper: Page, name: string) =>
    namesOf(wrapper, name)[0]?.find("[data-test=clash]");

  it("shows an error by someone in named parts in two items in a row, on both items", async () => {
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [SAM]),
      cast("pirate-sketch", "support", [SAM]),
    ]);

    for (const item of ["opening-number", "pirate-sketch"]) {
      const { wrapper } = await openAppAt(`/casting/items/${item}`);
      expect(clashOf(wrapper, "Sam Example")?.attributes("data-severity")).toBe("error");
      wrapper.unmount();
    }
  });

  it("says what the clash is and with which item", async () => {
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [SAM]),
      cast("pirate-sketch", "support", [SAM]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(clashOf(wrapper, "Sam Example")?.get("[data-test=clash-description]").text()).toBe(
      "Error: back-to-back. Lead in 'Opening Number', then Support in 'Pirate Sketch'",
    );
  });

  it("can be reached by keyboard and is read out in words", async () => {
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [SAM]),
      cast("pirate-sketch", "support", [SAM]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const icon = clashOf(wrapper, "Sam Example")?.get("[data-test=clash-icon]");
    expect(icon?.attributes("tabindex")).toBe("0");
    expect(icon?.attributes("role")).toBe("img");
    expect(icon?.attributes("aria-label")).toBe(
      "Error: back-to-back. Lead in 'Opening Number', then Support in 'Pirate Sketch'",
    );
  });

  it("marks someone wherever their name appears, by their biggest part", async () => {
    savedRunningOrderIs(clashShow, [
      cast("pirate-sketch", "lead", [SAM], "Captain Hook"),
      cast("pirate-sketch", "ensemble", [SAM, ALEX], "Pirates"),
      cast("opening-number", "cameo", [SAM]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const sam = namesOf(wrapper, "Sam Example");
    expect(sam).toHaveLength(2);
    for (const name of sam) {
      expect(name.find("[data-test=clash]").attributes("data-severity")).toBe("error");
    }
    expect(clashOf(wrapper, "Alex Sample")?.exists()).toBe(false);
  });

  it("doesn't count items with another item between them", async () => {
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [SAM]),
      cast("dance-one", "lead", [SAM]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/opening-number");

    // Five minutes apart: a quick change since casting-rules E2.S3, but not back-to-back.
    expect(namesOf(wrapper, "Sam Example")).toHaveLength(1);
    expect(isBackToBack(wrapper, "Sam Example")).toBe(false);
  });

  it("doesn't count items either side of the interval", async () => {
    savedRunningOrderIs(clashShow, [
      cast("dance-one", "lead", [SAM]),
      cast("campfire-song", "lead", [SAM]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/dance-one");

    expect(clashOf(wrapper, "Sam Example")?.exists()).toBe(false);
  });

  it("shows no icon for someone without a clash", async () => {
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [ALEX]),
      cast("opening-number", "support", [SAM]),
      cast("pirate-sketch", "support", [SAM]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/opening-number");

    expect(namesOf(wrapper, "Alex Sample")).toHaveLength(1);
    expect(clashOf(wrapper, "Alex Sample")?.exists()).toBe(false);
  });

  it("clears the error once the clashing role is removed", async () => {
    vi.stubGlobal("confirm", () => true);
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [SAM]),
      cast("pirate-sketch", "support", [SAM], "First Mate"),
    ]);
    const { wrapper, router } = await openAppAt("/casting/items/pirate-sketch");
    await wrapper.get("button[aria-label='Remove First Mate']").trigger("click");
    await flushPromises();

    await router.push("/casting/items/opening-number");
    await flushPromises();

    expect(namesOf(wrapper, "Sam Example")).toHaveLength(1);
    expect(clashOf(wrapper, "Sam Example")?.exists()).toBe(false);
  });

  it("clears the error once a running order moving the items apart is saved", async () => {
    const roles = [cast("opening-number", "lead", [SAM]), cast("pirate-sketch", "support", [SAM])];
    savedRunningOrderIs(clashShow, roles);
    const before = await openAppAt("/casting/items/opening-number");
    expect(clashOf(before.wrapper, "Sam Example")?.exists()).toBe(true);
    before.wrapper.unmount();

    // Saved on the Running order page: Dance One now sits between the two.
    savedRunningOrderIs(
      aRunningOrder(
        [anItem("Opening Number"), anItem("Dance One"), anItem("Pirate Sketch")],
        [anItem("Campfire Song"), anItem("Finale")],
        8,
      ),
      roles,
    );
    const { wrapper } = await openAppAt("/casting/items/opening-number");

    // Dance One's 5 minutes now make it a quick change, but not back-to-back.
    expect(namesOf(wrapper, "Sam Example")).toHaveLength(1);
    expect(isBackToBack(wrapper, "Sam Example")).toBe(false);
  });

  it.each([
    ["a named part then an ensemble", "lead", "ensemble"],
    ["an ensemble then a named part", "ensemble", "cameo"],
    ["two ensembles", "ensemble", "ensemble"],
  ] as const)("shows a warning, not an error, for %s", async (_, firstPart, secondPart) => {
    savedRunningOrderIs(clashShow, [
      cast("opening-number", firstPart, [SAM]),
      cast("pirate-sketch", secondPart, [SAM]),
    ]);

    for (const item of ["opening-number", "pirate-sketch"]) {
      const { wrapper } = await openAppAt(`/casting/items/${item}`);
      expect(clashOf(wrapper, "Sam Example")?.attributes("data-severity")).toBe("warning");
      wrapper.unmount();
    }
  });

  it("says a warning is a warning, and why", async () => {
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [SAM]),
      cast("pirate-sketch", "ensemble", [SAM]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(clashOf(wrapper, "Sam Example")?.get("[data-test=clash-description]").text()).toBe(
      "Warning: back-to-back. Lead in 'Opening Number', then Ensemble in 'Pirate Sketch'",
    );
  });

  it("gives warnings and errors different shapes, and says which in words", async () => {
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [SAM]),
      cast("pirate-sketch", "support", [SAM]),
      cast("opening-number", "ensemble", [ALEX]),
      cast("pirate-sketch", "cameo", [ALEX]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const error = clashOf(wrapper, "Sam Example")?.get("[data-test=clash-icon]");
    const warning = clashOf(wrapper, "Alex Sample")?.get("[data-test=clash-icon]");
    expect(error?.get("svg").attributes("data-icon")).toBe("square-xmark");
    expect(warning?.get("svg").attributes("data-icon")).toBe("triangle-exclamation");
    expect(error?.attributes("aria-label")).toMatch(/^Error: /);
    expect(warning?.attributes("aria-label")).toMatch(/^Warning: /);
  });

  it("shows one icon at the worst severity, describing every clash", async () => {
    // The warning (with Opening Number) comes before the error (with Dance One) in the show.
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "ensemble", [SAM]),
      cast("pirate-sketch", "support", [SAM]),
      cast("dance-one", "lead", [SAM]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const sam = namesOf(wrapper, "Sam Example")[0];
    expect(sam?.findAll("[data-test=clash]")).toHaveLength(1);
    expect(sam?.get("[data-test=clash]").attributes("data-severity")).toBe("error");
    expect(sam?.findAll(".clash-line").map((line) => line.text())).toEqual([
      "Error: back-to-back. Support in 'Pirate Sketch', then Lead in 'Dance One'",
      "Warning: back-to-back. Ensemble in 'Opening Number', then Support in 'Pirate Sketch'",
    ]);
  });

  // Opening Number 5, Pirate Sketch 4, Dance One 3, Song Two 2, Sketch Two 6 minutes; then
  // the interval; then Campfire Song 5, Finale 8.
  const timedShow = (intervalMinutes = 20) => ({
    ...aRunningOrder(
      [
        anItem("Opening Number", { minutes: 5 }),
        anItem("Pirate Sketch", { minutes: 4 }),
        anItem("Dance One", { minutes: 3 }),
        anItem("Song Two", { minutes: 2 }),
        anItem("Sketch Two", { minutes: 6 }),
      ],
      [anItem("Campfire Song", { minutes: 5 }), anItem("Finale", { minutes: 8 })],
    ),
    intervalMinutes,
  });
  const samIn = (...itemIds: string[]) => itemIds.map((itemId) => cast(itemId, "lead", [SAM]));
  const linesOf = (wrapper: Page, name: string) =>
    namesOf(wrapper, name)[0]
      ?.findAll(".clash-line")
      .map((line) => line.text()) ?? [];

  it("warns about less than 5 minutes between appearances, on both items", async () => {
    savedRunningOrderIs(timedShow(), samIn("opening-number", "dance-one"));

    for (const item of ["opening-number", "dance-one"]) {
      const { wrapper } = await openAppAt(`/casting/items/${item}`);
      expect(clashOf(wrapper, "Sam Example")?.attributes("data-severity")).toBe("warning");
      expect(linesOf(wrapper, "Sam Example")).toEqual([
        "Warning: short gap. Only 4 minutes between 'Opening Number' and 'Dance One' (needs at least 5 minutes)",
      ]);
      wrapper.unmount();
    }
  });

  it("adds up every item between, so 5 minutes is a quick change", async () => {
    savedRunningOrderIs(timedShow(), samIn("pirate-sketch", "sketch-two"));
    const { wrapper } = await openAppAt("/casting/items/sketch-two");

    expect(clashOf(wrapper, "Sam Example")?.attributes("data-severity")).toBe("info");
    expect(linesOf(wrapper, "Sam Example")).toEqual([
      "Info: quick change. 5 minutes between 'Pirate Sketch' and 'Sketch Two'",
    ]);
  });

  it("notes a quick change for 5 to under 8 minutes", async () => {
    savedRunningOrderIs(timedShow(), samIn("opening-number", "song-two"));
    const { wrapper } = await openAppAt("/casting/items/song-two");

    expect(clashOf(wrapper, "Sam Example")?.attributes("data-severity")).toBe("info");
    expect(linesOf(wrapper, "Sam Example")).toEqual([
      "Info: quick change. 7 minutes between 'Opening Number' and 'Song Two'",
    ]);
  });

  it("needs nothing for exactly 8 minutes", async () => {
    savedRunningOrderIs(timedShow(8), samIn("sketch-two", "campfire-song"));
    const { wrapper } = await openAppAt("/casting/items/campfire-song");

    expect(namesOf(wrapper, "Sam Example")).toHaveLength(1);
    expect(clashOf(wrapper, "Sam Example")?.exists()).toBe(false);
  });

  it("counts the interval towards the gap", async () => {
    savedRunningOrderIs(timedShow(4), samIn("sketch-two", "campfire-song"));
    const { wrapper } = await openAppAt("/casting/items/campfire-song");

    expect(linesOf(wrapper, "Sam Example")).toEqual([
      "Warning: short gap. Only 4 minutes between 'Sketch Two' and 'Campfire Song' (needs at least 5 minutes)",
    ]);
  });

  it("compares each appearance only with the next one", async () => {
    savedRunningOrderIs(timedShow(), samIn("opening-number", "pirate-sketch", "dance-one"));
    const { wrapper } = await openAppAt("/casting/items/opening-number");

    expect(linesOf(wrapper, "Sam Example")).toEqual([
      "Error: back-to-back. Lead in 'Opening Number', then Lead in 'Pirate Sketch'",
    ]);
  });

  it("reports back-to-back appearances once, not also as a timing warning", async () => {
    savedRunningOrderIs(timedShow(), samIn("opening-number", "pirate-sketch"));
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(linesOf(wrapper, "Sam Example")).toEqual([
      "Error: back-to-back. Lead in 'Opening Number', then Lead in 'Pirate Sketch'",
    ]);
  });

  it("gives info its own shape, and says Info in words", async () => {
    savedRunningOrderIs(timedShow(), [
      ...samIn("opening-number", "song-two"),
      cast("pirate-sketch", "lead", [ALEX]),
      cast("song-two", "lead", [ALEX]),
      cast("song-two", "cameo", [15]),
      cast("sketch-two", "cameo", [15]),
    ]);
    const { wrapper } = await openAppAt("/casting/items/song-two");

    const shapes = ["Sam Example", "Alex Sample", "Zoë Adams"].map((name) => {
      const icon = clashOf(wrapper, name)?.get("[data-test=clash-icon]");
      return [
        icon?.attributes("aria-label")?.split(":")[0],
        icon?.get("svg").attributes("data-icon"),
      ];
    });
    expect(shapes.map(([label]) => label)).toEqual(["Info", "Warning", "Error"]);
    expect(shapes.map(([, shape]) => shape)).toEqual([
      "circle-info",
      "triangle-exclamation",
      "square-xmark",
    ]);
  });

  it("shows a timing warning over a quick change, describing both", async () => {
    // Pirate Sketch → Sketch Two is a 5-minute quick change; Sketch Two → Campfire Song is
    // only the 3-minute interval.
    savedRunningOrderIs(timedShow(3), samIn("pirate-sketch", "sketch-two", "campfire-song"));
    const { wrapper } = await openAppAt("/casting/items/sketch-two");

    expect(clashOf(wrapper, "Sam Example")?.attributes("data-severity")).toBe("warning");
    expect(linesOf(wrapper, "Sam Example")).toEqual([
      "Warning: short gap. Only 3 minutes between 'Sketch Two' and 'Campfire Song' (needs at least 5 minutes)",
      "Info: quick change. 5 minutes between 'Pirate Sketch' and 'Sketch Two'",
    ]);
  });

  it("marks each line with its severity, so quick changes can be quieter on phones", async () => {
    savedRunningOrderIs(timedShow(3), samIn("pirate-sketch", "sketch-two", "campfire-song"));
    const { wrapper } = await openAppAt("/casting/items/sketch-two");

    const lines = namesOf(wrapper, "Sam Example")[0]?.findAll(".clash-line") ?? [];
    expect(lines.map((line) => line.classes())).toEqual([
      ["clash-line", "clash-line-warning"],
      ["clash-line", "clash-line-info"],
    ]);
  });

  it("shows no icons when the casting can't be loaded", async () => {
    // The roles would clash, but the cast list fails, so nothing can be shown as checked.
    savedRunningOrderIs(clashShow, [
      cast("opening-number", "lead", [SAM]),
      cast("pirate-sketch", "support", [SAM]),
    ]);
    const fetchShow = vi.mocked(fetch);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) =>
        url === CAST_PATH ? new Response(null, { status: 500 }) : fetchShow(url, init),
      ),
    );
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.find("[role=alert]").text()).toContain("Couldn't load");
    expect(wrapper.find("[data-test=clash]").exists()).toBe(false);
  });
});
