import {
  AddPropRequest,
  type CastMember,
  type ItemNote,
  type Prop,
  type Role,
  type RunningOrder,
  SaveItemNoteRequest,
  UpdatePropRequest,
} from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { ITEM_NOTES_PATH } from "@/utils/item-notes.ts";
import { PROPS_PATH } from "@/utils/props.ts";
import { PROPS_NOTES_PATH } from "@/utils/props-notes.ts";
import { ROLES_PATH } from "@/utils/roles.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  useLocalSignIn();
});

// Made-up items, in show order: Opening Number, Pirate Sketch | Campfire Song, Finale.
const show = aRunningOrder(
  [anItem("Opening Number"), anItem("Pirate Sketch")],
  [anItem("Campfire Song"), anItem("Finale")],
);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const aProp = (
  id: number,
  itemId: string,
  name: string,
  roleIds: number[] = [],
  quantity = 1,
  carrierIds: number[] = [],
): Prop => ({ id, itemId, name, quantity, roleIds, carrierIds });

/** A prop as the API may hold it: one saved before props had quantities or carriers has
 *  none. */
type SavedProp = Omit<Prop, "quantity" | "carrierIds"> & {
  quantity?: number;
  carrierIds?: number[];
};

/** The casting the props page reads names from: every role, and the cast list. */
interface Casting {
  roles: Role[];
  cast: CastMember[];
}

/** A stand-in API holding one saved running order, its casting and the props added so far.
 *  Returns the live props, so a test can check what was saved. */
function savedShowIs(
  order: RunningOrder | undefined,
  props: SavedProp[] = [],
  casting: Casting = { roles: [], cast: [] },
) {
  const stored = [...props];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === RUNNING_ORDER_PATH) {
        return order ? json(order) : new Response(null, { status: 404 });
      }
      if (url === PROPS_PATH) return json({ productionId: "2027", props: stored });
      if (url === PROPS_NOTES_PATH) return json({ productionId: "2027", notes: [] });
      if (url === ROLES_PATH) return json({ productionId: "2027", roles: casting.roles });
      if (url === CAST_PATH) return json({ productionId: "2027", members: casting.cast });
      const addTo = /\/items\/([^/]+)\/props$/.exec(url)?.[1];
      if (addTo && init?.method === "POST") {
        const details = AddPropRequest.parse(JSON.parse(String(init.body)));
        const prop = { ...details, id: stored.length + 1, itemId: addTo };
        stored.push(prop);
        return json(prop, 201);
      }
      const propId = Number(/\/props\/(\d+)$/.exec(url)?.[1]);
      const at = stored.findIndex((prop) => prop.id === propId);
      const prop = stored[at];
      if (propId && !prop) return new Response(null, { status: 404 });
      if (prop && init?.method === "PUT") {
        stored[at] = { ...prop, ...UpdatePropRequest.parse(JSON.parse(String(init.body))) };
        return json(stored[at]);
      }
      if (prop && init?.method === "DELETE") stored.splice(at, 1);
      return new Response(null, { status: 204 });
    }),
  );
  return stored;
}

/** Makes every add fail, as when the API can't be reached. */
function addingFails() {
  const fetch = vi.mocked(globalThis.fetch);
  const answer = fetch.getMockImplementation();
  fetch.mockImplementation(async (url, init) =>
    init?.method === "POST"
      ? new Response(null, { status: 500 })
      : (answer?.(url, init) ?? json({})),
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

const PIRATE_PROPS = "/production/items/pirate-sketch/props";

const stepLinks = (wrapper: VueWrapper) =>
  wrapper.findAll("main nav[aria-label='Item navigation'] a[rel]").map((link) => ({
    rel: link.attributes("rel"),
    text: link.text().replace(/\s+/g, " "),
    href: link.attributes("href"),
  }));

/** Each card's name, with its quantity when it shows one: "Umbrella ×10". */
const propsShown = (wrapper: VueWrapper) =>
  wrapper.findAll("[data-test=prop]").map((card) =>
    [card.find("[data-test=prop-name]"), card.find("[data-test=quantity]")]
      .filter((part) => part.exists())
      .map((part) => part.text())
      .join(" "),
  );

async function addProp(wrapper: VueWrapper, name: string) {
  await wrapper.get("[data-test=add-prop]").trigger("click");
  await wrapper.get("input[name=name]").setValue(name);
  await wrapper.get("form[aria-label='Add prop']").trigger("submit");
  await flushPromises();
}

/** The error shown next to a field: the one its aria-describedby points at. */
const errorFor = (wrapper: VueWrapper, field: string) => {
  const id = wrapper.get(`[name=${field}]`).attributes("aria-describedby");
  return id ? document.getElementById(id)?.textContent?.trim() : undefined;
};

describe("An item's props page", () => {
  it("opens from the Overview, showing the item's name, position and a tab named for it", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt("/production/overview");

    await wrapper.get(`main a[href='${PIRATE_PROPS}']`).trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe(PIRATE_PROPS);
    expect(wrapper.get("main h1").text()).toBe("Props: Pirate Sketch");
    expect(wrapper.get("[data-test=position]").text()).toBe("Item 2 · First half");
    expect(document.title).toBe("Props: Pirate Sketch · iCUE");
  });

  it("goes back to the Overview from All items", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt(PIRATE_PROPS);

    const allItems = wrapper.get("main nav[aria-label='Item navigation'] a");
    expect(allItems.text()).toBe("All items");
    await allItems.trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("says when no props have been added", async () => {
    savedShowIs(show, [aProp(1, "finale", "Confetti")]);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.get("main").text()).toContain("No props have been added yet.");
    expect(propsShown(wrapper)).toEqual([]);
  });

  it("links to the previous and next items' props pages, named by title", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(stepLinks(wrapper)).toEqual([
      {
        rel: "prev",
        text: "Previous Opening Number",
        href: "/production/items/opening-number/props",
      },
      { rel: "next", text: "Next Campfire Song", href: "/production/items/campfire-song/props" },
    ]);
  });

  it("steps across the interval like the casting item page, opening that item's props", async () => {
    savedShowIs(show, [aProp(1, "campfire-song", "Marshmallows")]);
    const { wrapper, router } = await openAppAt(PIRATE_PROPS);

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/production/items/campfire-song/props");
    expect(wrapper.get("main h1").text()).toBe("Props: Campfire Song");
    expect(propsShown(wrapper)).toEqual(["Marshmallows"]);
    expect(stepLinks(wrapper).map((link) => link.text)).toEqual([
      "Previous Pirate Sketch",
      "Next Finale",
    ]);
    expect(document.title).toBe("Props: Campfire Song · iCUE");
  });

  it("has no Previous on the first item, and no Next on the last", async () => {
    savedShowIs(show);
    const first = await openAppAt("/production/items/opening-number/props");
    expect(stepLinks(first.wrapper).map((link) => link.rel)).toEqual(["next"]);
    first.wrapper.unmount();

    const { wrapper } = await openAppAt("/production/items/finale/props");
    expect(stepLinks(wrapper).map((link) => link.rel)).toEqual(["prev"]);
  });

  it("opens the same item's props page from its own address", async () => {
    savedShowIs(show, [aProp(1, "pirate-sketch", "Treasure chest")]);

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.get("main h1").text()).toBe("Props: Pirate Sketch");
    expect(propsShown(wrapper)).toEqual(["Treasure chest"]);
  });

  it("has a help button beside the item's name", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    const row = wrapper.get("main .page-title-row");
    expect(row.get("h1").text()).toBe("Props: Pirate Sketch");
    expect(row.find("button[aria-label='Help for this item']").exists()).toBe(true);
  });

  it("marks the Production overview as the current page in the menu", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    const current = wrapper.findAll("nav a[aria-current=page]");
    expect(current.map((link) => link.attributes("href"))).toEqual(["/production/overview"]);
  });

  it("says an item that isn't in the running order wasn't found, with a link back to the Overview", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt("/production/items/no-such-item/props");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(document.title).toBe("Item not found · iCUE");
    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("says the item wasn't found when there's no saved running order", async () => {
    savedShowIs(undefined);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.get("main h1").text()).toBe("Item not found");
  });

  it("reports a failed load rather than not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the item.");
    expect(wrapper.get("main").text()).not.toContain("Item not found");
  });

  it("lists props alphabetically, ignoring case, with numbers by value", async () => {
    savedShowIs(show, [
      aProp(1, "pirate-sketch", "umbrella 10"),
      aProp(2, "pirate-sketch", "Treasure chest"),
      aProp(3, "pirate-sketch", "Umbrella 2"),
    ]);

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(propsShown(wrapper)).toEqual(["Treasure chest", "Umbrella 2", "umbrella 10"]);
  });
});

