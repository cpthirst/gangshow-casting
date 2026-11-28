import { galleryImageExtensions, storeIds, stores } from "@app/shared";
import { enableAutoUnmount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json, openAppAt } from "@/app.fixture.ts";
import * as confirmDialog from "@/components/common/ConfirmDialog.fixture.ts";
import { downloadFrom } from "@/services/file-link.ts";
import { aFile, chooseFile, StandInXhr } from "@/services/file-upload.fixture.ts";
import { openProduction, openProductionYear } from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
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
const twoInScenery = () => ({
  scenery: ["throne.jpg", "castle-backdrop.png"],
  props: [],
  wardrobe: [],
});
const linkTo = (name: string) => `https://files.example/stores/${name}?signed`;

/** Where the stand-in file storage takes uploads, apart from the API, as the bucket is. */
const STORAGE = "https://files.example/";

/** A stand-in API holding the stores' images, changed by uploads, and the productions "2026"
 *  and "2027": a failing store's images won't load, and a gone image has been deleted since
 *  the list. */
function serveStores({
  failing,
  gone,
  held = twoInScenery(),
}: {
  failing?: string;
  gone?: string;
  held?: Record<string, string[]>;
} = {}) {
  vi.stubGlobal("XMLHttpRequest", StandInXhr);
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === STORAGE) return stored(held, init?.body);
    const [, store = "", ask] =
      /^\/api\/stores\/([\w-]+)\/(image-links|image-link\?.*|uploads)$/.exec(url) ?? [];
    const names = held[store];
    if (store === failing) return new Response(null, { status: 500 });
    if (ask === "uploads" && names) {
      const { name, replace } = JSON.parse(String(init?.body));
      if (names.includes(name) && !replace) return new Response(null, { status: 409 });
      return json({ url: STORAGE, fields: { key: `${store}/${name}` } });
    }
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

// Keeps the image a form sends at its key, as the bucket would.
function stored(held: Record<string, string[]>, form: unknown) {
  if (!(form instanceof FormData)) return new Response(null, { status: 400 });
  const [store = "", name = ""] = String(form.get("key")).split("/");
  held[store] = [...(held[store] ?? []).filter((each) => each !== name), name];
  return new Response(null, { status: 204 });
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

describe("Adding an image to a store", () => {
  const throneOnly = () => ({ scenery: ["throne.jpg"], props: [], wardrobe: [] });
  const uploadArea = (wrapper: VueWrapper) => wrapper.find("main [data-test=upload-area]");
  const uploadsAsked = (fetch: ReturnType<typeof serveStores>) =>
    fetch.mock.calls.filter(([url]) => url.endsWith("/uploads"));

  it("uploads an image someone with Stage adds to the Scenery store, which joins the grid in name order", async () => {
    await signInAs(["stage"], "pat");
    const held = throneOnly();
    const fetch = serveStores({ held });
    const { wrapper } = await openAppAt("/stores/scenery");

    await chooseFile(wrapper, aFile("castle-backdrop.png", 2_400_000));

    const [[url, init] = []] = uploadsAsked(fetch);
    expect(url).toBe("/api/stores/scenery/uploads");
    // Its file's name, and nothing to describe it (stores FR12).
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "castle-backdrop.png",
      size: 2_400_000,
    });
    expect(held.scenery).toContain("castle-backdrop.png");
    expect(thumbnails(wrapper)).toEqual(["castle-backdrop.png", "throne.jpg"]);
  });

  it("shows an image just added in the viewer under its name", async () => {
    await signInAs(["stage"], "pat");
    serveStores({ held: throneOnly() });
    const { wrapper } = await openAppAt("/stores/scenery");
    await chooseFile(wrapper, aFile("castle-backdrop.png"));

    const added = wrapper
      .findAll("main [data-test=image]")
      .find((each) => each.text() === "castle-backdrop.png");
    await added?.get(".thumb-open").trigger("click");

    await vi.waitFor(() => expect(shownName()).toBe("castle-backdrop.png"));
  });

  it.each([
    ["stage", "props", "wardrobe"],
    ["wardrobe", "wardrobe", "props"],
  ])(
    "shows someone with %s the upload area on the %s store, and not on the %s store",
    async (permission, own, other) => {
      await signInAs([permission], "pat");
      serveStores();
      const { wrapper, router } = await openAppAt(`/stores/${own}`);
      const onOwn = uploadArea(wrapper).exists();

      await router.push(`/stores/${other}`);
      await flushPromises();

      expect([onOwn, uploadArea(wrapper).exists()]).toEqual([true, false]);
    },
  );

  it("shows an admin the upload area on every store, each with its rule against photos of cast members", async () => {
    serveStores();
    const { wrapper, router } = await openAppAt("/stores/scenery");

    const rules = [];
    for (const store of storeIds) {
      await router.push(`/stores/${store}`);
      await flushPromises();
      rules.push(uploadArea(wrapper).find(".upload-rule").text());
    }

    // The wording itself is pinned once, in the shared list's tests.
    expect(rules).toEqual(storeIds.map((store) => stores[store].uploadRule));
  });

  it.each([["director"], ["tech"]])(
    "shows someone with only %s no upload area on the Scenery store",
    async (permission) => {
      await signInAs([permission], "dee");
      serveStores();
      const { wrapper } = await openAppAt("/stores/scenery");

      expect(thumbnails(wrapper)).toEqual(["castle-backdrop.png", "throne.jpg"]);
      expect(uploadArea(wrapper).exists()).toBe(false);
    },
  );

  it("suggests only images in the file picker", async () => {
    serveStores();
    const { wrapper } = await openAppAt("/stores/scenery");

    expect(wrapper.get("main [data-test=upload-input]").attributes("accept")).toBe(
      galleryImageExtensions.join(","),
    );
  });

  it("doesn't upload a file that isn't an image the store keeps, saying so", async () => {
    await signInAs(["stage"], "pat");
    const fetch = serveStores({ held: throneOnly() });
    const { wrapper } = await openAppAt("/stores/scenery");

    await chooseFile(wrapper, aFile("build-list.pdf"));

    expect(uploadsAsked(fetch)).toEqual([]);
    expect(wrapper.get("main [data-test=file-problem]").text()).toBe(
      "build-list.pdf isn't an image the store keeps, so it wasn't uploaded.",
    );
  });

  it("doesn't upload an image over 100 MB, saying so", async () => {
    await signInAs(["stage"], "pat");
    const fetch = serveStores({ held: throneOnly() });
    const { wrapper } = await openAppAt("/stores/scenery");

    await chooseFile(wrapper, aFile("castle.jpg", 120_000_000));

    expect(uploadsAsked(fetch)).toEqual([]);
    expect(wrapper.get("main [data-test=file-problem]").text()).toBe(
      "castle.jpg is over 100 MB, so it wasn't uploaded.",
    );
  });

  it("asks before replacing an image of a name the store already has", async () => {
    await signInAs(["stage"], "pat");
    const fetch = serveStores({ held: throneOnly() });
    const { wrapper } = await openAppAt("/stores/scenery");

    await chooseFile(wrapper, aFile("throne.jpg"));
    const question = confirmDialog.confirmation()?.question;
    await confirmDialog.goAhead();

    expect(question).toBe("Replace throne.jpg? The old copy can't be brought back.");
    const [[, init] = []] = uploadsAsked(fetch);
    expect(JSON.parse(String(init?.body))).toMatchObject({ name: "throne.jpg", replace: true });
  });
});
