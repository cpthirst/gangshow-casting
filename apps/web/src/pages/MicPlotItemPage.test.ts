import {
  AllocateMicRequest,
  type CastMember,
  type ItemMicPlot,
  type Role,
  type RunningOrder,
} from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { MIC_PLOT_PATH } from "@/utils/mic-plot.ts";
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
const casting = [
  aRole(1, "opening-number", "Chorus", [alex.id]),
  aRole(2, "opening-number", "Soloist", [sam.id]),
  aRole(3, "finale", "Chorus", [jo.id]),
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A stand-in API holding one saved running order (none if undefined), the made-up casting
 *  and the mic plots given, changed as the API would, with no props, scenery, SFX or Wardrobe
 *  files. `answer` replaces the reply to giving out a mic. */
function apiHolds(
  order: RunningOrder | undefined,
  plots: ItemMicPlot[] = [],
  answer?: () => Response,
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
      if (url === ROLES_PATH) return json({ productionId: "2027", roles: casting });
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

async function clear(wrapper: VueWrapper, mic: number) {
  await wrapper.get(`main button[aria-label='Clear Mic ${mic}']`).trigger("click");
  await flushPromises();
}

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
