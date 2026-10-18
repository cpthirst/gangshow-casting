import type { CastMember, ItemNote, Role, RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import { CAST_PATH } from "../cast.ts";
import { ITEM_NOTES_PATH } from "../item-notes.ts";
import { ROLES_PATH } from "../roles.ts";
import { createAppRouter } from "../router.ts";
import { anItem, aRunningOrder } from "../running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "../running-order.ts";
import { signInAs } from "../sign-in.fixture.ts";
import { useLocalSignIn } from "../sign-in.ts";
import CastingItemsPage from "./CastingItemsPage.vue";

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);

/** A stand-in API: the saved running order, the production's roles and its cast (none by
 *  default). */
function savedRunningOrderIs(
  order: RunningOrder,
  roles: Role[] = [],
  cast: CastMember[] = [],
  notes: ItemNote[] = [],
) {
  const fetch = vi.fn(async (url: string) => {
    if (url === ROLES_PATH) return new Response(JSON.stringify({ productionId: "2027", roles }));
    if (url === ITEM_NOTES_PATH) {
      return new Response(JSON.stringify({ productionId: "2027", notes }));
    }
    if (url === CAST_PATH) {
      return new Response(JSON.stringify({ productionId: "2027", members: cast }));
    }
    return new Response(JSON.stringify(order));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function apiAnswers(response: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(response));
}

// The page links to other pages, so it needs the app's router.
async function openItemsPage() {
  const wrapper = mount(CastingItemsPage, {
    global: { plugins: [createAppRouter(createMemoryHistory())] },
  });
  await flushPromises();
  return wrapper;
}

const titlesIn = (wrapper: VueWrapper, halfName: string) => {
  const half = wrapper.findAll("section").find((s) => s.find("h2").text() === halfName);
  return half?.findAll("[data-test=title]").map((title) => title.text());
};

const rowFor = (wrapper: VueWrapper, title: string) =>
  wrapper.findAll("[data-test=item]").find((row) => row.get("[data-test=title]").text() === title);

describe("Casting items page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the items in their halves, in running order", async () => {
    savedRunningOrderIs(
      aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")], [anItem("Campfire Song")]),
    );

    const wrapper = await openItemsPage();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(titlesIn(wrapper, "Second half")).toEqual(["Campfire Song"]);
  });

  it("shows each item's running-order number", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    expect(rowFor(wrapper, "Opening Number")?.get("[data-test=number]").text()).toBe("1");
    expect(rowFor(wrapper, "Pirate Sketch")?.get("[data-test=number]").text()).toBe("2");
  });

  it("shows each item's running time in minutes as the last column, blank if unknown", async () => {
    savedRunningOrderIs(
      aRunningOrder([
        anItem("Opening Number", { minutes: 6 }),
        anItem("Pirate Sketch", { minutes: null }),
      ]),
    );

    const wrapper = await openItemsPage();

    const headings = wrapper.findAll("thead th").map((th) => th.text());
    expect(headings.at(-1)).toBe("Mins");
    const lastCell = (title: string) => rowFor(wrapper, title)?.findAll("td").at(-1);
    expect(lastCell("Opening Number")?.text()).toBe("6");
    expect(lastCell("Pirate Sketch")?.text()).toBe("");
    expect(lastCell("Opening Number")?.attributes("data-label")).toBe("Mins");
  });

  it("lists items not in the printed programme without a number", async () => {
    savedRunningOrderIs(
      aRunningOrder([
        anItem("Opening Number"),
        anItem("Mystery Act", { printed: false }),
        anItem("Pirate Sketch"),
      ]),
    );

    const wrapper = await openItemsPage();

    const mystery = rowFor(wrapper, "Mystery Act");
    expect(mystery?.get("[data-test=number]").text()).toBe("Not in printed programme");
    expect(rowFor(wrapper, "Pirate Sketch")?.get("[data-test=number]").text()).toBe("2");
  });

  it("has no running-order controls", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    expect(wrapper.find(".drag-handle").exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("shows which saved draft the list is based on", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number")], [], 7));

    const wrapper = await openItemsPage();

    expect(wrapper.get("[data-test=version]").text()).toBe("Based on Draft 7");
  });

  it("shows a newly saved order when the page is opened again", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number")], [anItem("Campfire Song")], 7));
    (await openItemsPage()).unmount();

    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Campfire Song")], [], 8));
    const wrapper = await openItemsPage();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Campfire Song"]);
    expect(wrapper.get("[data-test=version]").text()).toBe("Based on Draft 8");
  });

  // Unsaved moves live only in the Running order page; the API serves the last saved version.
  it("shows the latest saved running order, not unsaved edits", async () => {
    const fetch = savedRunningOrderIs(
      aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]),
    );

    const wrapper = await openItemsPage();

    // One read of the saved version (the roles are fetched separately, for the counts).
    expect(fetch.mock.calls.filter(([url]) => url === RUNNING_ORDER_PATH)).toHaveLength(1);
    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
  });

  it("explains that there's no saved running order, with a link to set one up", async () => {
    apiAnswers(async () => new Response(null, { status: 404 }));

    const wrapper = await openItemsPage();

    expect(wrapper.text()).toContain("There's no saved running order yet.");
    expect(wrapper.get("a[href='/']").text()).toBe("Running order page");
  });

  it("reports a failed load rather than an empty running order", async () => {
    apiAnswers(async () => {
      throw new TypeError("Failed to fetch");
    });

    const wrapper = await openItemsPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the items.");
    expect(wrapper.text()).not.toContain("There's no saved running order yet.");
  });

  it("reports a server error rather than an empty running order", async () => {
    apiAnswers(async () => new Response(null, { status: 500 }));

    const wrapper = await openItemsPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the items.");
    expect(wrapper.text()).not.toContain("There's no saved running order yet.");
  });

  it("reports a running order it can't read rather than an empty one", async () => {
    apiAnswers(async () => new Response(JSON.stringify({ halves: "not a running order" })));

    const wrapper = await openItemsPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the items.");
    expect(wrapper.text()).not.toContain("There's no saved running order yet.");
  });

  it("gives each item a Cast button that opens its page", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    const cast = rowFor(wrapper, "Pirate Sketch")?.get("[data-test=cast]");
    expect(cast?.attributes("href")).toBe("/casting/items/pirate-sketch");
    expect(cast?.attributes("aria-label")).toBe("Cast Pirate Sketch");
    expect(cast?.attributes("data-tooltip")).toBe("Cast this item");
    expect(cast?.get("svg[aria-hidden=true]").attributes("data-icon")).toBe("users");
    // In the first column, where the Running order has its move and edit buttons.
    expect(rowFor(wrapper, "Pirate Sketch")?.get("td").find("[data-test=cast]").exists()).toBe(
      true,
    );
  });

  // The Running order's stacked phone layout pads and separates rows by data-item-id.
  it("marks each row with its item, so small screens separate items as on the Running order", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    expect(rowFor(wrapper, "Pirate Sketch")?.attributes("data-item-id")).toBe("pirate-sketch");
  });

  it("lays the items out in Cast, number, item, roles and minutes columns", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number")]));

    const wrapper = await openItemsPage();

    expect(
      wrapper
        .get("section")
        .findAll("thead th")
        .map((th) => th.text()),
    ).toEqual(["Cast", "#", "Item", "Roles", "Mins"]);
  });
});

