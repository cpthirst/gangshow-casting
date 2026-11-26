import { FILE_LINK_SECONDS, type ItemFile } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "@/app.fixture.ts";
import type { ViewerActions, ViewerImage } from "@/composables/useImageViewer.ts";
import { itemImageLinksPath } from "@/services/production.ts";
import ImageGrid from "./ImageGrid.vue";

// The viewer is tested on its own: these check what the grid hands it.
const viewer = vi.hoisted(() => ({
  label: "",
  actions: { open: (_name: string) => {}, download: (_name: string) => {} },
  open: vi.fn<(images: ViewerImage[], index: number) => Promise<void>>(),
  close: vi.fn(),
  say: vi.fn(),
}));
vi.mock("@/composables/useImageViewer.ts", () => ({
  useImageViewer: (label: () => string, actions: ViewerActions) => {
    viewer.label = label();
    viewer.actions = actions;
    return { open: viewer.open, close: viewer.close, say: viewer.say };
  },
}));

enableAutoUnmount(afterEach);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  viewer.open.mockReset();
  viewer.close.mockReset();
  viewer.say.mockReset();
});

const LINKS = itemImageLinksPath("scenery", "opening-number");

/** A stand-in API whose links name how many times they've been asked for, as fresh links
 *  differ from the last. */
