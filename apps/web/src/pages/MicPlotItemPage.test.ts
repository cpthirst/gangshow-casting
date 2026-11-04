import {
  AllocateMicRequest,
  type CastMember,
  type ItemMicPlot,
  type ItemNote,
  type Role,
  type RunningOrder,
  SaveItemNoteRequest,
} from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { MIC_PLOT_NOTES_PATH, MIC_PLOT_PATH } from "@/utils/mic-plot.ts";
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

// Made-up items, in show order: Opening Number, Pirate Sketch | Finale.
const show = aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")], [anItem("Finale")]);

// Made-up cast: Alex Morgan and Sam Patel are in Opening Number; Jo Reed only in the Finale.
const aMember = (id: number, firstName: string, lastName: string): CastMember => ({
  id,
  firstName,
  lastName,
  section: "scouts",
  group: "",
  revision: 1,
});
const alex = aMember(1, "Alex", "Morgan");
const sam = aMember(2, "Sam", "Patel");
const jo = aMember(3, "Jo", "Reed");
const aRole = (id: number, itemId: string, name: string, castMemberIds: number[]): Role => ({
  id,
  itemId,
  name,
  size: "ensemble",
  castMemberIds,
  revision: 1,
});
const casting: Role[] = [
  aRole(1, "opening-number", "Chorus", [alex.id]),
  aRole(2, "opening-number", "Soloist", [sam.id]),
  aRole(3, "finale", "Chorus", [jo.id]),
  // In Space Sketch, Alex plays two parts, Sam one, and Jo is only in the chorus.
  { ...aRole(4, "space-sketch", "Alien 1", [alex.id]), size: "support" },
  { ...aRole(5, "space-sketch", "Narrator", [alex.id]), size: "lead" },
  { ...aRole(6, "space-sketch", "Captain", [sam.id]), size: "lead" },
  aRole(7, "space-sketch", "Chorus", [jo.id]),
];
// A show of one made-up item, for the roles each mic shows.
const spaceShow = aRunningOrder([anItem("Space Sketch")]);
const SPACE_SKETCH = "/production/items/space-sketch/mic-plot";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Every item's Mic plot notes the stand-in API holds, saved as the API would. */
const micPlotNotes: ItemNote[] = [];
beforeEach(() => {
  micPlotNotes.length = 0;
});

/** A stand-in API holding one saved running order (none if undefined), the made-up casting,
 *  the mic plots given and the Mic plot notes, changed as the API would, with no props,
 *  scenery, SFX or Wardrobe files. `answer` replaces the reply to giving out a mic. */
function apiHolds(
  order: RunningOrder | undefined,
  plots: ItemMicPlot[] = [],
  answer?: () => Response,
  roles: Role[] = casting,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === RUNNING_ORDER_PATH) {
        return order ? json(order) : new Response(null, { status: 404 });
      }
      if (url === MIC_PLOT_PATH) return json({ productionId: "2027", items: plots });
      const giving = /^\/api\/productions\/2027\/items\/([^/]+)\/mic-plot$/.exec(url);
      if (giving && init?.method === "PUT") {
        if (answer) return answer();
        const itemId = giving[1] ?? "";
        const { channel, castMemberId } = AllocateMicRequest.parse(JSON.parse(String(init.body)));
        const plot = plots.find((p) => p.itemId === itemId) ?? { itemId, mics: [] };
        const others = plot.mics.filter((mic) => mic.channel !== channel);
        const mics = castMemberId === null ? others : [...others, { channel, castMemberId }];
        const saved = { itemId, mics: mics.sort((a, b) => a.channel - b.channel) };
        plots.splice(0, plots.length, ...plots.filter((p) => p.itemId !== itemId), saved);
        return json(saved);
      }
      if (url === MIC_PLOT_NOTES_PATH) return json({ productionId: "2027", notes: micPlotNotes });
      const savingNotes = /^\/api\/productions\/2027\/items\/([^/]+)\/mic-plot-notes$/.exec(url);
      if (savingNotes && init?.method === "PUT") {
        const itemId = savingNotes[1] ?? "";
        const { text, revision } = SaveItemNoteRequest.parse(JSON.parse(String(init.body)));
        const saved = { itemId, text, revision: revision + 1 };
        const others = micPlotNotes.filter((note) => note.itemId !== itemId);
        micPlotNotes.splice(0, micPlotNotes.length, ...others, saved);
        return json(saved);
      }
      if (url === ROLES_PATH) return json({ productionId: "2027", roles });
      if (url === CAST_PATH) return json({ productionId: "2027", members: [alex, sam, jo] });
      if (url === PROPS_PATH) return json({ productionId: "2027", props: [] });
      if (url === PROPS_NOTES_PATH) return json({ productionId: "2027", notes: [] });
      if (/\/(scenery|sfx|wardrobe)-files$/.test(url)) return json({ files: [] });
      if (url === "/api/usage") return new Response(null, { status: 204 });
      return json({ status: "ok", version: "dev" });
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