describe("Adding a prop", () => {
  it("adds a prop by name as a card, kept on reload and counted on the Overview, for Stage", async () => {
    await signInAs(["stage"], "pat");
    const stored = savedShowIs(show);
    const first = await openAppAt(PIRATE_PROPS);

    await addProp(first.wrapper, "Treasure chest");

    expect(propsShown(first.wrapper)).toEqual(["Treasure chest"]);
    expect(first.wrapper.text()).not.toContain("No props have been added yet.");
    expect(stored).toEqual([aProp(1, "pirate-sketch", "Treasure chest")]);
    first.wrapper.unmount();

    const { wrapper, router } = await openAppAt(PIRATE_PROPS);
    expect(propsShown(wrapper)).toEqual(["Treasure chest"]);

    await wrapper.get("main nav[aria-label='Item navigation'] a").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("production-overview");
    const row = wrapper.get("[data-test=item][data-item-id=pirate-sketch]");
    expect(row.get("[data-test=count] .visually-hidden").text()).toBe("1 prop");
  });

  it("lets an admin add a prop, as for Stage", async () => {
    await signInAs(["admin"], "alex");
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await addProp(wrapper, "Parrot");

    expect(propsShown(wrapper)).toEqual(["Parrot"]);
    expect(stored).toEqual([aProp(1, "pirate-sketch", "Parrot")]);
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("says a prop needs a name when it's %s, saving nothing", async (_case, name) => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await addProp(wrapper, name);

    expect(errorFor(wrapper, "name")).toBe("A prop needs a name");
    expect(propsShown(wrapper)).toEqual([]);
    expect(stored).toEqual([]);
  });

  it("refuses a name over 80 characters, saving nothing", async () => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await addProp(wrapper, "x".repeat(81));

    expect(errorFor(wrapper, "name")).toBe("Prop names can be up to 80 characters");
    expect(stored).toEqual([]);
  });

  it("adds nothing when cancelled", async () => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await wrapper.get("[data-test=add-prop]").trigger("click");
    await wrapper.get("input[name=name]").setValue("Treasure chest");

    await wrapper.get("[data-test=cancel]").trigger("click");
    await flushPromises();

    expect(wrapper.find("form[aria-label='Add prop']").exists()).toBe(false);
    expect(stored).toEqual([]);
  });

  it("says when a prop couldn't be added, keeping the name typed", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    addingFails();

    await addProp(wrapper, "Treasure chest");

    expect(wrapper.get("form [role=alert]").text()).toBe("Couldn't add the prop. Try again.");
    expect(wrapper.get<HTMLInputElement>("input[name=name]").element.value).toBe("Treasure chest");
    expect(propsShown(wrapper)).toEqual([]);
  });

  it("closes an unsaved Add prop on stepping to the next item, so it can't be added there", async () => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await wrapper.get("[data-test=add-prop]").trigger("click");
    await wrapper.get("input[name=name]").setValue("Treasure chest");

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Props: Campfire Song");
    expect(wrapper.find("form[aria-label='Add prop']").exists()).toBe(false);
    await wrapper.get("[data-test=add-prop]").trigger("click");
    expect(wrapper.get<HTMLInputElement>("input[name=name]").element.value).toBe("");
    expect(wrapper.find("form [role=alert]").exists()).toBe(false);
    expect(stored).toEqual([]);
  });

  it("offers no Add prop without Stage, saying the props can only be viewed", async () => {
    await signInAs(["casting"], "sam");
    savedShowIs(show, [aProp(1, "pirate-sketch", "Treasure chest")]);

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.find("[data-test=add-prop]").exists()).toBe(false);
    expect(wrapper.get("[data-test=read-only]").text()).toBe(
      "You can view the props, but not change them.",
    );
    expect(propsShown(wrapper)).toEqual(["Treasure chest"]);
  });

  it("doesn't say the props are view-only to someone with Stage", async () => {
    await signInAs(["stage"], "pat");
    savedShowIs(show);

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.find("[data-test=add-prop]").exists()).toBe(true);
    expect(wrapper.find("[data-test=read-only]").exists()).toBe(false);
  });
});

describe("Props notes", () => {
  /** The stand-in API, now also holding each item's props notes and casting notes.
   *  Returns the live props notes. */
  function notesAre({ props = [], casting = [] }: { props?: ItemNote[]; casting?: ItemNote[] }) {
    savedShowIs(show);
    const fetch = vi.mocked(globalThis.fetch);
    const answer = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, init) => {
      if (url === PROPS_NOTES_PATH) return json({ productionId: "2027", notes: props });
      if (url === ITEM_NOTES_PATH) return json({ productionId: "2027", notes: casting });
      const notesOf = /\/items\/([^/]+)\/props-notes$/.exec(String(url))?.[1];
      if (notesOf && init?.method === "PUT") {
        const { text, revision } = SaveItemNoteRequest.parse(JSON.parse(String(init.body)));
        const index = props.findIndex((n) => n.itemId === notesOf);
        if ((props[index]?.revision ?? 0) !== revision) return new Response(null, { status: 409 });
        const saved = { itemId: notesOf, text, revision: revision + 1 };
        if (index === -1) props.push(saved);
        else props[index] = saved;
        return json(saved);
      }
      return answer?.(url, init) ?? json({});
    });
    return props;
  }

  const notesSection = (wrapper: VueWrapper) =>
    wrapper.get("section[aria-labelledby=notes-heading]");
  const field = (wrapper: VueWrapper) => notesSection(wrapper).get<HTMLTextAreaElement>("textarea");
  const error = (wrapper: VueWrapper) => notesSection(wrapper).find("[data-test=notes-error]");

  async function saveNotes(wrapper: VueWrapper, text: string) {
    await field(wrapper).setValue(text);
    await notesSection(wrapper).get("form").trigger("submit");
    await flushPromises();
  }

  const notePuts = () => vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT");

  beforeEach(() => signInAs(["stage"], "pat"));

  it("saves props notes for Stage, saying so, and keeps them for the next visit", async () => {
    notesAre({});
    const first = await openAppAt(PIRATE_PROPS);
    expect(notesSection(first.wrapper).get("h2").text()).toBe("Props notes");

    await saveNotes(first.wrapper, "Chest set stage left before the blackout");

    expect(notesSection(first.wrapper).get("[data-test=notes-status]").text()).toBe("Notes saved.");
    expect(notePuts().map(([url]) => url)).toEqual([
      "/api/productions/2027/items/pirate-sketch/props-notes",
    ]);
    first.wrapper.unmount();

    const { wrapper } = await openAppAt(PIRATE_PROPS);
    expect(field(wrapper).element.value).toBe("Chest set stage left before the blackout");
  });

  it("keeps props notes apart from the item's casting notes", async () => {
    notesAre({
      casting: [
        { itemId: "pirate-sketch", text: "Captain needs a sword fight rehearsal", revision: 1 },
      ],
    });
    const props = await openAppAt(PIRATE_PROPS);
    expect(field(props.wrapper).element.value).toBe("");

    await saveNotes(props.wrapper, "Chest set stage left");
    props.wrapper.unmount();

    const casting = await openAppAt("/casting/items/pirate-sketch");
    // pat, with Stage only, reads the casting notes.
    expect(notesSection(casting.wrapper).get("[data-test=notes-text]").text()).toBe(
      "Captain needs a sword fight rehearsal",
    );
    casting.wrapper.unmount();
    const again = await openAppAt(PIRATE_PROPS);
    expect(field(again.wrapper).element.value).toBe("Chest set stage left");
  });

  it("says the 500-character limit up front, and refuses longer notes, saving nothing", async () => {
    notesAre({});
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    expect(notesSection(wrapper).get("[data-test=notes-hint]").text()).toBe("Up to 500 characters");

    await saveNotes(wrapper, "x".repeat(501));

    expect(error(wrapper).text()).toBe("Notes can be up to 500 characters.");
    expect(notePuts()).toEqual([]);
  });

  it("removes the props notes when they're cleared and saved", async () => {
    const stored = notesAre({ props: [{ itemId: "pirate-sketch", text: "Chest", revision: 1 }] });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await saveNotes(wrapper, "");

    expect(stored).toEqual([{ itemId: "pirate-sketch", text: "", revision: 2 }]);
  });

  it("refuses a save after someone else's, showing their notes", async () => {
    const stored = notesAre({});
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    stored.push({ itemId: "pirate-sketch", text: "Theirs", revision: 1 });

    await saveNotes(wrapper, "Mine");

    expect(error(wrapper).text()).toBe(
      "Someone else changed these notes. Here they are now; your text wasn't saved.",
    );
    expect(field(wrapper).element.value).toBe("Theirs");
    expect(stored[0]?.text).toBe("Theirs");
  });

  it("keeps the text when the notes can't be saved", async () => {
    notesAre({});
    const fetch = vi.mocked(globalThis.fetch);
    const answer = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, init) =>
      init?.method === "PUT"
        ? new Response(null, { status: 500 })
        : (answer?.(url, init) ?? json({})),
    );
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await saveNotes(wrapper, "Chest set stage left");

    expect(error(wrapper).text()).toBe("Couldn't save the notes. Try again.");
    expect(field(wrapper).element.value).toBe("Chest set stage left");
  });

  it("shows the props notes without Stage, with nothing to change them", async () => {
    await signInAs(["casting"], "sam");
    notesAre({ props: [{ itemId: "pirate-sketch", text: "Chest set stage left", revision: 1 }] });

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe("Chest set stage left");
    expect(notesSection(wrapper).find("textarea").exists()).toBe(false);
    expect(notesSection(wrapper).find("button").exists()).toBe(false);
  });
});

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const member = (id: number, firstName: string, lastName: string): CastMember => ({
  id,
  firstName,
  lastName,
  section: null,
  group: "",
  singing: "",
  acting: "",
  revision: 1,
});
const sam = member(1, "Sam", "Taylor");
const lee = member(2, "Lee", "Patel");
const jo = member(3, "Jo", "Brown");
const kim = member(4, "Kim", "Lee");
const ash = member(5, "Ash", "Green");
const ray = member(6, "Ray", "Hill");
const cast = [sam, lee, jo, kim, ash, ray];