describe("Casting items page role counts", () => {
  afterEach(() => vi.unstubAllGlobals());

  let nextId = 1;
  const aRole = (itemId: string, size: Role["size"], castMemberIds: number[] = []): Role => ({
    id: nextId,
    itemId,
    name: `Role ${nextId++}`,
    size,
    castMemberIds,
    revision: 1,
  });

  const show = aRunningOrder([
    anItem("Opening Number"),
    anItem("Pirate Sketch"),
    anItem("Campfire Song"),
  ]);
  const countsFor = (wrapper: VueWrapper, title: string) =>
    rowFor(wrapper, title)?.get("[data-test=counts]");

  it("shows each item's total roles and roles cast", async () => {
    savedRunningOrderIs(show, [
      aRole("pirate-sketch", "lead", [12]),
      aRole("pirate-sketch", "support", [13]),
      aRole("pirate-sketch", "support", [14]),
      aRole("pirate-sketch", "cameo"),
      aRole("pirate-sketch", "cameo"),
    ]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Pirate Sketch")?.get("[aria-hidden=true]").text()).toBe(
      "Roles 5 · Cast 3",
    );
  });

  it("says when an item has no roles yet", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "lead")]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Campfire Song")?.text()).toBe("No roles yet");
  });

  it("counts an ensemble as cast once anyone is in it", async () => {
    savedRunningOrderIs(show, [
      aRole("opening-number", "lead", [12]),
      aRole("opening-number", "ensemble", [13, 14]),
      aRole("opening-number", "cameo"),
    ]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Opening Number")?.get("[aria-hidden=true]").text()).toBe(
      "Roles 3 · Cast 2",
    );
  });

  it("reads the counts out in words", async () => {
    savedRunningOrderIs(show, [
      aRole("pirate-sketch", "lead", [12]),
      aRole("pirate-sketch", "support", [13]),
      aRole("pirate-sketch", "cameo"),
    ]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Pirate Sketch")?.get(".visually-hidden").text()).toBe(
      "3 roles, 2 cast",
    );
  });

  it("uses '1 role' for a single role", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "lead")]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Pirate Sketch")?.get(".visually-hidden").text()).toBe(
      "1 role, 0 cast",
    );
  });

  it("reports roles that can't be loaded, still listing the items without counts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === ROLES_PATH
          ? new Response(null, { status: 500 })
          : new Response(JSON.stringify(show)),
      ),
    );

    const wrapper = await openItemsPage();

    expect(titlesIn(wrapper, "First half")).toEqual([
      "Opening Number",
      "Pirate Sketch",
      "Campfire Song",
    ]);
    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the role counts.");
    expect(wrapper.text()).not.toContain("No roles yet");
    expect(wrapper.findAll("[data-test=counts]").every((cell) => cell.text() === "")).toBe(true);
  });
});