function apiLinks(names: string[]) {
  let asked = 0;
  const fetch = vi.fn(async (url: string) => {
    if (url !== LINKS) return new Response(null, { status: 404 });
    asked += 1;
    return json({
      links: names.map((name) => ({ name, url: `https://files.example/${name}?v=${asked}` })),
    });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const linkRequests = (fetch: ReturnType<typeof apiLinks>) =>
  fetch.mock.calls.filter(([url]) => url === LINKS).length;

const filesNamed = (...names: string[]): ItemFile[] => names.map((name) => ({ name, size: 10 }));

async function openGrid(images: ItemFile[], { mayRemove = false, deleting = false } = {}) {
  const wrapper = mount(ImageGrid, {
    props: {
      department: "scenery",
      itemId: "opening-number",
      images,
      mayRemove,
      deleting,
      problem: undefined,
    },
  });
  await flushPromises();
  return wrapper;
}

const thumbnail = (wrapper: VueWrapper, name: string) => {
  const found = wrapper.findAll("[data-test=image]").find((each) => each.text() === name);
  if (!found) throw new Error(`No thumbnail for ${name}`);
  return found;
};

describe("The image grid", () => {
  it("shows each image in its square, named beneath it, in the order given", async () => {
    apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"));

    const thumbnails = wrapper.findAll("[data-test=image]");
    expect(thumbnails.map((each) => each.get("[data-test=name]").text())).toEqual([
      "backdrop.png",
      "set-plan.jpg",
    ]);
    expect(thumbnails.map((each) => each.get("img").attributes("src"))).toEqual([
      "https://files.example/backdrop.png?v=1",
      "https://files.example/set-plan.jpg?v=1",
    ]);
  });

  it("names each thumbnail for viewing its image", async () => {
    apiLinks(["set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("set-plan.jpg"));

    expect(thumbnail(wrapper, "set-plan.jpg").get("button").attributes("aria-label")).toBe(
      "View set-plan.jpg",
    );
    expect(thumbnail(wrapper, "set-plan.jpg").get("img").attributes("alt")).toBe("");
  });

  it("opens the viewer on the image chosen, among the item's images in order, rather than a tab", async () => {
    apiLinks(["backdrop.png", "set-plan.jpg", "wings.webp"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg", "wings.webp"));
    await thumbnail(wrapper, "set-plan.jpg").get("img").trigger("load");

    await thumbnail(wrapper, "set-plan.jpg").get("button").trigger("click");
    await flushPromises();

    expect(viewer.label).toBe("Scenery images");
    expect(viewer.open).toHaveBeenCalledOnce();
    const [images, index] = viewer.open.mock.calls[0] ?? [];
    expect(index).toBe(1);
    expect(images?.map(({ name, src }) => [name, src])).toEqual([
      ["backdrop.png", "https://files.example/backdrop.png?v=1"],
      ["set-plan.jpg", "https://files.example/set-plan.jpg?v=1"],
      ["wings.webp", "https://files.example/wings.webp?v=1"],
    ]);
    expect(images?.[1]?.thumbnail).toBe(thumbnail(wrapper, "set-plan.jpg").get("button").element);
    expect(wrapper.emitted("choose")).toBeUndefined();
  });

  it("opens the image as its row would when the viewer's code won't load, as after a release", async () => {
    apiLinks(["set-plan.jpg"]);
    viewer.open.mockRejectedValue(new TypeError("Failed to fetch dynamically imported module"));
    const wrapper = await openGrid(filesNamed("set-plan.jpg"));

    await thumbnail(wrapper, "set-plan.jpg").get("button").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("choose")).toEqual([[{ name: "set-plan.jpg", size: 10 }]]);
  });

  it("hands the viewer's Open and Download to the page, as a row's open and download", async () => {
    apiLinks(["set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("set-plan.jpg"));

    viewer.actions.open("set-plan.jpg");
    viewer.actions.download("set-plan.jpg");

    expect(wrapper.emitted("choose")).toEqual([[{ name: "set-plan.jpg", size: 10 }]]);
    expect(wrapper.emitted("download")).toEqual([[{ name: "set-plan.jpg", size: 10 }]]);
  });

  it("has the viewer say the page's problem while it's open", async () => {
    apiLinks(["set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("set-plan.jpg"));

    await wrapper.setProps({ problem: "Couldn't download set-plan.jpg. Try again." });

    expect(viewer.say).toHaveBeenLastCalledWith("Couldn't download set-plan.jpg. Try again.");
  });

  it("closes the viewer when the images change, as when the page catches up with storage", async () => {
    apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"));
    viewer.close.mockClear();

    await wrapper.setProps({ images: filesNamed("backdrop.png") });

    expect(viewer.close).toHaveBeenCalledOnce();
  });

  it("asks for fresh links before opening the viewer once they've lapsed, keeping those of images shown", async () => {
    const fetch = apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"));
    await thumbnail(wrapper, "backdrop.png").get("img").trigger("load");

    vi.advanceTimersByTime(FILE_LINK_SECONDS * 1000);
    await thumbnail(wrapper, "backdrop.png").get("button").trigger("click");
    await flushPromises();

    expect(linkRequests(fetch)).toBe(2);
    const [images] = viewer.open.mock.calls[0] ?? [];
    expect(images?.map(({ src }) => src)).toEqual([
      "https://files.example/backdrop.png?v=1",
      "https://files.example/set-plan.jpg?v=2",
    ]);
  });

  it("leaves out of the viewer an image that won't load, which opens as its row would", async () => {
    apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"));
    await thumbnail(wrapper, "set-plan.jpg").get("img").trigger("error");

    await thumbnail(wrapper, "backdrop.png").get("button").trigger("click");
    await flushPromises();
    const [images] = viewer.open.mock.calls[0] ?? [];
    expect(images?.map(({ name }) => name)).toEqual(["backdrop.png"]);

    const broken = thumbnail(wrapper, "set-plan.jpg").get("button");
    expect(broken.attributes("aria-label")).toBe("Open set-plan.jpg, JPG file");
    await broken.trigger("click");
    expect(wrapper.emitted("choose")).toEqual([[{ name: "set-plan.jpg", size: 10 }]]);
  });

  it("leaves each image for the browser to load as it scrolls near the screen", async () => {
    const names = Array.from({ length: 30 }, (_, at) => `backdrop-${at + 1}.png`);
    apiLinks(names);
    const wrapper = await openGrid(filesNamed(...names));

    expect(wrapper.findAll("img").map((img) => img.attributes("loading"))).toEqual(
      names.map(() => "lazy"),
    );
  });

  it("shows the image icon in the square of an image that won't load, keeping its name", async () => {
    apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"));

    await thumbnail(wrapper, "set-plan.jpg").get("img").trigger("error");

    const damaged = thumbnail(wrapper, "set-plan.jpg");
    expect(damaged.find("img").exists()).toBe(false);
    expect(damaged.get(".file-icon").classes()).toContain("fa-file-image");
    expect(damaged.get("[data-test=name]").text()).toBe("set-plan.jpg");
    expect(thumbnail(wrapper, "backdrop.png").find("img").exists()).toBe(true);
  });

  it("asks again for the links once they've lapsed, when an image that hadn't loaded fails", async () => {
    const fetch = apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"));

    vi.advanceTimersByTime(FILE_LINK_SECONDS * 1000);
    // Both fail before the fresh links arrive, as two images scrolled into view together.
    for (const img of wrapper.findAll("img")) img.element.dispatchEvent(new Event("error"));
    await flushPromises();

    expect(linkRequests(fetch)).toBe(2);
    expect(wrapper.findAll("img").map((img) => img.attributes("src"))).toEqual([
      "https://files.example/backdrop.png?v=2",
      "https://files.example/set-plan.jpg?v=2",
    ]);
  });

  it("keeps the link of an image already shown when the others get fresh ones", async () => {
    apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"));
    await thumbnail(wrapper, "backdrop.png").get("img").trigger("load");

    vi.advanceTimersByTime(FILE_LINK_SECONDS * 1000);
    await thumbnail(wrapper, "set-plan.jpg").get("img").trigger("error");
    await flushPromises();

    expect(wrapper.findAll("img").map((img) => img.attributes("src"))).toEqual([
      "https://files.example/backdrop.png?v=1",
      "https://files.example/set-plan.jpg?v=2",
    ]);
  });

  it("keeps the links it has when asking again fails, showing the icon only for the image that failed", async () => {
    const fetch = apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"));
    fetch.mockImplementation(async () => new Response(null, { status: 500 }));

    vi.advanceTimersByTime(FILE_LINK_SECONDS * 1000);
    await thumbnail(wrapper, "set-plan.jpg").get("img").trigger("error");
    await flushPromises();

    expect(thumbnail(wrapper, "backdrop.png").get("img").attributes("src")).toBe(
      "https://files.example/backdrop.png?v=1",
    );
    expect(thumbnail(wrapper, "set-plan.jpg").find("img").exists()).toBe(false);
  });

  it("asks for a link for an image added since, as after an upload", async () => {
    const fetch = apiLinks(["backdrop.png", "poster.webp"]);
    const wrapper = await openGrid(filesNamed("backdrop.png"));

    await wrapper.setProps({ images: filesNamed("backdrop.png", "poster.webp") });
    await flushPromises();

    expect(linkRequests(fetch)).toBe(2);
    expect(thumbnail(wrapper, "poster.webp").get("img").attributes("src")).toBe(
      "https://files.example/poster.webp?v=2",
    );
  });

  it("shows the image icon in every square when the links won't load, keeping the names", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const wrapper = await openGrid(filesNamed("backdrop.png"));

    expect(thumbnail(wrapper, "backdrop.png").find("img").exists()).toBe(false);
    expect(thumbnail(wrapper, "backdrop.png").find(".file-icon").exists()).toBe(true);
  });

  it("gives each thumbnail a trash icon named for its image, outside what opens it, for someone who may remove it", async () => {
    apiLinks(["backdrop.png", "set-plan.jpg"]);
    const wrapper = await openGrid(filesNamed("backdrop.png", "set-plan.jpg"), { mayRemove: true });

    const trash = thumbnail(wrapper, "set-plan.jpg").get("[data-test=delete]");
    expect(trash.attributes("aria-label")).toBe("Remove set-plan.jpg");
    expect(trash.element.closest(".thumb-open")).toBeNull();
    // Reached first, as a row's trash icon is.
    expect(thumbnail(wrapper, "set-plan.jpg").findAll("button")[0]?.element).toBe(trash.element);
    expect(wrapper.findAll("[data-test=delete]")).toHaveLength(2);

    await trash.trigger("click");

    expect(wrapper.emitted("remove")?.map(([image]) => image)).toEqual([
      { name: "set-plan.jpg", size: 10 },
    ]);
    expect(wrapper.emitted("choose")).toBeUndefined();
  });

  it("gives no thumbnail a trash icon for someone who may not remove it", async () => {
    apiLinks(["backdrop.png"]);
    const wrapper = await openGrid(filesNamed("backdrop.png"));

    expect(wrapper.find("[data-test=delete]").exists()).toBe(false);
  });

  it("holds the trash icons while a delete is on its way", async () => {
    apiLinks(["backdrop.png"]);
    const wrapper = await openGrid(filesNamed("backdrop.png"), { mayRemove: true, deleting: true });

    expect(wrapper.get("[data-test=delete]").attributes("disabled")).toBeDefined();
  });
});
