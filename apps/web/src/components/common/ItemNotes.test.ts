import { type ItemNote, MAX_NOTE_LENGTH, SaveItemNoteRequest } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json } from "@/app.fixture.ts";
import ItemNotes from "./ItemNotes.vue";

// Asking before leaving with unsaved notes needs a real page to leave: CastingItemPage.test.ts
// has those. Here there's no route for the guards to join.
vi.mock("vue-router", async (original) => ({
  ...(await original<typeof import("vue-router")>()),
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
}));

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const LIST = "/api/made-up/notes";
const SAVE = "/api/made-up/items/pirate-sketch/notes";

/** A stand-in API holding the notes, or answering a save with the response given. */
function apiHolds(notes: ItemNote[] = [], answerSave?: () => Response) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === LIST) return json({ productionId: "2027", notes });
    if (answerSave) return answerSave();
    const { text, revision } = SaveItemNoteRequest.parse(JSON.parse(String(init?.body)));
    const saved = { itemId: "pirate-sketch", text, revision: revision + 1 };
    notes.splice(0, notes.length, saved);
    return json(saved);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function openNotes(canChange = true) {
  const wrapper = mount(ItemNotes, {
    props: {
      itemId: "pirate-sketch",
      heading: "Casting notes",
      listPath: LIST,
      savePath: SAVE,
      canChange,
    },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

const field = (wrapper: VueWrapper) => wrapper.get<HTMLTextAreaElement>("textarea");

async function saveAs(wrapper: VueWrapper, text: string) {
  await field(wrapper).setValue(text);
  await wrapper.get("form").trigger("submit");
  await flushPromises();
}

const saves = (fetch: ReturnType<typeof apiHolds>) =>
  fetch.mock.calls.filter(([, init]) => init?.method === "PUT");

const aNote = (text: string, revision = 1): ItemNote => ({
  itemId: "pirate-sketch",
  text,
  revision,
});

describe("An item's notes", () => {
  it("shows this item's saved notes under the heading, labelling the field by it", async () => {
    apiHolds([aNote("Sword fight"), { itemId: "finale", text: "Confetti", revision: 1 }]);
    const wrapper = await openNotes();

    expect(wrapper.get("h2").text()).toBe("Casting notes");
    expect(field(wrapper).element.value).toBe("Sword fight");
    expect(field(wrapper).attributes("aria-labelledby")).toBe("notes-heading");
    expect(field(wrapper).attributes("maxlength")).toBe(String(MAX_NOTE_LENGTH));
  });

  it("saves at the current revision, and says so", async () => {
    const fetch = apiHolds([aNote("Sword fight", 3)]);
    const wrapper = await openNotes();

    await saveAs(wrapper, "Sword fight, then song");

    expect(saves(fetch).map(([url]) => url)).toEqual([SAVE]);
    expect(JSON.parse(String(saves(fetch)[0]?.[1]?.body))).toEqual({
      text: "Sword fight, then song",
      revision: 3,
    });
    expect(wrapper.get("[data-test=notes-status]").text()).toBe("Notes saved.");
  });

  it("removes the notes when they're cleared and saved", async () => {
    const notes = [aNote("Sword fight")];
    apiHolds(notes);
    const wrapper = await openNotes();

    await saveAs(wrapper, "");

    expect(notes).toEqual([aNote("", 2)]);
    expect(field(wrapper).element.value).toBe("");
  });

  it("clears an old message once the notes are changed again", async () => {
    apiHolds();
    const wrapper = await openNotes();
    await saveAs(wrapper, "Sword fight");

    await field(wrapper).setValue("Sword fight!");

    expect(wrapper.get("[data-test=notes-status]").text()).toBe("");
  });

  it.each([
    [MAX_NOTE_LENGTH - 50, false],
    [MAX_NOTE_LENGTH - 49, true],
  ])("after %s characters, shows the count: %s", async (length, shows) => {
    apiHolds();
    const wrapper = await openNotes();

    await field(wrapper).setValue("x".repeat(length));

    expect(wrapper.find("[data-test=notes-count]").exists()).toBe(shows);
    expect(field(wrapper).attributes("aria-describedby")).toBe(shows ? "notes-count" : undefined);
  });

  it("says 1 character left, not 1 characters", async () => {
    apiHolds();
    const wrapper = await openNotes();

    await field(wrapper).setValue("x".repeat(MAX_NOTE_LENGTH - 1));

    expect(wrapper.get("[data-test=notes-count]").text()).toBe("1 character left");
  });

  it("refuses notes over the limit, saving nothing", async () => {
    const fetch = apiHolds();
    const wrapper = await openNotes();

    await saveAs(wrapper, "x".repeat(MAX_NOTE_LENGTH + 1));

    expect(saves(fetch)).toEqual([]);
    expect(wrapper.get("[data-test=notes-error]").text()).toContain(String(MAX_NOTE_LENGTH));
    expect(field(wrapper).attributes("aria-invalid")).toBe("true");
  });

  it("refuses a stale save, showing the notes as they are now", async () => {
    apiHolds([aNote("Someone else's", 2)], () => new Response(null, { status: 409 }));
    const wrapper = await openNotes();

    await saveAs(wrapper, "Mine");

    expect(field(wrapper).element.value).toBe("Someone else's");
    expect(wrapper.get("[data-test=notes-error]").text()).toContain("Someone else changed");
  });

  it("keeps the text when the notes can't be saved", async () => {
    apiHolds([], () => new Response(null, { status: 500 }));
    const wrapper = await openNotes();

    await saveAs(wrapper, "Sword fight");

    expect(field(wrapper).element.value).toBe("Sword fight");
    expect(wrapper.find("[data-test=notes-error]").exists()).toBe(true);
  });

  it("reports a failed load rather than showing no notes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const wrapper = await openNotes();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the notes.");
    expect(wrapper.find("textarea").exists()).toBe(false);
  });
});

describe("An item's notes, for someone who can't change them", () => {
  it("shows the notes with nothing to change them", async () => {
    apiHolds([aNote("Sword fight")]);
    const wrapper = await openNotes(false);

    expect(wrapper.get("[data-test=notes-text]").text()).toBe("Sword fight");
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it("says so when there are none", async () => {
    apiHolds();
    const wrapper = await openNotes(false);

    expect(wrapper.get("[data-test=notes-text]").text()).toBe("No notes yet.");
  });
});