const OPENING_NUMBER = "/production/items/opening-number/mic-plot";

const stepLinks = (wrapper: VueWrapper) =>
  wrapper.findAll("main nav[aria-label='Item navigation'] a[rel]").map((link) => ({
    rel: link.attributes("rel"),
    href: link.attributes("href"),
  }));

async function choose(wrapper: VueWrapper, department: string, title: string) {
  const row = wrapper
    .findAll("[data-test=item]")
    .find((r) => r.get("[data-test=title]").text() === title);
  const button = row
    ?.findAll(".icon-button")
    .find((b) => b.attributes("data-tooltip") === department);
  await button?.trigger("click");
  await flushPromises();
}

/** Each channel as the page shows it: its name, and who is on it ("" for no one). */
const channels = (wrapper: VueWrapper) =>
  wrapper.findAll("main [data-test=mic]").map((row) => {
    const picker = row.find<HTMLInputElement>("input[role=combobox]");
    const who = picker.exists() ? picker.element.value : row.get("[data-test=on-mic]").text();
    return { mic: row.get("[data-test=channel]").text(), who: who === "No one" ? "" : who };
  });
const whoIsOn = (wrapper: VueWrapper, mic: number) =>
  channels(wrapper).find((channel) => channel.mic === `Mic ${mic}`)?.who;

const pickerFor = (wrapper: VueWrapper, mic: number) =>
  wrapper.get<HTMLInputElement>(`main input[role=combobox][name=mic-${mic}]`);

/** Types into the channel's picker, as someone searching, and the names it then offers. */
async function offered(wrapper: VueWrapper, mic: number, typed: string) {
  await pickerFor(wrapper, mic).setValue(typed);
  const row = wrapper.findAll("main [data-test=mic]")[mic - 1];
  return row?.findAll("[role=option] .choice-name").map((name) => name.text());
}

async function give(wrapper: VueWrapper, mic: number, name: string) {
  await pickerFor(wrapper, mic).setValue(name.split(" ")[0]);
  const row = wrapper.findAll("main [data-test=mic]")[mic - 1];
  const option = row?.findAll("[role=option]").find((o) => o.get(".choice-name").text() === name);
  if (!option) throw new Error(`${name} isn't offered for Mic ${mic}`);
  await option.trigger("mousedown");
  await flushPromises();
}

/** The roles a channel shows for its cast member, as plain text. */
const rolesOn = (wrapper: VueWrapper, mic: number) =>
  wrapper.findAll("main [data-test=mic]")[mic - 1]?.get("[data-test=mic-roles]").text();

async function clear(wrapper: VueWrapper, mic: number) {
  await wrapper.get(`main button[aria-label='Clear Mic ${mic}']`).trigger("click");
  await flushPromises();
}

const notesSection = (wrapper: VueWrapper) =>
  wrapper.get("main section[aria-labelledby=notes-heading]");

const puts = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) }));