describe("Clashes on the Items list", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Made-up names only (CLAUDE.md safeguarding).
  const member = (id: number, firstName: string, lastName: string): CastMember => ({
    id,
    firstName,
    lastName,
    section: null,
    group: "",
    revision: 1,
  });
  const theCast = [
    member(12, "Sam", "Example"),
    member(13, "Alex", "Sample"),
    member(14, "Jo", "Newcomer"),
  ];
  let nextId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[]): Role => ({
    id: nextId++,
    itemId,
    name: `Role ${nextId}`,
    size,
    castMemberIds,
    revision: 1,
  });

  // Every item is 5 minutes. Pirate Sketch: Sam's back-to-back error, and Alex's two
  // back-to-back warnings. Campfire Song and Encore: Jo's 5-minute quick change.
  const show = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch"), anItem("Dance One")],
    [anItem("Campfire Song"), anItem("Interlude"), anItem("Encore"), anItem("Finale")],
  );
  const roles = [
    role("opening-number", "lead", [12]),
    role("pirate-sketch", "support", [12]),
    role("opening-number", "ensemble", [13]),
    role("pirate-sketch", "lead", [13]),
    role("dance-one", "ensemble", [13]),
    role("campfire-song", "lead", [14]),
    role("encore", "lead", [14]),
    role("finale", "lead", [12]),
  ];
  const clashOf = (wrapper: VueWrapper, title: string) =>
    rowFor(wrapper, title)?.find("[data-test=clash]");

  it("shows an icon at an item's worst severity", async () => {
    savedRunningOrderIs(show, roles, theCast);
    const wrapper = await openItemsPage();

    expect(clashOf(wrapper, "Pirate Sketch")?.attributes("data-severity")).toBe("error");
  });

  it("says how many of each, and who, in words a screen reader hears too", async () => {
    savedRunningOrderIs(show, roles, theCast);
    const wrapper = await openItemsPage();

    const clash = clashOf(wrapper, "Pirate Sketch");
    expect(clash?.get("[data-test=clash-description]").text()).toBe(
      "1 error, 2 warnings: Sam Example, Alex Sample",
    );
    expect(clash?.get("[data-test=clash-icon]").attributes("aria-label")).toBe(
      "1 error, 2 warnings: Sam Example, Alex Sample",
    );
    expect(clash?.get("[data-test=clash-icon]").attributes("tabindex")).toBe("0");
  });

  it("shows Info for an item whose only clash is a quick change", async () => {
    savedRunningOrderIs(show, roles, theCast);
    const wrapper = await openItemsPage();

    expect(clashOf(wrapper, "Campfire Song")?.attributes("data-severity")).toBe("info");
    expect(clashOf(wrapper, "Campfire Song")?.text()).toContain("1 info: Jo Newcomer");
  });

  it("shows no icon for an item without clashes", async () => {
    savedRunningOrderIs(show, roles, theCast);
    const wrapper = await openItemsPage();

    expect(rowFor(wrapper, "Finale")?.exists()).toBe(true);
    expect(clashOf(wrapper, "Finale")?.exists()).toBe(false);
  });

  it("shows no icons when the roles can't be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === ROLES_PATH) return new Response(null, { status: 500 });
        if (url === CAST_PATH) {
          return new Response(JSON.stringify({ productionId: "2027", members: theCast }));
        }
        return new Response(JSON.stringify(show));
      }),
    );
    const wrapper = await openItemsPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the role counts.");
    expect(wrapper.find("[data-test=clash]").exists()).toBe(false);
  });

  it("shows no icons, and says so, when the cast can't be loaded", async () => {
    const answer = savedRunningOrderIs(show, roles, theCast);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === CAST_PATH ? new Response(null, { status: 500 }) : answer(url),
      ),
    );
    const wrapper = await openItemsPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't check the casting for clashes.");
    expect(wrapper.find("[data-test=clash]").exists()).toBe(false);
    expect(rowFor(wrapper, "Pirate Sketch")?.get("[data-test=counts]").text()).toContain("Roles 2");
  });
});

