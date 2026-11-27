import { enableAutoUnmount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json, openAppAt } from "@/app.fixture.ts";
import { downloadFrom } from "@/services/file-link.ts";
import { openProduction, openProductionYear } from "@/services/production.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";

// The grid and viewer have tests of their own: these check a store's page is wired to them,
// and stands apart from every production.

// The browser's own new tabs and downloads, which happy-dom can't follow.
vi.mock("@/services/file-link.ts", () => ({ openFileTab: vi.fn(), downloadFrom: vi.fn() }));

enableAutoUnmount(afterEach);
beforeEach(() => {
  useLocalSignIn();
  openProduction(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

// Made-up images: the Scenery store has two, the Props and Wardrobe stores none.
const held: Record<string, string[]> = {
  scenery: ["throne.jpg", "castle-backdrop.png"],
  props: [],
  wardrobe: [],
};
const linkTo = (name: string) => `https://files.example/stores/${name}?signed`;

/** A stand-in API holding the stores, and the productions "2026" and "2027": a failing
 *  store's images won't load, and a gone image has been deleted since the list. */
function serveStores({ failing, gone }: { failing?: string; gone?: string } = {}) {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    const [, store = "", ask] =
      /^\/api\/stores\/([\w-]+)\/(image-links|image-link\?.*)$/.exec(url) ?? [];
    const names = held[store];
    if (store === failing) return new Response(null, { status: 500 });
    if (ask === "image-links" && names) {
      return json({ links: names.map((name) => ({ name, url: linkTo(name) })) });
    }
    if (ask?.startsWith("image-link?") && names) {
      const name = new URLSearchParams(ask.slice("image-link?".length)).get("name") ?? "";
      if (name === gone) return new Response(null, { status: 404 });
      return json({ url: `${linkTo(name)}&download` });
    }
    if (url === "/api/productions") return json({ productions: ["2026", "2027"] });
    if (url === "/api/usage") return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const asked = (fetch: ReturnType<typeof serveStores>, match: (url: string) => boolean) =>
  fetch.mock.calls.map(([url]) => url).filter(match);
const thumbnails = (wrapper: VueWrapper) =>
  wrapper.findAll("main [data-test=image] [data-test=name]").map((name) => name.text());
const shownName = () => document.querySelector(".pswp__name")?.textContent;

async function viewThrone(wrapper: VueWrapper) {
  const throne = wrapper
    .findAll("main [data-test=image]")
    .find((each) => each.text() === "throne.jpg");
  await throne?.get(".thumb-open").trigger("click");
  // Its code arrives on the first open.
  await vi.waitFor(() => expect(shownName()).toBe("throne.jpg"));
}

describe("The stores", () => {
  it("open the store chosen under Stores, marked as the current page", async () => {
    serveStores();
    const { wrapper } = await openAppAt("/");

    const scenery = wrapper
      .findAll("#menu-stores-pages a")
      .find((link) => link.text() === "Scenery");
    await scenery?.trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Scenery stores");
    expect(scenery?.attributes("aria-current")).toBe("page");
    expect(wrapper.get("#menu-stores").classes()).toContain("holds-current");
  });
});

describe("A store's page", () => {
  it("shows the store's images as thumbnails in name order, each named beneath, from one request", async () => {
    const fetch = serveStores();
    const { wrapper } = await openAppAt("/stores/scenery");

    expect(thumbnails(wrapper)).toEqual(["castle-backdrop.png", "throne.jpg"]);
    expect(
      wrapper.findAll("main [data-test=image] img").map((img) => img.attributes("src")),
    ).toEqual([linkTo("castle-backdrop.png"), linkTo("throne.jpg")]);
    expect(asked(fetch, (url) => url.startsWith("/api/stores/"))).toEqual([
      "/api/stores/scenery/image-links",
    ]);
  });

  it("opens a chosen thumbnail in the viewer, which moves through the store's images", async () => {
    serveStores();
    const { wrapper } = await openAppAt("/stores/scenery");

    await viewThrone(wrapper);
    document.querySelector<HTMLButtonElement>(".pswp__button[aria-label=Previous]")?.click();

    expect(shownName()).toBe("castle-backdrop.png");
  });

  it("downloads the image shown from the viewer, through a link asked for then", async () => {
    vi.mocked(downloadFrom).mockReset();
    const fetch = serveStores();
    const { wrapper } = await openAppAt("/stores/scenery");
    await viewThrone(wrapper);

    document
      .querySelector<HTMLButtonElement>('.pswp__button[aria-label="Download throne.jpg"]')
      ?.click();
    await flushPromises();

    expect(asked(fetch, (url) => url.includes("/image-link?"))).toEqual([
      "/api/stores/scenery/image-link?name=throne.jpg&download=true",
    ]);
    expect(downloadFrom).toHaveBeenCalledWith(`${linkTo("throne.jpg")}&download`);
  });

  it("says a store with no images has none yet, with no grid", async () => {
    serveStores();
    const { wrapper } = await openAppAt("/stores/props");

    expect(wrapper.find("main .thumb-grid").exists()).toBe(false);
    expect(wrapper.get("main [data-test=no-images]").text()).toBe(
      "The Props store has no images yet.",
    );
  });

  it("is the same whichever production is chosen", async () => {
    const fetch = serveStores();
    openProduction("2026");
    const { wrapper } = await openAppAt("/stores/scenery");

    await wrapper.get("[data-test=production-switch] select").setValue("2027");
    await wrapper.get("[data-test=production-switch]").trigger("submit");
    await flushPromises();

    expect(openProductionYear()).toBe("2027");
    expect(thumbnails(wrapper)).toEqual(["castle-backdrop.png", "throne.jpg"]);
    expect(new Set(asked(fetch, (url) => url.startsWith("/api/stores/")))).toEqual(
      new Set(["/api/stores/scenery/image-links"]),
    );
  });

  it("shows the newest store asked for, even if an earlier one answers after it", async () => {
    let answerScenery = () => {};
    const fetch = serveStores();
    const serve = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, init) => {
      const answer = serve?.(url, init) ?? Promise.reject(new Error("no stand-in"));
      if (url !== "/api/stores/scenery/image-links") return answer;
      await new Promise<void>((done) => {
        answerScenery = done;
      });
      return answer;
    });
    const { wrapper, router } = await openAppAt("/stores/scenery");

    await router.push("/stores/props");
    await flushPromises();
    answerScenery();
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Props stores");
    expect(wrapper.find("main .thumb-grid").exists()).toBe(false);
  });

  it("says so when the store's images won't load", async () => {
    serveStores({ failing: "wardrobe" });
    const { wrapper } = await openAppAt("/stores/wardrobe");

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the store's images.");
  });

  it("says an image deleted since the page loaded isn't there, and catches up with storage", async () => {
    const fetch = serveStores({ gone: "throne.jpg" });
    const { wrapper } = await openAppAt("/stores/scenery");
    await viewThrone(wrapper);

    document
      .querySelector<HTMLButtonElement>('.pswp__button[aria-label="Download throne.jpg"]')
      ?.click();
    await flushPromises();

    expect(wrapper.get("main [data-test=file-problem]").text()).toBe(
      "throne.jpg isn't there any more.",
    );
    expect(asked(fetch, (url) => url.endsWith("/image-links"))).toHaveLength(2);
  });

  it("records a visit to the store's page", async () => {
    const fetch = serveStores();
    await openAppAt("/stores/wardrobe");

    const visits = fetch.mock.calls.flatMap(([url, init]) =>
      url === "/api/usage" ? [JSON.parse(String(init?.body))] : [],
    );
    expect(visits).toContainEqual({ event: "page", page: "wardrobe-stores" });
  });

  it("is the app's not-found page for a department with no store", async () => {
    serveStores();
    const { wrapper } = await openAppAt("/stores/sfx");

    expect(wrapper.get("main h1").text()).toBe("Page not found");
  });
});
