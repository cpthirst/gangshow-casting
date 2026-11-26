import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { useImageViewer } from "./useImageViewer.ts";

// The viewer is PhotoSwipe's own, run as it is: these check what iCUE hands it and asks of it.
// happy-dom can't swipe, pinch or animate, so those are checked by hand on a phone.

const imported = vi.hoisted(() => ({ times: 0 }));
vi.mock("photoswipe", async (importOriginal) => {
  imported.times += 1;
  return importOriginal();
});

enableAutoUnmount(afterEach);
beforeEach(() => {
  // A phone's screen, as PhotoSwipe measures it; happy-dom's has no width.
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: 400,
    configurable: true,
  });
  vi.stubGlobal("innerHeight", 800);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Whether the device is set to reduce motion, which PhotoSwipe reads. */
function reduceMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** A page of thumbnails, one per name, that opens the viewer on the one chosen. */
function mountThumbnails(names: string[], sizes: Partial<Record<string, [number, number]>> = {}) {
  const actions = { open: vi.fn(), download: vi.fn() };
  let viewer: ReturnType<typeof useImageViewer> | undefined;
  const wrapper = mount(
    defineComponent({
      setup() {
        viewer = useImageViewer(() => "Scenery images", actions);
        return () =>
          h(
            "ul",
            names.map((name) => h("li", h("button", { "data-name": name }, name))),
          );
      },
    }),
    { attachTo: document.body },
  );
  const thumbnails = wrapper.findAll("button").map((each) => each.element);
  const images = names.map((name, at) => {
    const [width, height] = sizes[name] ?? [0, 0];
    const thumbnail = thumbnails[at];
    if (!thumbnail) throw new Error(`No thumbnail for ${name}`);
    return { name, src: `https://files.example/${name}`, width, height, thumbnail };
  });
  return {
    wrapper,
    actions,
    say: (problem: string | undefined) => viewer?.say(problem),
    close: () => viewer?.close(),
    async view(name: string) {
      await viewer?.open(
        images,
        images.findIndex((image) => image.name === name),
      );
      await flushPromises();
    },
  };
}

const viewer = () => document.querySelector<HTMLElement>(".pswp");
const button = (name: string) => {
  const found = document.querySelector<HTMLButtonElement>(`.pswp__button[aria-label="${name}"]`);
  if (!found) throw new Error(`No ${name} button`);
  return found;
};
// The image on screen: PhotoSwipe readies the ones either side too.
const shownImage = () =>
  document.querySelector<HTMLImageElement>('.pswp__item[aria-hidden="false"] img.pswp__img');
// How long PhotoSwipe's opening, closing and zooming take.
const transitionTime = () => viewer()?.style.getPropertyValue("--pswp-transition-duration");
const shownName = () => document.querySelector(".pswp__name")?.textContent;
const press = (key: string) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
// Without animating, PhotoSwipe closes once the moment's events have run.
const settle = () => new Promise((done) => setTimeout(done));

const SCENERY = ["backdrop.png", "set-plan.jpg", "wings.webp"];