const aRole = (
  id: number,
  itemId: string,
  name: string,
  size: Role["size"],
  castMemberIds: number[] = [],
): Role => ({ id, itemId, name, size, castMemberIds, revision: 1 });
const captain = aRole(1, "pirate-sketch", "Captain", "lead", [sam.id]);
const pirate1 = aRole(2, "pirate-sketch", "Pirate 1", "support", [lee.id]);
const pirate2 = aRole(3, "pirate-sketch", "Pirate 2", "support", [ash.id]);
const pirate3 = aRole(4, "pirate-sketch", "Pirate 3", "support", [ray.id]);
const parrot = aRole(5, "pirate-sketch", "Parrot", "cameo");
const crew = aRole(6, "pirate-sketch", "Crew", "ensemble", [kim.id, jo.id]);
const pirateKing = aRole(7, "finale", "Pirate King", "lead");
const roles = [captain, pirate1, pirate2, pirate3, parrot, crew, pirateKing];

/** Each role on a prop's card, with who plays it or the uncast marker. */
const rolesOn = (wrapper: VueWrapper, propName: string) =>
  wrapper
    .findAll("[data-test=prop]")
    .find((card) => card.get("[data-test=prop-name]").text() === propName)
    ?.findAll("[data-test=prop-role]")
    .map((role) => ({
      role: role.get("[data-test=prop-role-name]").text(),
      cast: (role.find("[data-test=cast]").exists()
        ? role.get("[data-test=cast]")
        : role.get("[data-test=uncast]")
      ).text(),
    }));

const roleSearch = (wrapper: VueWrapper) =>
  wrapper.get<HTMLInputElement>("input[role=combobox][name=role]");
const offeredRoles = (wrapper: VueWrapper) =>
  wrapper.findAll("[role=listbox] [role=option] .choice-name").map((name) => name.text());
const pickedRoles = (wrapper: VueWrapper) =>
  wrapper.findAll("[data-test=picked-role] .member-name").map((name) => name.text());

async function searchRoles(wrapper: VueWrapper, text: string) {
  await roleSearch(wrapper).setValue(text);
  await flushPromises();
}

/** Picks one more role in the open form, searching for its exact name. */
async function pickRole(wrapper: VueWrapper, roleName: string) {
  await searchRoles(wrapper, roleName);
  const option = wrapper
    .findAll("[role=option]")
    .find((choice) => choice.get(".choice-name").text() === roleName);
  await option?.trigger("mousedown");
}

/** Opens Add prop, names it and picks each role. */
async function startProp(wrapper: VueWrapper, name: string, roleNames: string[] = []) {
  await wrapper.get("[data-test=add-prop]").trigger("click");
  await wrapper.get("input[name=name]").setValue(name);
  for (const roleName of roleNames) await pickRole(wrapper, roleName);
}

async function saveProp(wrapper: VueWrapper) {
  await wrapper.get("form[aria-label='Add prop']").trigger("submit");
  await flushPromises();
}