describe("An item's Mic plot page", () => {
  it("opens from the Overview, with the item's name and position, listing Mic 1 to Mic 24, each empty", async () => {
    apiHolds(show);
    const { wrapper, router } = await openAppAt("/production/overview");

    await choose(wrapper, "Mic plot", "Opening Number");

    expect(router.currentRoute.value.fullPath).toBe(OPENING_NUMBER);
    expect(wrapper.get("main h1").text()).toBe("Mic plot: Opening Number");
    expect(wrapper.get("[data-test=position]").text()).toBe("Item 1 · First half");
    expect(document.title).toBe("Mic plot: Opening Number · iCUE");
    expect(channels(wrapper)).toEqual(
      Array.from({ length: 24 }, (_, i) => ({ mic: `Mic ${i + 1}`, who: "" })),
    );
    expect(wrapper.get("main").text()).not.toContain("Coming soon");
  });

  it("has a help button beside the item's name, which opens the Mic plot page's help", async () => {
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const row = wrapper.get("main .page-title-row");
    expect(row.get("h1").text()).toBe("Mic plot: Opening Number");
    await row.get("button[aria-label='Help for this item']").trigger("click");

    const names = wrapper.findAll("dialog [data-test=help-name]").map((name) => name.text());
    expect(names).toEqual([
      "All items",
      "Previous and Next",
      "Mic 1 to Mic 24",
      "Clear",
      "Mic plot notes",
    ]);
  });

  it("goes back to the Overview, and steps to the previous and next items' Mic plot pages", async () => {
    apiHolds(show);
    const { wrapper, router } = await openAppAt("/production/items/pirate-sketch/mic-plot");

    expect(stepLinks(wrapper)).toEqual([
      { rel: "prev", href: OPENING_NUMBER },
      { rel: "next", href: "/production/items/finale/mic-plot" },
    ]);

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();
    expect(wrapper.get("main h1").text()).toBe("Mic plot: Finale");

    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("has no Previous on the first item, and no Next on the last", async () => {
    apiHolds(show);
    const first = await openAppAt(OPENING_NUMBER);
    expect(stepLinks(first.wrapper).map((link) => link.rel)).toEqual(["next"]);
    first.wrapper.unmount();

    const { wrapper } = await openAppAt("/production/items/finale/mic-plot");
    expect(stepLinks(wrapper).map((link) => link.rel)).toEqual(["prev"]);
  });

  it("shows the next item's own channels after stepping on to it", async () => {
    apiHolds(show, [
      { itemId: "opening-number", mics: [{ channel: 3, castMemberId: alex.id }] },
      { itemId: "finale", mics: [{ channel: 7, castMemberId: jo.id }] },
    ]);
    const { wrapper } = await openAppAt("/production/items/pirate-sketch/mic-plot");

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(whoIsOn(wrapper, 3)).toBe("");
    expect(whoIsOn(wrapper, 7)).toBe("Jo Reed");
  });

  it("marks the Production overview as the current page in the menu", async () => {
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const current = wrapper.findAll("nav a[aria-current=page]");
    expect(current.map((link) => link.attributes("href"))).toEqual(["/production/overview"]);
  });

  it("offers lee, with Tech, only the cast members cast in the item for a channel", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    // "e" is in all three names, so only who is cast in the item decides who is offered.
    expect(await offered(wrapper, 3, "e")).toEqual(["Alex Morgan", "Sam Patel"]);
    expect(await offered(wrapper, 3, "Jo")).toEqual([]);
  });

  it("labels each channel's picker with the channel", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const picker = pickerFor(wrapper, 7);
    expect(wrapper.get(`label[for='${picker.attributes("id")}']`).text()).toBe("Mic 7 cast member");
  });

  it("saves Mic 3 for Alex Morgan when lee chooses them, which everyone then sees", async () => {
    await signInAs(["tech"], "lee");
    const plots: ItemMicPlot[] = [];
    apiHolds(show, plots);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await give(wrapper, 3, "Alex Morgan");

    expect(puts()).toEqual([
      {
        url: "/api/productions/2027/items/opening-number/mic-plot",
        body: { channel: 3, castMemberId: alex.id },
      },
    ]);
    expect(whoIsOn(wrapper, 3)).toBe("Alex Morgan");
    expect(wrapper.get("main [data-test=mic-status]").text()).toBe("Mic 3 given to Alex Morgan.");
    wrapper.unmount();

    await signInAs([], "jo");
    const { wrapper: later } = await openAppAt(OPENING_NUMBER);
    expect(whoIsOn(later, 3)).toBe("Alex Morgan");
  });

  it("frees Mic 3 when lee clears it", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show, [{ itemId: "opening-number", mics: [{ channel: 3, castMemberId: alex.id }] }]);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await clear(wrapper, 3);

    expect(puts().map((put) => put.body)).toEqual([{ channel: 3, castMemberId: null }]);
    expect(whoIsOn(wrapper, 3)).toBe("");
    expect(wrapper.get("main [data-test=mic-status]").text()).toBe("Mic 3 is free.");
  });

  it("doesn't offer someone already on a channel in the item for another one", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show, [{ itemId: "opening-number", mics: [{ channel: 3, castMemberId: alex.id }] }]);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(await offered(wrapper, 4, "e")).toEqual(["Sam Patel"]);
    expect(await offered(wrapper, 3, "e")).toEqual(["Alex Morgan", "Sam Patel"]);
  });

  it("shows who is really on a channel again when lee types but leaves without choosing", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show, [{ itemId: "opening-number", mics: [{ channel: 3, castMemberId: alex.id }] }]);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await pickerFor(wrapper, 3).setValue("Sa");
    await wrapper.findAll("main [data-test=mic]")[2]?.trigger("focusout");

    expect(whoIsOn(wrapper, 3)).toBe("Alex Morgan");
    expect(puts()).toEqual([]);
  });

  it.each([
    ["dee, with Director only", ["director"]],
    ["alex, an admin", ["admin"]],
  ])("lets %s give out the mics", async (_who, groups) => {
    await signInAs(groups);
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await give(wrapper, 5, "Sam Patel");

    expect(puts().map((put) => put.body)).toEqual([{ channel: 5, castMemberId: sam.id }]);
    expect(wrapper.find("main [data-test=read-only]").exists()).toBe(false);
  });

  it("shows kim, with Casting, Stage and Wardrobe, every channel and who is on it, with nothing to change them", async () => {
    await signInAs(["casting", "stage", "wardrobe"], "kim");
    apiHolds(show, [{ itemId: "opening-number", mics: [{ channel: 3, castMemberId: alex.id }] }]);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.findAll("main input")).toEqual([]);
    expect(wrapper.findAll("main button[aria-label^=Clear]")).toEqual([]);
    expect(channels(wrapper)).toHaveLength(24);
    expect(whoIsOn(wrapper, 3)).toBe("Alex Morgan");
    expect(whoIsOn(wrapper, 4)).toBe("");
    expect(wrapper.get("main [data-test=read-only]").text()).toBe(
      "You can view the mic plot, but not change it: only Tech, Director and admins can.",
    );
  });

  it("puts a channel back and says so when the save fails", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show, [], () => new Response(null, { status: 500 }));
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await give(wrapper, 3, "Alex Morgan");

    expect(whoIsOn(wrapper, 3)).toBe("");
    expect(wrapper.get("main [data-test=mic-problem]").text()).toBe(
      "Couldn't save Mic 3. Try again.",
    );
  });

  it("shows the item's channels as they are now when someone else gave that cast member a mic first", async () => {
    await signInAs(["tech"], "lee");
    const now = { itemId: "opening-number", mics: [{ channel: 4, castMemberId: alex.id }] };
    apiHolds(show, [], () => json(now, 409));
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await give(wrapper, 3, "Alex Morgan");

    expect(whoIsOn(wrapper, 3)).toBe("");
    expect(whoIsOn(wrapper, 4)).toBe("Alex Morgan");
    expect(wrapper.get("main [data-test=mic-problem]").text()).toBe(
      "Alex Morgan is already on another mic in this item. Here are the mics as they are now.",
    );
  });

  it("shows every role a mic's cast member plays in the item, biggest first, to anyone signed in", async () => {
    await signInAs([], "jo");
    apiHolds(spaceShow, [
      { itemId: "space-sketch", mics: [{ channel: 3, castMemberId: alex.id }] },
    ]);
    const { wrapper } = await openAppAt(SPACE_SKETCH);

    expect([whoIsOn(wrapper, 3), rolesOn(wrapper, 3)]).toEqual([
      "Alex Morgan",
      "Narrator, Alien 1",
    ]);
    expect(rolesOn(wrapper, 4)).toBe("");
  });

  it("shows the chorus for Jo Reed, only in the chorus, once lee gives them a mic", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(spaceShow);
    const { wrapper } = await openAppAt(SPACE_SKETCH);

    await give(wrapper, 4, "Jo Reed");

    expect(rolesOn(wrapper, 4)).toBe("Chorus");
  });

  it("shows the new cast member's roles when lee gives Mic 3 to someone else", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(spaceShow, [
      { itemId: "space-sketch", mics: [{ channel: 3, castMemberId: alex.id }] },
    ]);
    const { wrapper } = await openAppAt(SPACE_SKETCH);

    await give(wrapper, 3, "Sam Patel");

    expect(rolesOn(wrapper, 3)).toBe("Captain");
  });

  it("shows the roles from the casting as it is when the page opens", async () => {
    const plots = [{ itemId: "space-sketch", mics: [{ channel: 3, castMemberId: alex.id }] }];
    // Since the mic was given out, Alex is also cast as Robot, and Alien 1 is renamed.
    const recast: Role[] = [
      ...casting.map((role) =>
        role.name === "Alien 1" ? { ...role, name: "Alien Leader" } : role,
      ),
      { ...aRole(8, "space-sketch", "Robot", [alex.id]), size: "cameo" },
    ];
    apiHolds(spaceShow, plots, undefined, recast);
    const { wrapper } = await openAppAt(SPACE_SKETCH);

    expect(rolesOn(wrapper, 3)).toBe("Narrator, Alien Leader, Robot");
  });

  it.each([
    ["lee, with Tech", ["tech"]],
    ["kim, without Tech or Director", ["casting", "stage", "wardrobe"]],
  ])(
    "shows %s each mic's roles as plain text, with nothing to change them",
    async (_who, groups) => {
      await signInAs(groups);
      apiHolds(spaceShow, [
        { itemId: "space-sketch", mics: [{ channel: 3, castMemberId: alex.id }] },
      ]);
      const { wrapper } = await openAppAt(SPACE_SKETCH);

      const row = wrapper.findAll("main [data-test=mic]")[2];
      expect(row?.get("[data-test=mic-roles]").element.tagName).toBe("SPAN");
      // Only the cast member picker, for those who can change it: nothing for the role.
      expect(row?.findAll("input, select, textarea")).toHaveLength(groups.includes("tech") ? 1 : 0);
    },
  );

  describe("with a channel used in the item before", () => {
    // Made-up items: Opening Number, Space Sketch, a 1-minute Link and Act 1 Finale, then
    // Entr'acte after the interval. Space Sketch's and Link's cast are in `casting`'s mould.
    const actsShow = aRunningOrder(
      [
        anItem("Opening Number"),
        anItem("Space Sketch"),
        anItem("Link", { minutes: 1 }),
        anItem("Act 1 Finale"),
      ],
      [anItem("Entr'acte", { id: "entracte" })],
    );
    const LINK = "/production/items/link/mic-plot";
    const ENTRACTE = "/production/items/entracte/mic-plot";
    // Alex isn't in Space Sketch here: only Sam and Jo are.
    const withoutAlexInSpace = casting.filter(
      (role) => !(role.itemId === "space-sketch" && role.castMemberIds.includes(alex.id)),
    );
    const everyoneIn = (itemId: string, id: number) =>
      aRole(id, itemId, "Chorus", [alex.id, sam.id, jo.id]);
    const alexOnMic1In = (itemId: string) => ({
      itemId,
      mics: [{ channel: 1, castMemberId: alex.id }],
    });

    const row = (wrapper: VueWrapper, mic: number) =>
      wrapper.findAll("main [data-test=mic]")[mic - 1];
    /** Greyed out and disabled, saying why in words and in the picker's accessible name. */
    function isHeld(wrapper: VueWrapper, mic: number) {
      const picker = pickerFor(wrapper, mic);
      const label = wrapper.get(`label[for='${picker.attributes("id")}']`).text();
      return (
        picker.element.disabled &&
        label === `Mic ${mic} cast member, used in previous item` &&
        row(wrapper, mic)?.classes().includes("mic-held") === true &&
        row(wrapper, mic)?.get("[data-test=mic-held]").text() === "Used in previous item"
      );
    }

    it("greys out and disables a channel someone not in the item had in the item before", async () => {
      await signInAs(["tech"], "lee");
      apiHolds(actsShow, [alexOnMic1In("opening-number")], undefined, withoutAlexInSpace);
      const { wrapper } = await openAppAt(SPACE_SKETCH);

      expect(isHeld(wrapper, 1)).toBe(true);
      expect(isHeld(wrapper, 2)).toBe(false);
      expect(await offered(wrapper, 2, "e")).toEqual(["Sam Patel", "Jo Reed"]);
    });

    it("lets lee give the channel back to the cast member who had it, offering no one else", async () => {
      await signInAs(["tech"], "lee");
      apiHolds(actsShow, [alexOnMic1In("opening-number")]);
      const { wrapper } = await openAppAt(SPACE_SKETCH);

      expect(await offered(wrapper, 1, "e")).toEqual(["Alex Morgan"]);
      await give(wrapper, 1, "Alex Morgan");

      expect(puts().map((put) => put.body)).toEqual([{ channel: 1, castMemberId: alex.id }]);
      expect(whoIsOn(wrapper, 1)).toBe("Alex Morgan");
      expect(isHeld(wrapper, 1)).toBe(false);
    });

    it("holds the channel in a 1-minute item too, for anyone but who had it", async () => {
      await signInAs(["tech"], "lee");
      const roles = [...casting, everyoneIn("link", 9)];
      apiHolds(
        actsShow,
        [{ itemId: "space-sketch", mics: [{ channel: 2, castMemberId: sam.id }] }],
        undefined,
        roles,
      );
      const { wrapper } = await openAppAt(LINK);

      expect(await offered(wrapper, 2, "e")).toEqual(["Sam Patel"]);
    });

    it("holds no channel in the first item of the show", async () => {
      await signInAs(["tech"], "lee");
      apiHolds(actsShow, [alexOnMic1In("act-1-finale"), alexOnMic1In("entracte")]);
      const { wrapper } = await openAppAt(OPENING_NUMBER);

      for (let mic = 1; mic <= 24; mic++) expect(isHeld(wrapper, mic)).toBe(false);
      expect(await offered(wrapper, 1, "e")).toEqual(["Alex Morgan", "Sam Patel"]);
    });

    it("holds no channel in the first item after the interval", async () => {
      await signInAs(["tech"], "lee");
      const roles = [...casting, everyoneIn("entracte", 9)];
      apiHolds(actsShow, [alexOnMic1In("act-1-finale")], undefined, roles);
      const { wrapper } = await openAppAt(ENTRACTE);

      expect(isHeld(wrapper, 1)).toBe(false);
      await give(wrapper, 1, "Jo Reed");
      expect(whoIsOn(wrapper, 1)).toBe("Jo Reed");
    });

    it("lets lee give Jo Reed a mic they had two items back, with nothing else to do", async () => {
      await signInAs(["tech"], "lee");
      const roles = [...casting, everyoneIn("link", 9)];
      apiHolds(
        actsShow,
        [{ itemId: "opening-number", mics: [{ channel: 5, castMemberId: jo.id }] }],
        undefined,
        roles,
      );
      const { wrapper } = await openAppAt(LINK);

      await give(wrapper, 5, "Jo Reed");

      expect(puts().map((put) => put.body)).toEqual([{ channel: 5, castMemberId: jo.id }]);
      expect(whoIsOn(wrapper, 5)).toBe("Jo Reed");
    });

    it("shows kim, without Tech or Director, that the channel was used in the item before", async () => {
      await signInAs(["casting", "stage", "wardrobe"], "kim");
      apiHolds(actsShow, [alexOnMic1In("opening-number")], undefined, withoutAlexInSpace);
      const { wrapper } = await openAppAt(SPACE_SKETCH);

      expect(row(wrapper, 1)?.get("[data-test=on-mic]").text()).toBe("Used in previous item");
      expect(row(wrapper, 1)?.classes()).toContain("mic-held");
      expect(row(wrapper, 2)?.get("[data-test=on-mic]").text()).toBe("No one");
    });
  });

  it("saves lee's Mic plot notes under the channels, which everyone then sees, apart from other items'", async () => {
    await signInAs(["tech"], "lee");
    micPlotNotes.push({ itemId: "finale", text: "Radio mics only", revision: 1 });
    apiHolds(show);
    const first = await openAppAt(OPENING_NUMBER);
    expect(notesSection(first.wrapper).get("h2").text()).toBe("Mic plot notes");
    expect(
      first.wrapper
        .get("main .mic-channels")
        .element.compareDocumentPosition(notesSection(first.wrapper).element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await notesSection(first.wrapper).get("textarea").setValue("Mics 19–24 on for songs only");
    await notesSection(first.wrapper).get("form").trigger("submit");
    await flushPromises();
    first.wrapper.unmount();
    await signInAs([], "jo");
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(puts().map((put) => put.url)).toEqual([
      "/api/productions/2027/items/opening-number/mic-plot-notes",
    ]);
    expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe(
      "Mics 19–24 on for songs only",
    );
    expect(micPlotNotes).toContainEqual({ itemId: "finale", text: "Radio mics only", revision: 1 });
  });

  it.each([
    ["dee, with Director only", ["director"], "dee"],
    ["ash, an admin", ["admin"], "ash"],
  ])("lets %s change the Mic plot notes", async (_who, groups, name) => {
    await signInAs(groups, name);
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await notesSection(wrapper).get("textarea").setValue("Mics 19–24 on for songs only");
    await notesSection(wrapper).get("form").trigger("submit");
    await flushPromises();

    expect(micPlotNotes).toEqual([
      { itemId: "opening-number", text: "Mics 19–24 on for songs only", revision: 1 },
    ]);
  });

  it("shows kim, with Casting, Stage and Wardrobe, the Mic plot notes with nothing to change them", async () => {
    await signInAs(["casting", "stage", "wardrobe"], "kim");
    micPlotNotes.push({
      itemId: "opening-number",
      text: "Mics 19–24 on for songs only",
      revision: 1,
    });
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe(
      "Mics 19–24 on for songs only",
    );
    expect(notesSection(wrapper).find("textarea").exists()).toBe(false);
    expect(notesSection(wrapper).find("button").exists()).toBe(false);
  });

  it("says an item that isn't in the running order wasn't found, with a link back to the Overview", async () => {
    apiHolds(show);
    const { wrapper, router } = await openAppAt("/production/items/no-such-item/mic-plot");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(document.title).toBe("Item not found · iCUE");
    expect(wrapper.findAll("main [data-test=mic]")).toEqual([]);
    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("says the item wasn't found when there's no saved running order", async () => {
    apiHolds(undefined);
    const { wrapper } = await openAppAt("/production/items/finale/mic-plot");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
  });

  it("reports a failed load rather than not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const { wrapper } = await openAppAt("/production/items/finale/mic-plot");

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the item.");
    expect(wrapper.get("main").text()).not.toContain("Item not found");
  });

  it("opens every department's page for someone with no permissions", async () => {
    await signInAs([], "jo");
    apiHolds(show);

    for (const [department, heading] of [
      ["Scenery", "Scenery: Pirate Sketch"],
      ["Props", "Props: Pirate Sketch"],
      ["SFX", "SFX: Pirate Sketch"],
      ["Mic plot", "Mic plot: Pirate Sketch"],
      ["Wardrobe", "Wardrobe: Pirate Sketch"],
    ] as const) {
      const { wrapper } = await openAppAt("/production/overview");
      await choose(wrapper, department, "Pirate Sketch");
      expect(wrapper.get("main h1").text()).toBe(heading);
      wrapper.unmount();
    }
  });
});