describe("The image viewer", () => {
  it("loads its code only when an image is first opened", async () => {
    reduceMotion(true);
    const page = mountThumbnails(SCENERY);
    await flushPromises();
    expect(imported.times).toBe(0);

    await page.view("set-plan.jpg");

    expect(imported.times).toBe(1);
    expect(viewer()).not.toBeNull();
  });

  it("is a dialog named for the images, showing the chosen one with its name", async () => {
    reduceMotion(true);
    await mountThumbnails(SCENERY).view("set-plan.jpg");

    expect(viewer()?.getAttribute("role")).toBe("dialog");
    expect(viewer()?.getAttribute("aria-modal")).toBe("true");
    expect(viewer()?.getAttribute("aria-label")).toBe("Scenery images");
    expect(shownImage()?.getAttribute("src")).toBe("https://files.example/set-plan.jpg");
    expect(shownName()).toBe("set-plan.jpg");
    // On a line of its own, not squeezed between the counter and the buttons on a phone.
    expect(document.querySelector(".pswp__top-bar .pswp__name")).toBeNull();
  });

  it("keeps keyboard focus inside it while it's open", async () => {
    reduceMotion(true);
    await mountThumbnails(SCENERY).view("set-plan.jpg");

    document.querySelector<HTMLElement>("[data-name='backdrop.png']")?.focus();

    expect(viewer()?.contains(document.activeElement)).toBe(true);
  });

  it("names each of its buttons", async () => {
    reduceMotion(true);
    await mountThumbnails(SCENERY).view("set-plan.jpg");

    for (const name of ["Close", "Zoom", "Previous", "Next"]) {
      expect(button(name)).toBeDefined();
    }
    // A tooltip on hover, as PhotoSwipe's own buttons have.
    expect(button("Open set-plan.jpg").title).toBe("Open");
    expect(button("Download set-plan.jpg").title).toBe("Download");
  });

  it("shows the image as large as the screen allows, sized from its thumbnail", async () => {
    reduceMotion(true);
    await mountThumbnails(SCENERY, { "set-plan.jpg": [2000, 1000] }).view("set-plan.jpg");

    const img = shownImage();
    expect([img?.style.width, img?.style.height]).toEqual(["400px", "200px"]);
  });

  it("shows an image whose thumbnail hadn't loaded at the screen's size, then its own once it arrives", async () => {
    reduceMotion(true);
    // Still on its way, which happy-dom's images never are.
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);
    await mountThumbnails(SCENERY).view("set-plan.jpg");
    const img = shownImage();
    expect([img?.style.width, img?.style.height]).toEqual(["400px", "800px"]);

    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(2000);
    vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(1000);
    img?.dispatchEvent(new Event("load"));

    expect([img?.style.width, img?.style.height]).toEqual(["400px", "200px"]);
  });

  it("moves to the next and previous image by button or arrow key, going round at either end", async () => {
    reduceMotion(true);
    await mountThumbnails(SCENERY).view("set-plan.jpg");

    button("Next").click();
    expect(shownName()).toBe("wings.webp");
    press("ArrowRight");
    expect(shownName()).toBe("backdrop.png");
    button("Previous").click();
    expect(shownName()).toBe("wings.webp");
    press("ArrowLeft");
    press("ArrowLeft");
    expect(shownName()).toBe("backdrop.png");
  });

  it("has no Next or Previous for an item's only image", async () => {
    reduceMotion(true);
    await mountThumbnails(["backdrop.png"]).view("backdrop.png");

    // PhotoSwipe's style hides the arrows of a viewer with one image.
    expect(viewer()?.classList).toContain("pswp--one-slide");
  });

  it("closes on Escape or Close, with focus on the thumbnail of the image last shown", async () => {
    reduceMotion(true);
    const page = mountThumbnails(SCENERY);
    for (const close of [() => press("Escape"), () => button("Close").click()]) {
      await page.view("set-plan.jpg");
      button("Next").click();

      close();
      await settle();

      expect(viewer()).toBeNull();
      expect(document.activeElement?.getAttribute("data-name")).toBe("wings.webp");
    }
  });

  it("changes without animating when the device is set to reduce motion", async () => {
    reduceMotion(true);
    await mountThumbnails(SCENERY).view("set-plan.jpg");
    expect(transitionTime()).toBe("0ms");
    button("Next").click();
    expect(transitionTime()).toBe("0ms");
    press("Escape");
    await settle();
    expect(viewer()).toBeNull();
  });

  it("animates when the device isn't set to reduce motion", async () => {
    reduceMotion(false);
    await mountThumbnails(SCENERY).view("set-plan.jpg");

    expect(transitionTime()).not.toBe("0ms");
  });

  it("has Open and Download buttons named for the image shown, which hand it to the page", async () => {
    reduceMotion(true);
    const page = mountThumbnails(SCENERY);
    await page.view("set-plan.jpg");

    button("Open set-plan.jpg").click();
    button("Next").click();
    button("Download wings.webp").click();

    expect(page.actions.open.mock.calls).toEqual([["set-plan.jpg"]]);
    expect(page.actions.download.mock.calls).toEqual([["wings.webp"]]);
  });

  it("says a problem the page has, until another image is shown", async () => {
    reduceMotion(true);
    const page = mountThumbnails(SCENERY);
    await page.view("set-plan.jpg");

    page.say("Couldn't download set-plan.jpg. Try again.");

    const problem = document.querySelector(".pswp [role=alert]");
    expect(problem?.textContent).toBe("Couldn't download set-plan.jpg. Try again.");
    // Marked as the page's own problems are.
    expect(problem?.classList).toContain("notice");
    expect(viewer()).not.toBeNull();
    button("Next").click();
    expect(problem?.textContent).toBe("");
  });

  it("closes when the page asks", async () => {
    reduceMotion(true);
    const page = mountThumbnails(SCENERY);
    await page.view("set-plan.jpg");

    page.close();
    await settle();

    expect(viewer()).toBeNull();
  });

  it("doesn't open over a page left while its code was loading", async () => {
    reduceMotion(true);
    const page = mountThumbnails(SCENERY);

    const opening = page.view("set-plan.jpg");
    page.wrapper.unmount();
    await opening;

    expect(viewer()).toBeNull();
  });

  it("closes when the page that opened it goes", async () => {
    reduceMotion(true);
    const page = mountThumbnails(SCENERY);
    await page.view("set-plan.jpg");

    page.wrapper.unmount();
    await settle();

    expect(viewer()).toBeNull();
  });
});