describe("A prop's roles", () => {
  beforeEach(() => signInAs(["stage"], "pat"));

  it("adds a prop with no roles when none are picked", async () => {
    const stored = savedShowIs(show, [], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await startProp(wrapper, "Treasure chest");
    await saveProp(wrapper);

    expect(propsShown(wrapper)).toEqual(["Treasure chest"]);
    expect(rolesOn(wrapper, "Treasure chest")).toEqual([]);
    expect(stored[0]?.roleIds).toEqual([]);
  });

  it("adds a prop with one role, showing the role and who plays it", async () => {
    const stored = savedShowIs(show, [], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await startProp(wrapper, "Telescope", ["Captain"]);
    await saveProp(wrapper);

    expect(rolesOn(wrapper, "Telescope")).toEqual([{ role: "Captain", cast: "Sam Taylor" }]);
    expect(stored[0]?.roleIds).toEqual([captain.id]);
  });

  it("adds a prop with many roles, each with its cast member", async () => {
    savedShowIs(show, [], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await startProp(wrapper, "Umbrella", ["Pirate 1", "Pirate 2", "Pirate 3"]);
    expect(pickedRoles(wrapper)).toEqual(["Pirate 1", "Pirate 2", "Pirate 3"]);
    // Enough for every pirate, so they all carry one.
    await wrapper.get("input[name=quantity]").setValue("3");
    await saveProp(wrapper);

    expect(rolesOn(wrapper, "Umbrella")).toEqual([
      { role: "Pirate 1", cast: "Lee Patel" },
      { role: "Pirate 2", cast: "Ash Green" },
      { role: "Pirate 3", cast: "Ray Hill" },
    ]);
  });

  it("offers only the item's own roles, by name, under a visible label", async () => {
    savedShowIs(show, [], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await startProp(wrapper, "Cutlass");

    await searchRoles(wrapper, "pirate");

    expect(offeredRoles(wrapper)).toEqual(["Pirate 1", "Pirate 2", "Pirate 3"]);
    const label = wrapper.get(`label[for='${roleSearch(wrapper).attributes("id")}']`);
    expect(label.text()).toBe("Add a role");
  });

  it("picks a role with the down arrow and Enter, then no longer offers it", async () => {
    savedShowIs(show, [], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await startProp(wrapper, "Cutlass");
    await searchRoles(wrapper, "pirate");

    await roleSearch(wrapper).trigger("keydown", { key: "ArrowDown" });
    await roleSearch(wrapper).trigger("keydown", { key: "Enter" });

    expect(pickedRoles(wrapper)).toEqual(["Pirate 1"]);
    expect(roleSearch(wrapper).element.value).toBe("");
    expect(wrapper.find("[data-test=prop]").exists()).toBe(false);
    await searchRoles(wrapper, "pirate");
    expect(offeredRoles(wrapper)).toEqual(["Pirate 2", "Pirate 3"]);
  });

  it("drops a picked role when its remove button is pressed", async () => {
    const stored = savedShowIs(show, [], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await startProp(wrapper, "Cutlass", ["Pirate 1", "Pirate 2"]);

    await wrapper.get("[aria-label='Remove Pirate 1 from the prop']").trigger("click");
    await saveProp(wrapper);

    expect(stored[0]?.roleIds).toEqual([pirate2.id]);
  });

  it("refuses typed text that wasn't chosen, saying so next to the field", async () => {
    const stored = savedShowIs(show, [], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await startProp(wrapper, "Cutlass");
    await searchRoles(wrapper, "pir");

    await saveProp(wrapper);

    expect(errorFor(wrapper, "role")).toBe("Choose a role from the list, or clear the field");
    expect(stored).toEqual([]);
  });

  it("marks a role nobody is cast in as uncast", async () => {
    savedShowIs(show, [aProp(1, "pirate-sketch", "Cracker", [parrot.id])], { roles, cast });

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(rolesOn(wrapper, "Cracker")).toEqual([{ role: "Parrot", cast: "Uncast" }]);
  });

  it("names everyone in an ensemble role, by surname", async () => {
    savedShowIs(show, [aProp(1, "pirate-sketch", "Rope", [crew.id], 2)], { roles, cast });

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(rolesOn(wrapper, "Rope")).toEqual([{ role: "Crew", cast: "Jo Brown, Kim Lee" }]);
  });

  it("shows who plays each role now, after a recast, without editing the prop", async () => {
    const telescope = aProp(1, "pirate-sketch", "Telescope", [captain.id]);
    savedShowIs(show, [telescope], { roles, cast });
    const first = await openAppAt(PIRATE_PROPS);
    expect(rolesOn(first.wrapper, "Telescope")).toEqual([{ role: "Captain", cast: "Sam Taylor" }]);
    first.wrapper.unmount();

    const recast = { ...captain, castMemberIds: [lee.id], revision: 2 };
    savedShowIs(show, [telescope], { roles: [recast], cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(rolesOn(wrapper, "Telescope")).toEqual([{ role: "Captain", cast: "Lee Patel" }]);
  });

  it("shows a role's new name after it's renamed", async () => {
    const renamed = { ...captain, name: "Captain Hook", revision: 2 };
    savedShowIs(show, [aProp(1, "pirate-sketch", "Telescope", [captain.id])], {
      roles: [renamed],
      cast,
    });

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(rolesOn(wrapper, "Telescope")).toEqual([{ role: "Captain Hook", cast: "Sam Taylor" }]);
  });

  it("keeps a prop whose roles were removed, showing only the roles left", async () => {
    savedShowIs(
      show,
      [
        aProp(1, "pirate-sketch", "Telescope", [captain.id, pirate1.id]),
        aProp(2, "pirate-sketch", "Spyglass", [captain.id]),
      ],
      { roles: [pirate1], cast },
    );

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(propsShown(wrapper)).toEqual(["Spyglass", "Telescope"]);
    expect(rolesOn(wrapper, "Telescope")).toEqual([{ role: "Pirate 1", cast: "Lee Patel" }]);
    expect(rolesOn(wrapper, "Spyglass")).toEqual([]);
  });

  it("lists a prop's roles in the item's role order, leads first", async () => {
    savedShowIs(show, [aProp(1, "pirate-sketch", "Map", [pirate1.id, captain.id])], {
      roles,
      cast,
    });

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(rolesOn(wrapper, "Map")?.map(({ role }) => role)).toEqual(["Captain", "Pirate 1"]);
  });
});

describe("Editing and removing a prop", () => {
  beforeEach(() => signInAs(["stage"], "pat"));

  const telescope = () => aProp(1, "pirate-sketch", "Telescope", [captain.id]);
  const editForm = (wrapper: VueWrapper) => wrapper.get("form[aria-label^='Edit ']");

  async function startEditing(wrapper: VueWrapper, name: string) {
    await wrapper.get(`button[aria-label='Edit ${name}']`).trigger("click");
  }

  async function saveEdit(wrapper: VueWrapper) {
    await editForm(wrapper).trigger("submit");
    await flushPromises();
  }

  async function remove(wrapper: VueWrapper, name: string) {
    await wrapper.get(`button[aria-label='Remove ${name}']`).trigger("click");
    await flushPromises();
  }

  /** Makes every edit and removal fail, as when the API can't be reached. */
  function changesFail() {
    const fetch = vi.mocked(globalThis.fetch);
    const answer = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, init) =>
      init?.method === "PUT" || init?.method === "DELETE"
        ? new Response(null, { status: 500 })
        : (answer?.(url, init) ?? json({})),
    );
  }

  it("renames a prop from its pencil, moving it to its alphabetical place, kept on reload", async () => {
    const stored = savedShowIs(show, [
      aProp(1, "pirate-sketch", "Treasure chest"),
      aProp(2, "pirate-sketch", "Anchor"),
      aProp(3, "pirate-sketch", "Hat"),
    ]);
    const first = await openAppAt(PIRATE_PROPS);

    await startEditing(first.wrapper, "Treasure chest");
    expect(editForm(first.wrapper).get<HTMLInputElement>("input[name=name]").element.value).toBe(
      "Treasure chest",
    );
    await editForm(first.wrapper).get("input[name=name]").setValue("Gold chest");
    await saveEdit(first.wrapper);

    expect(propsShown(first.wrapper)).toEqual(["Anchor", "Gold chest", "Hat"]);
    expect(first.wrapper.find("form[aria-label^='Edit ']").exists()).toBe(false);
    expect(stored.find((prop) => prop.id === 1)?.name).toBe("Gold chest");
    first.wrapper.unmount();

    const { wrapper } = await openAppAt(PIRATE_PROPS);
    expect(propsShown(wrapper)).toEqual(["Anchor", "Gold chest", "Hat"]);
  });

  it("changes a prop's roles, showing only the new ones with their cast", async () => {
    const stored = savedShowIs(show, [telescope()], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await startEditing(wrapper, "Telescope");
    expect(pickedRoles(wrapper)).toEqual(["Captain"]);
    await pickRole(wrapper, "Pirate 1");
    await wrapper.get("[aria-label='Remove Captain from the prop']").trigger("click");
    await saveEdit(wrapper);

    expect(rolesOn(wrapper, "Telescope")).toEqual([{ role: "Pirate 1", cast: "Lee Patel" }]);
    expect(stored[0]?.roleIds).toEqual([pirate1.id]);
  });

  it("changes nothing when an edit is cancelled", async () => {
    const stored = savedShowIs(show, [telescope()], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await startEditing(wrapper, "Telescope");
    await editForm(wrapper).get("input[name=name]").setValue("Spyglass");
    await wrapper.get("[aria-label='Remove Captain from the prop']").trigger("click");
    await editForm(wrapper).get("[data-test=cancel]").trigger("click");
    await flushPromises();

    expect(propsShown(wrapper)).toEqual(["Telescope"]);
    expect(rolesOn(wrapper, "Telescope")).toEqual([{ role: "Captain", cast: "Sam Taylor" }]);
    expect(stored).toEqual([telescope()]);
  });

  it("says an edited prop needs a name when it's cleared, saving nothing", async () => {
    const stored = savedShowIs(show, [telescope()], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await startEditing(wrapper, "Telescope");
    await editForm(wrapper).get("input[name=name]").setValue("");
    await saveEdit(wrapper);

    expect(errorFor(wrapper, "name")).toBe("A prop needs a name");
    expect(stored).toEqual([telescope()]);
  });

  it("removes a prop after asking, naming the prop and the item, counted on the Overview", async () => {
    const stored = savedShowIs(show, [telescope(), aProp(2, "pirate-sketch", "Parrot")], {
      roles,
      cast,
    });
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);
    const { wrapper, router } = await openAppAt(PIRATE_PROPS);

    await remove(wrapper, "Telescope");

    expect(confirm).toHaveBeenCalledWith("Remove the prop Telescope from Pirate Sketch?");
    expect(propsShown(wrapper)).toEqual(["Parrot"]);
    expect(stored.map((prop) => prop.name)).toEqual(["Parrot"]);
    await wrapper.get("main nav[aria-label='Item navigation'] a").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("production-overview");
    const row = wrapper.get("[data-test=item][data-item-id=pirate-sketch]");
    expect(row.get("[data-test=count] .visually-hidden").text()).toBe("1 prop");
  });

  it("keeps a prop when its removal is cancelled", async () => {
    const stored = savedShowIs(show, [telescope()], { roles, cast });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await remove(wrapper, "Telescope");

    expect(propsShown(wrapper)).toEqual(["Telescope"]);
    expect(stored).toEqual([telescope()]);
  });

  it("shows the props without a pencil or trash can to someone without Stage", async () => {
    await signInAs(["casting"], "sam");
    savedShowIs(show, [telescope()], { roles, cast });

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(propsShown(wrapper)).toEqual(["Telescope"]);
    expect(wrapper.find("button[aria-label='Edit Telescope']").exists()).toBe(false);
    expect(wrapper.find("button[aria-label='Remove Telescope']").exists()).toBe(false);
  });

  it("says when a prop being edited has gone, showing the props as they are now", async () => {
    const stored = savedShowIs(show, [telescope(), aProp(2, "pirate-sketch", "Parrot")], {
      roles,
      cast,
    });
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await startEditing(wrapper, "Telescope");
    stored.splice(0, 1);
    stored.push(aProp(3, "pirate-sketch", "Map"));

    await editForm(wrapper).get("input[name=name]").setValue("Spyglass");
    await saveEdit(wrapper);

    expect(wrapper.get("main [role=alert]").text()).toBe(
      "Telescope is no longer there: someone else removed it. Showing the latest props.",
    );
    expect(wrapper.find("form[aria-label^='Edit ']").exists()).toBe(false);
    expect(propsShown(wrapper)).toEqual(["Map", "Parrot"]);
  });

  it("says when a prop being removed has already gone, showing the props as they are now", async () => {
    const stored = savedShowIs(show, [telescope(), aProp(2, "pirate-sketch", "Parrot")], {
      roles,
      cast,
    });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    stored.splice(0, 1);

    await remove(wrapper, "Telescope");

    expect(wrapper.get("main [role=alert]").text()).toBe(
      "Telescope is no longer there: someone else removed it. Showing the latest props.",
    );
    expect(propsShown(wrapper)).toEqual(["Parrot"]);
  });

  it("drops a removed role's lingering link when the prop is next saved", async () => {
    const stored = savedShowIs(show, [aProp(1, "pirate-sketch", "Telescope", [captain.id, 99])], {
      roles,
      cast,
    });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await startEditing(wrapper, "Telescope");
    await editForm(wrapper).get("input[name=name]").setValue("Spyglass");
    await saveEdit(wrapper);

    expect(stored[0]).toMatchObject({ name: "Spyglass", roleIds: [captain.id] });
  });

  it("asks for a reload when a prop has gone and the latest props can't be loaded", async () => {
    const stored = savedShowIs(show, [telescope(), aProp(2, "pirate-sketch", "Parrot")], {
      roles,
      cast,
    });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    stored.splice(0, 1);
    const fetch = vi.mocked(globalThis.fetch);
    const answer = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, init) =>
      String(url).endsWith("/props") && !init?.method
        ? new Response(null, { status: 500 })
        : (answer?.(url, init) ?? json({})),
    );

    await remove(wrapper, "Telescope");

    expect(wrapper.get("main [role=alert]").text()).toBe(
      "Telescope is no longer there: someone else removed it. Reload to see the latest.",
    );
  });

  it("says when an edit couldn't be saved, keeping it in the form", async () => {
    const stored = savedShowIs(show, [telescope()], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    changesFail();

    await startEditing(wrapper, "Telescope");
    await editForm(wrapper).get("input[name=name]").setValue("Spyglass");
    await editForm(wrapper).get("input[name=quantity]").setValue("2");
    await pickRole(wrapper, "Pirate 1");
    await saveEdit(wrapper);

    expect(editForm(wrapper).get("[role=alert]").text()).toBe("Couldn't save the prop. Try again.");
    expect(editForm(wrapper).get<HTMLInputElement>("input[name=name]").element.value).toBe(
      "Spyglass",
    );
    expect(pickedRoles(wrapper)).toEqual(["Captain", "Pirate 1"]);
    expect(stored).toEqual([telescope()]);
  });

  it("says when a prop couldn't be removed, keeping it", async () => {
    savedShowIs(show, [telescope()], { roles, cast });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    changesFail();

    await remove(wrapper, "Telescope");

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't remove Telescope. Try again.");
    expect(propsShown(wrapper)).toEqual(["Telescope"]);
  });
});

describe("A prop's quantity", () => {
  beforeEach(() => signInAs(["stage"], "pat"));

  // Made-up items: the village scene needs ten umbrellas.
  const village = aRunningOrder([anItem("Village Square"), anItem("Pirate Sketch")], []);
  const VILLAGE_PROPS = "/production/items/village-square/props";
  const umbrellas = () => aProp(1, "village-square", "Umbrella", [], 10);

  const quantityIn = (form: ReturnType<VueWrapper["get"]>) =>
    form.get<HTMLInputElement>("input[name=quantity]");

  async function addProp(wrapper: VueWrapper, name: string, quantity?: string) {
    await wrapper.get("[data-test=add-prop]").trigger("click");
    await wrapper.get("input[name=name]").setValue(name);
    if (quantity !== undefined) await wrapper.get("input[name=quantity]").setValue(quantity);
    await wrapper.get("form[aria-label='Add prop']").trigger("submit");
    await flushPromises();
  }

  async function editQuantity(wrapper: VueWrapper, name: string, quantity: string) {
    await wrapper.get(`button[aria-label='Edit ${name}']`).trigger("click");
    await saveQuantity(wrapper, quantity);
  }

  async function saveQuantity(wrapper: VueWrapper, quantity: string) {
    await quantityIn(wrapper.get("form[aria-label^='Edit ']")).setValue(quantity);
    await wrapper.get("form[aria-label^='Edit ']").trigger("submit");
    await flushPromises();
  }

  async function openOverviewFrom(wrapper: VueWrapper) {
    await wrapper.get("main nav[aria-label='Item navigation'] a").trigger("click");
    await flushPromises();
    return wrapper.get("[data-test=item][data-item-id=village-square] [data-test=count]");
  }

  it("starts a new prop at a quantity of 1, under its label, and shows none on its card", async () => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await wrapper.get("[data-test=add-prop]").trigger("click");
    const quantity = quantityIn(wrapper.get("form[aria-label='Add prop']"));
    expect(quantity.element.value).toBe("1");
    expect(quantity.attributes("inputmode")).toBe("numeric");
    expect(wrapper.get(`label[for='${quantity.attributes("id")}']`).text()).toBe("Quantity");
    await wrapper.get("input[name=name]").setValue("Telescope");
    await wrapper.get("form[aria-label='Add prop']").trigger("submit");
    await flushPromises();

    expect(propsShown(wrapper)).toEqual(["Telescope"]);
    expect(wrapper.find("[data-test=prop] [data-test=quantity]").exists()).toBe(false);
    expect(stored).toEqual([aProp(1, "pirate-sketch", "Telescope")]);
  });

  it("adds a prop with a quantity above 1, showing it after the name, kept on reload", async () => {
    const stored = savedShowIs(village);
    const first = await openAppAt(VILLAGE_PROPS);

    await addProp(first.wrapper, "Umbrella", "10");

    expect(propsShown(first.wrapper)).toEqual(["Umbrella ×10"]);
    // A real space, so a screen reader hears "Umbrella times 10", not one word.
    expect(first.wrapper.get("[data-test=prop]").text()).toContain("Umbrella ×10");
    expect(stored).toEqual([umbrellas()]);
    first.wrapper.unmount();

    const { wrapper } = await openAppAt(VILLAGE_PROPS);
    expect(propsShown(wrapper)).toEqual(["Umbrella ×10"]);
  });

  it("changes a prop's quantity from its pencil", async () => {
    const stored = savedShowIs(village, [umbrellas()]);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await wrapper.get("button[aria-label='Edit Umbrella']").trigger("click");
    expect(quantityIn(wrapper.get("form[aria-label='Edit Umbrella']")).element.value).toBe("10");
    await saveQuantity(wrapper, "6");

    expect(propsShown(wrapper)).toEqual(["Umbrella ×6"]);
    expect(stored[0]?.quantity).toBe(6);
  });

  it.each(["0", "100", "2.5", ""])(
    "refuses a new prop's quantity of %j, saying so next to the field, saving nothing",
    async (quantity) => {
      const stored = savedShowIs(village);
      const { wrapper } = await openAppAt(VILLAGE_PROPS);

      await addProp(wrapper, "Umbrella", quantity);

      expect(errorFor(wrapper, "quantity")).toBe("Quantity must be a whole number from 1 to 99");
      expect(stored).toEqual([]);
    },
  );

  it.each(["0", "100", "2.5", ""])(
    "refuses an edited quantity of %j, saying so next to the field, saving nothing",
    async (quantity) => {
      const stored = savedShowIs(village, [umbrellas()]);
      const { wrapper } = await openAppAt(VILLAGE_PROPS);

      await editQuantity(wrapper, "Umbrella", quantity);

      expect(errorFor(wrapper, "quantity")).toBe("Quantity must be a whole number from 1 to 99");
      expect(stored).toEqual([umbrellas()]);
    },
  );

  it("shows a prop saved before props had quantities with none, and edits it from 1", async () => {
    savedShowIs(show, [{ id: 1, itemId: "pirate-sketch", name: "Treasure chest", roleIds: [] }]);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(propsShown(wrapper)).toEqual(["Treasure chest"]);
    await wrapper.get("button[aria-label='Edit Treasure chest']").trigger("click");
    expect(quantityIn(wrapper.get("form[aria-label='Edit Treasure chest']")).element.value).toBe(
      "1",
    );
  });

  it("counts a prop's whole quantity on the Overview", async () => {
    savedShowIs(village, [umbrellas(), aProp(2, "village-square", "Telescope")]);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    const count = await openOverviewFrom(wrapper);

    expect(count.get("[aria-hidden=true]").text()).toBe("11");
    expect(count.get(".visually-hidden").text()).toBe("11 props");
  });

  it("takes a removed prop's whole quantity off the Overview's count", async () => {
    savedShowIs(village, [umbrellas(), aProp(2, "village-square", "Telescope")]);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await wrapper.get("button[aria-label='Remove Umbrella']").trigger("click");
    await flushPromises();

    expect(propsShown(wrapper)).toEqual(["Telescope"]);
    expect((await openOverviewFrom(wrapper)).get("[aria-hidden=true]").text()).toBe("1");
  });
});

describe("Who carries a prop", () => {
  beforeEach(() => signInAs(["stage"], "pat"));

  // Made-up item and casting: three villagers and a baker.
  const village = aRunningOrder([anItem("Village Square"), anItem("Pirate Sketch")], []);
  const VILLAGE_PROPS = "/production/items/village-square/props";
  const alex = member(7, "Alex", "Green");
  const villagers = aRole(10, "village-square", "Villagers", "ensemble", [jo.id, kim.id, alex.id]);
  const baker = aRole(11, "village-square", "Baker", "lead", [sam.id]);
  const villageCasting = { roles: [...roles, villagers, baker], cast: [...cast, alex] };

  const carrierSearch = (wrapper: VueWrapper) =>
    wrapper.find<HTMLInputElement>("input[role=combobox][name=carrier]");
  /** The carrier picker's list: everyone it offers before any typing narrows it. */
  const carrierOptions = (wrapper: VueWrapper) =>
    wrapper.findAll(`[id='${carrierSearch(wrapper).attributes("aria-controls")}'] [role=option]`);
  const offeredCarriers = (wrapper: VueWrapper) =>
    carrierOptions(wrapper).map((option) => option.get(".choice-name").text());
  const chosenCarriers = (wrapper: VueWrapper) =>
    wrapper.findAll("[data-test=carrier] .member-name").map((name) => name.text());
  const carriersHint = (wrapper: VueWrapper) => wrapper.get("[data-test=carriers-hint]");
  const leftToChoose = (wrapper: VueWrapper, propName: string) =>
    wrapper
      .findAll("[data-test=prop]")
      .find((card) => card.get("[data-test=prop-name]").text() === propName)
      ?.find("[data-test=to-choose]");

  const notGiven = (wrapper: VueWrapper, propName: string) =>
    wrapper
      .findAll("[data-test=prop]")
      .find((card) => card.get("[data-test=prop-name]").text() === propName)
      ?.find("[data-test=not-given]");

  async function setQuantity(wrapper: VueWrapper, quantity: string) {
    await wrapper.get("input[name=quantity]").setValue(quantity);
  }

  /** Searches by first name, as the cast search matches one name at a time. */
  async function chooseCarrier(wrapper: VueWrapper, name: string) {
    await carrierSearch(wrapper).setValue(name.split(" ")[0]);
    const option = carrierOptions(wrapper).find(
      (choice) => choice.get(".choice-name").text() === name,
    );
    await option?.trigger("mousedown");
  }

  async function removeCarrier(wrapper: VueWrapper, name: string) {
    await wrapper.get(`[aria-label='Remove ${name} from the carriers']`).trigger("click");
  }

  async function saveEdited(wrapper: VueWrapper) {
    await wrapper.get("form[aria-label^='Edit ']").trigger("submit");
    await flushPromises();
  }

  it("offers no carrier picker when the cast fits the quantity, showing who plays the role", async () => {
    const stored = savedShowIs(show, [], { roles, cast });
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await startProp(wrapper, "Telescope", ["Captain"]);
    expect(carrierSearch(wrapper).exists()).toBe(false);
    await saveProp(wrapper);

    expect(rolesOn(wrapper, "Telescope")).toEqual([{ role: "Captain", cast: "Sam Taylor" }]);
    expect(stored[0]?.carrierIds).toEqual([]);
  });

  it("offers no carrier picker when the quantity covers the whole ensemble, showing them all", async () => {
    savedShowIs(village, [], villageCasting);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await startProp(wrapper, "Umbrella", ["Villagers"]);
    await setQuantity(wrapper, "10");
    expect(carrierSearch(wrapper).exists()).toBe(false);
    await saveProp(wrapper);

    expect(rolesOn(wrapper, "Umbrella")).toEqual([
      { role: "Villagers", cast: "Jo Brown, Alex Green, Kim Lee" },
    ]);
    expect(leftToChoose(wrapper, "Umbrella")?.exists()).toBe(false);
    expect(notGiven(wrapper, "Umbrella")?.text()).toBe("7 not given to anyone");
  });

  it("offers a labelled carrier picker of the role's cast when there are more than the quantity", async () => {
    savedShowIs(village, [], villageCasting);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await startProp(wrapper, "Bread basket", ["Villagers"]);

    const label = wrapper.get(`label[for='${carrierSearch(wrapper).attributes("id")}']`);
    expect(label.text()).toBe("Who carries it");
    expect(offeredCarriers(wrapper)).toEqual(["Jo Brown", "Alex Green", "Kim Lee"]);
    expect(carriersHint(wrapper).text()).toBe("Choose up to 1");
    expect(carriersHint(wrapper).attributes("role")).toBe("status");
    expect(carrierSearch(wrapper).attributes("aria-describedby")).toBe(
      carriersHint(wrapper).attributes("id"),
    );
    expect(carrierSearch(wrapper).attributes("aria-invalid")).toBeUndefined();
    const chosen = wrapper.get("ul[data-test=carriers]").attributes("aria-labelledby");
    expect(document.getElementById(chosen ?? "")?.textContent).toBe("Selected carriers");
  });

  it("shows only the chosen carrier on the card, kept on reload", async () => {
    const stored = savedShowIs(village, [], villageCasting);
    const first = await openAppAt(VILLAGE_PROPS);

    await startProp(first.wrapper, "Bread basket", ["Villagers"]);
    await chooseCarrier(first.wrapper, "Kim Lee");
    expect(chosenCarriers(first.wrapper)).toEqual(["Kim Lee"]);
    await saveProp(first.wrapper);

    expect(rolesOn(first.wrapper, "Bread basket")).toEqual([
      { role: "Villagers", cast: "Kim Lee" },
    ]);
    expect(stored[0]?.carrierIds).toEqual([kim.id]);
    first.wrapper.unmount();
    const { wrapper } = await openAppAt(VILLAGE_PROPS);
    expect(rolesOn(wrapper, "Bread basket")).toEqual([{ role: "Villagers", cast: "Kim Lee" }]);
  });

  it("turns the search off once the quantity is chosen, until someone is removed", async () => {
    savedShowIs(village, [], villageCasting);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);
    await startProp(wrapper, "Bread basket", ["Villagers"]);
    await setQuantity(wrapper, "2");

    await chooseCarrier(wrapper, "Jo Brown");
    expect(carriersHint(wrapper).text()).toBe("Choose up to 2 · 1 left to choose");
    await chooseCarrier(wrapper, "Kim Lee");

    expect(carriersHint(wrapper).text()).toBe("Choose up to 2 · none left to choose");
    expect(carrierSearch(wrapper).element.disabled).toBe(true);
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Remove Kim Lee from the carriers",
    );
    await removeCarrier(wrapper, "Jo Brown");
    expect(carrierSearch(wrapper).element.disabled).toBe(false);
    expect(offeredCarriers(wrapper)).toEqual(["Jo Brown", "Alex Green"]);
  });

  it("offers only the cast of the prop's roles", async () => {
    savedShowIs(village, [], villageCasting);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await startProp(wrapper, "Bread basket", ["Villagers"]);

    expect(offeredCarriers(wrapper)).not.toContain("Sam Taylor");
  });

  it("offers someone in two of the prop's roles once", async () => {
    const crowd = aRole(12, "village-square", "Crowd", "ensemble", [kim.id, sam.id]);
    savedShowIs(village, [], { ...villageCasting, roles: [...villageCasting.roles, crowd] });
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await startProp(wrapper, "Bread basket", ["Villagers", "Crowd"]);

    expect(offeredCarriers(wrapper)).toEqual(["Jo Brown", "Alex Green", "Kim Lee", "Sam Taylor"]);
  });

  it("always gives a named part the prop, choosing the rest only from the ensemble", async () => {
    const stored = savedShowIs(village, [], villageCasting);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);
    await startProp(wrapper, "Lantern", ["Villagers", "Baker"]);
    await setQuantity(wrapper, "2");

    expect(offeredCarriers(wrapper)).toEqual(["Jo Brown", "Alex Green", "Kim Lee"]);
    expect(carriersHint(wrapper).text()).toBe("Choose up to 1");
    await chooseCarrier(wrapper, "Kim Lee");
    await saveProp(wrapper);

    expect(rolesOn(wrapper, "Lantern")).toEqual([
      { role: "Baker", cast: "Sam Taylor" },
      { role: "Villagers", cast: "Kim Lee" },
    ]);
    expect(stored[0]?.carrierIds).toEqual([kim.id]);
  });

  // Four villagers here, so a quantity of 3 still needs choosing.
  const bigVillage = {
    roles: [{ ...villagers, castMemberIds: [...villagers.castMemberIds, ash.id] }, baker],
    cast: [...cast, alex],
  };

  it("says on the card how many are left to choose", async () => {
    savedShowIs(
      village,
      [
        aProp(1, "village-square", "Lantern", [villagers.id], 3, [jo.id]),
        aProp(2, "village-square", "Torch", [villagers.id], 3),
      ],
      bigVillage,
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    expect(rolesOn(wrapper, "Lantern")).toEqual([{ role: "Villagers", cast: "Jo Brown" }]);
    expect(leftToChoose(wrapper, "Lantern")?.text()).toBe("2 left to choose");
    expect(leftToChoose(wrapper, "Torch")?.text()).toBe("3 left to choose");
  });

  it("says when nobody in one of the prop's roles carries it", async () => {
    savedShowIs(
      village,
      [aProp(1, "village-square", "Lantern", [villagers.id, baker.id], 1, [sam.id])],
      villageCasting,
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    expect(rolesOn(wrapper, "Lantern")).toEqual([
      { role: "Baker", cast: "Sam Taylor" },
      { role: "Villagers", cast: "Nobody carries it" },
    ]);
  });

  it("changes the carriers from the prop's pencil", async () => {
    const stored = savedShowIs(
      village,
      [aProp(1, "village-square", "Bread basket", [villagers.id], 1, [kim.id])],
      villageCasting,
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await wrapper.get("button[aria-label='Edit Bread basket']").trigger("click");
    expect(chosenCarriers(wrapper)).toEqual(["Kim Lee"]);
    await removeCarrier(wrapper, "Kim Lee");
    await chooseCarrier(wrapper, "Alex Green");
    await saveEdited(wrapper);

    expect(rolesOn(wrapper, "Bread basket")).toEqual([{ role: "Villagers", cast: "Alex Green" }]);
    expect(stored[0]?.carrierIds).toEqual([alex.id]);
  });

  it("keeps the ensemble carrying it when another ensemble joins and brings the picker", async () => {
    const crowd = aRole(12, "village-square", "Crowd", "ensemble", [ash.id, sam.id]);
    const stored = savedShowIs(village, [], {
      ...villageCasting,
      roles: [...villageCasting.roles, crowd],
    });
    const { wrapper } = await openAppAt(VILLAGE_PROPS);
    await startProp(wrapper, "Lantern", ["Villagers"]);
    await setQuantity(wrapper, "4");
    expect(carrierSearch(wrapper).exists()).toBe(false);

    await pickRole(wrapper, "Crowd");

    expect(chosenCarriers(wrapper)).toEqual(["Jo Brown", "Alex Green", "Kim Lee"]);
    expect(carriersHint(wrapper).text()).toBe("Choose up to 4 · 1 left to choose");
    await saveProp(wrapper);
    expect(stored[0]?.carrierIds).toEqual([jo.id, alex.id, kim.id]);
  });

  it("offers no picker when the named parts take every place", async () => {
    const stored = savedShowIs(village, [], villageCasting);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await startProp(wrapper, "Lantern", ["Villagers", "Baker"]);
    expect(carrierSearch(wrapper).exists()).toBe(false);
    await saveProp(wrapper);

    expect(rolesOn(wrapper, "Lantern")).toEqual([
      { role: "Baker", cast: "Sam Taylor" },
      { role: "Villagers", cast: "Nobody carries it" },
    ]);
    expect(leftToChoose(wrapper, "Lantern")?.exists()).toBe(false);
    expect(stored[0]?.carrierIds).toEqual([]);
  });

  // Made-up item roles, one person each: nobody needs choosing among them.
  const referee = aRole(20, "village-square", "Referee", "support", [jo.id]);
  const cross = aRole(21, "village-square", "Captain Cross", "lead", [kim.id]);
  const nought = aRole(22, "village-square", "Captain Nought", "lead", [sam.id]);
  const knots = { roles: [...roles, referee, cross, nought], cast };

  it("lets every named part carry it with no picker when the quantity covers them", async () => {
    savedShowIs(village, [], knots);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await startProp(wrapper, "Whistle", ["Referee", "Captain Cross", "Captain Nought"]);
    await setQuantity(wrapper, "3");
    expect(carrierSearch(wrapper).exists()).toBe(false);
    await saveProp(wrapper);

    expect(rolesOn(wrapper, "Whistle")).toEqual([
      { role: "Captain Cross", cast: "Kim Lee" },
      { role: "Captain Nought", cast: "Sam Taylor" },
      { role: "Referee", cast: "Jo Brown" },
    ]);
  });

  it("says on the card how many aren't given to anyone", async () => {
    savedShowIs(
      village,
      [
        aProp(1, "village-square", "Whistle", [cross.id, nought.id], 3),
        aProp(2, "village-square", "Bell", [], 2),
      ],
      knots,
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    expect(rolesOn(wrapper, "Whistle")).toEqual([
      { role: "Captain Cross", cast: "Kim Lee" },
      { role: "Captain Nought", cast: "Sam Taylor" },
    ]);
    expect(notGiven(wrapper, "Whistle")?.text()).toBe("1 not given to anyone");
    expect(notGiven(wrapper, "Bell")?.exists()).toBe(false);
  });

  it("won't save a quantity below the named parts, saying how many it needs", async () => {
    const stored = savedShowIs(village, [], knots);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await startProp(wrapper, "Whistle", ["Referee", "Captain Cross", "Captain Nought"]);
    await setQuantity(wrapper, "2");
    expect(carrierSearch(wrapper).exists()).toBe(false);
    await saveProp(wrapper);

    expect(stored).toEqual([]);
    const quantity = wrapper.get("input[name=quantity]");
    expect(quantity.attributes("aria-invalid")).toBe("true");
    expect(
      document.getElementById(quantity.attributes("aria-describedby") ?? "")?.textContent?.trim(),
    ).toBe(
      "Captain Cross, Captain Nought and Referee always carry it: make the quantity at least 3",
    );
  });

  it("chooses nobody for you when a lower quantity brings the picker", async () => {
    savedShowIs(village, [], villageCasting);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);
    await startProp(wrapper, "Lantern", ["Villagers"]);
    await setQuantity(wrapper, "3");

    await setQuantity(wrapper, "2");

    expect(chosenCarriers(wrapper)).toEqual([]);
  });

  it("takes off a carrier whose role is dropped", async () => {
    const crowd = aRole(12, "village-square", "Crowd", "ensemble", [ash.id, sam.id]);
    const stored = savedShowIs(village, [], {
      ...villageCasting,
      roles: [...villageCasting.roles, crowd],
    });
    const { wrapper } = await openAppAt(VILLAGE_PROPS);
    await startProp(wrapper, "Lantern", ["Villagers", "Crowd"]);
    await setQuantity(wrapper, "2");
    await chooseCarrier(wrapper, "Sam Taylor");
    await chooseCarrier(wrapper, "Jo Brown");

    await wrapper.get("[aria-label='Remove Crowd from the prop']").trigger("click");
    expect(chosenCarriers(wrapper)).toEqual(["Jo Brown"]);
    await saveProp(wrapper);

    expect(stored[0]?.carrierIds).toEqual([jo.id]);
  });

  it("drops the picker, saving no carriers, once the quantity covers everyone", async () => {
    const stored = savedShowIs(village, [], villageCasting);
    const { wrapper } = await openAppAt(VILLAGE_PROPS);
    await startProp(wrapper, "Lantern", ["Villagers"]);
    await chooseCarrier(wrapper, "Jo Brown");

    await setQuantity(wrapper, "3");
    expect(carrierSearch(wrapper).exists()).toBe(false);
    await saveProp(wrapper);

    expect(stored[0]?.carrierIds).toEqual([]);
  });

  it("shows carriers without a way to change them to someone with Casting only", async () => {
    await signInAs(["casting"], "sam");
    savedShowIs(
      village,
      [aProp(1, "village-square", "Lantern", [villagers.id], 3, [jo.id])],
      bigVillage,
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    expect(rolesOn(wrapper, "Lantern")).toEqual([{ role: "Villagers", cast: "Jo Brown" }]);
    expect(leftToChoose(wrapper, "Lantern")?.text()).toBe("2 left to choose");
    expect(wrapper.find("button[aria-label='Edit Lantern']").exists()).toBe(false);
    expect(wrapper.find("[data-test=add-prop]").exists()).toBe(false);
  });

  // As the API keeps them after a casting change: Kim Lee's id has gone from Villagers, or
  // from the cast too, and the page never shows a carrier who no longer plays the role.
  it.each([
    ["taken out of Villagers", villageCasting.cast],
    ["deleted from the cast", villageCasting.cast.filter((m) => m.id !== kim.id)],
  ])("drops a carrier %s from the card, saying one is left to choose", async (_case, members) => {
    const recast = { ...villagers, castMemberIds: [jo.id, alex.id] };
    savedShowIs(
      village,
      [aProp(1, "village-square", "Bread basket", [villagers.id], 1, [kim.id])],
      {
        roles: [...roles, recast, baker],
        cast: members,
      },
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    expect(rolesOn(wrapper, "Bread basket")).toEqual([
      { role: "Villagers", cast: "Nobody carries it" },
    ]);
    expect(leftToChoose(wrapper, "Bread basket")?.text()).toBe("1 left to choose");
  });

  it("drops the carrier of a removed role from the card, saying one more is to choose", async () => {
    savedShowIs(
      village,
      [aProp(1, "village-square", "Lantern", [villagers.id, baker.id], 2, [jo.id, sam.id])],
      { ...villageCasting, roles: [...roles, villagers] },
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    expect(rolesOn(wrapper, "Lantern")).toEqual([{ role: "Villagers", cast: "Jo Brown" }]);
    expect(leftToChoose(wrapper, "Lantern")?.text()).toBe("1 left to choose");
  });

  it("drops the carriers of a role taken off the prop while editing it", async () => {
    const stored = savedShowIs(
      village,
      [aProp(1, "village-square", "Lantern", [villagers.id, baker.id], 2, [jo.id, sam.id])],
      villageCasting,
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await wrapper.get("button[aria-label='Edit Lantern']").trigger("click");
    await wrapper.get("[aria-label='Remove Baker from the prop']").trigger("click");
    expect(chosenCarriers(wrapper)).toEqual(["Jo Brown"]);
    await saveEdited(wrapper);

    expect(rolesOn(wrapper, "Lantern")).toEqual([{ role: "Villagers", cast: "Jo Brown" }]);
    expect(leftToChoose(wrapper, "Lantern")?.text()).toBe("1 left to choose");
    expect(stored[0]?.carrierIds).toEqual([jo.id]);
  });

  it("shows everyone left in the role carrying it once they fit the quantity", async () => {
    const onlyKim = { ...villagers, castMemberIds: [kim.id] };
    savedShowIs(village, [aProp(1, "village-square", "Bread basket", [villagers.id], 1)], {
      roles: [...roles, onlyKim, baker],
      cast,
    });
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    expect(rolesOn(wrapper, "Bread basket")).toEqual([{ role: "Villagers", cast: "Kim Lee" }]);
    expect(leftToChoose(wrapper, "Bread basket")?.exists()).toBe(false);
  });

  it("won't save a quantity below the carriers, saying to remove carriers first", async () => {
    const stored = savedShowIs(
      village,
      [aProp(1, "village-square", "Lantern", [villagers.id], 3, [jo.id, kim.id, alex.id])],
      bigVillage,
    );
    const { wrapper } = await openAppAt(VILLAGE_PROPS);

    await wrapper.get("button[aria-label='Edit Lantern']").trigger("click");
    await setQuantity(wrapper, "2");
    expect(carriersHint(wrapper).text()).toBe("Choose up to 2 · 1 too many: remove 1");
    await saveEdited(wrapper);

    expect(stored[0]?.quantity).toBe(3);
    const quantity = wrapper.get("input[name=quantity]");
    expect(quantity.attributes("aria-invalid")).toBe("true");
    expect(
      document.getElementById(quantity.attributes("aria-describedby") ?? "")?.textContent?.trim(),
    ).toBe("3 carriers chosen for 2: remove 1 from Selected carriers first");
  });
});