describe("Notes on the Items list", () => {
  afterEach(() => vi.unstubAllGlobals());

  const show = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch")],
    [anItem("Campfire Song")],
  );
  const note = (itemId: string, text: string): ItemNote => ({ itemId, text, revision: 1 });
  /** The notes shown for an item: in the row straight after the item's own row. */
  const notesFor = (wrapper: VueWrapper, title: string) => {
    const row = rowFor(wrapper, title)?.element.nextElementSibling;
    return row?.matches("[data-test=item-notes]") ? row : undefined;
  };

  it("shows an item's notes in full, under its row and across the table", async () => {
    savedRunningOrderIs(
      show,
      [],
      [],
      [note("pirate-sketch", "Hook needs a hat change before the finale")],
    );
    const wrapper = await openItemsPage();

    const notes = notesFor(wrapper, "Pirate Sketch");
    expect(notes?.textContent?.trim()).toBe("Hook needs a hat change before the finale");
    expect(notes?.querySelector("td")?.getAttribute("colspan")).toBe("5");
  });

  it("shows nothing extra for items without notes, or with notes cleared", async () => {
    savedRunningOrderIs(show, [], [], [note("opening-number", "")]);
    const wrapper = await openItemsPage();

    expect(notesFor(wrapper, "Opening Number")).toBeUndefined();
    expect(notesFor(wrapper, "Campfire Song")).toBeUndefined();
    expect(wrapper.findAll("[data-test=item-notes]")).toEqual([]);
  });

  it("still lists the items, and says so, when the notes can't be loaded", async () => {
    const answer = savedRunningOrderIs(show);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === ITEM_NOTES_PATH ? new Response(null, { status: 500 }) : answer(url),
      ),
    );
    const wrapper = await openItemsPage();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the notes.");
  });
});

describe("The Items list for a Read-Only Team Member", () => {
  beforeEach(async () => {
    await signInAs(["read-only"]);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useLocalSignIn();
  });

  it("lists every item, each with a View link to its page", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Pirate Panic"), anItem("Dance One")]));

    const wrapper = await openItemsPage();

    expect(titlesIn(wrapper, "First half")).toEqual(["Pirate Panic", "Dance One"]);
    const link = wrapper.get('a[aria-label="View Pirate Panic"]');
    expect(link.attributes("href")).toBe("/casting/items/pirate-panic");
    expect(link.attributes("data-tooltip")).toBe("View this item");
    expect(wrapper.find('a[aria-label^="Cast "]').exists()).toBe(false);
  });

  it("says on the page that the access is read-only", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Pirate Panic")]));

    const wrapper = await openItemsPage();

    expect(wrapper.get("[data-test=read-only]").text()).toBe("You have read-only access");
  });
});

describe("The Items list for other roles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useLocalSignIn();
  });

  it.each([["casting"], ["admin"]])(
    "keeps the Cast link for %s, with no read-only line",
    async (group) => {
      await signInAs([group]);
      savedRunningOrderIs(aRunningOrder([anItem("Pirate Panic")]));

      const wrapper = await openItemsPage();

      expect(wrapper.find('a[aria-label="Cast Pirate Panic"]').exists()).toBe(true);
      expect(wrapper.find("[data-test=read-only]").exists()).toBe(false);
    },
  );
});
