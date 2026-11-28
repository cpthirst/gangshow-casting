import { enableAutoUnmount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAppAt } from "@/app.fixture.ts";
import * as confirmDialog from "@/components/common/ConfirmDialog.fixture.ts";
import { downloadFrom, openFileTab } from "@/services/file-link.ts";
import { aFile, chooseFiles } from "@/services/file-upload.fixture.ts";
import {
  apiHolds,
  downloadLinkTo,
  type Held,
  linkTo,
  names,
  pageOf,
  requests,
} from "@/services/item-files-api.fixture.ts";
import { itemImageLinksPath } from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";

// Every file department's page is the same component: this file covers how an item's images
// show beside its other files, open in the viewer, open or download from it, and go.

// The browser's own new tabs and downloads, which happy-dom can't follow.
vi.mock("@/services/file-link.ts", () => ({ openFileTab: vi.fn(), downloadFrom: vi.fn() }));

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  useLocalSignIn();
});

describe("An item's images, on any file page", () => {
  // As the story has it: two images and a PDF.
  const openingNumberMix = () => ({
    "opening-number": [
      { name: "set-plan.jpg", size: 10 },
      { name: "build-list.pdf", size: 10 },
      { name: "backdrop.png", size: 10 },
    ],
  });

  const headings = (wrapper: VueWrapper) =>
    wrapper.findAll("main [aria-labelledby=files-heading] h3").map((h) => h.text());
  const thumbnails = (wrapper: VueWrapper) =>
    wrapper.findAll("main [data-test=image] [data-test=name]").map((name) => name.text());

  it("shows the item's images as thumbnails under Images, sorted by name, then its other files' rows under Other Files", async () => {
    apiHolds({ scenery: openingNumberMix() });
    const { wrapper } = await openAppAt(pageOf("scenery"));

    expect(headings(wrapper)).toEqual(["Images", "Other Files"]);
    expect(thumbnails(wrapper)).toEqual(["backdrop.png", "set-plan.jpg"]);
    expect(names(wrapper)).toEqual(["build-list.pdf"]);
    const section = wrapper.get("main [aria-labelledby=files-heading]").html();
    expect(section.indexOf("Images")).toBeLessThan(section.indexOf("set-plan.jpg"));
    expect(section.indexOf("set-plan.jpg")).toBeLessThan(section.indexOf("Other Files"));
    expect(section.indexOf("Other Files")).toBeLessThan(section.indexOf("build-list.pdf"));
  });

  it("uploads an image and another file chosen at once, showing each under its own heading", async () => {
    await signInAs(["stage"], "pat");
    const held: Held = {};
    apiHolds(held);
    const { wrapper } = await openAppAt(pageOf("scenery"));

    await chooseFiles(wrapper, aFile("set-plan.jpg"), aFile("build-list.pdf"));

    expect(held.scenery?.["opening-number"]?.map((file) => file.name).toSorted()).toEqual([
      "build-list.pdf",
      "set-plan.jpg",
    ]);
    expect(headings(wrapper)).toEqual(["Images", "Other Files"]);
    expect(thumbnails(wrapper)).toEqual(["set-plan.jpg"]);
    expect(names(wrapper)).toEqual(["build-list.pdf"]);
  });

  it("shows only images the browser can show as thumbnails, leaving SVG and HEIC as rows with the image icon", async () => {
    apiHolds({
      scenery: {
        "opening-number": [
          ...openingNumberMix()["opening-number"],
          { name: "logo.svg", size: 10 },
          { name: "fitting.heic", size: 10 },
          { name: "poster.webp", size: 10 },
        ],
      },
    });
    const { wrapper } = await openAppAt(pageOf("scenery"));

    expect(thumbnails(wrapper)).toEqual(["backdrop.png", "poster.webp", "set-plan.jpg"]);
    expect(names(wrapper)).toEqual(["build-list.pdf", "fitting.heic", "logo.svg"]);
    const iconOf = (name: string) =>
      wrapper
        .findAll("main [data-test=file]")
        .find((row) => row.get("[data-test=name]").text() === name)
        ?.get(".file-icon")
        .classes();
    expect(iconOf("logo.svg")).toContain("fa-file-image");
    expect(iconOf("fitting.heic")).toContain("fa-file-image");
  });

  it("lists an item with no images as rows, with no Images or Other Files heading", async () => {
    apiHolds({
      scenery: {
        finale: [
          { name: "cue-sheet.pdf", size: 10 },
          { name: "notes.txt", size: 10 },
        ],
      },
    });
    const { wrapper } = await openAppAt(pageOf("scenery", "finale"));

    expect(headings(wrapper)).toEqual([]);
    expect(names(wrapper)).toEqual(["cue-sheet.pdf", "notes.txt"]);
    expect(wrapper.find("main [data-test=image]").exists()).toBe(false);
  });

  it("shows an item with only images under Images, with no Other Files heading and no empty message", async () => {
    apiHolds({ scenery: { "campfire-song": [{ name: "backdrop.png", size: 10 }] } });
    const { wrapper } = await openAppAt(pageOf("scenery", "campfire-song"));

    expect(headings(wrapper)).toEqual(["Images"]);
    expect(thumbnails(wrapper)).toEqual(["backdrop.png"]);
    expect(wrapper.find("main [data-test=file]").exists()).toBe(false);
    expect(wrapper.find("[data-test=no-files]").exists()).toBe(false);
  });

  it("asks once for the item's image links, not once per image", async () => {
    const twelve = Array.from({ length: 12 }, (_, at) => ({
      name: `sketch-${at + 1}.png`,
      size: 10,
    }));
    apiHolds({ scenery: { "opening-number": twelve } });
    const { wrapper } = await openAppAt(pageOf("scenery"));

    expect(wrapper.findAll("main [data-test=image] img")).toHaveLength(12);
    const asked = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(
      asked.filter((url) => url === itemImageLinksPath("scenery", "opening-number")),
    ).toHaveLength(1);
    expect(asked.filter((url) => url.includes("/scenery-file-link?"))).toEqual([]);
  });

  it("opens a chosen thumbnail in the viewer, which moves through the item's images and nothing else", async () => {
    vi.mocked(openFileTab).mockReset();
    apiHolds({ scenery: openingNumberMix() });
    const { wrapper } = await openAppAt(pageOf("scenery"));

    const setPlan = wrapper
      .findAll("main [data-test=image]")
      .find((thumbnail) => thumbnail.text() === "set-plan.jpg");
    await setPlan?.get(".thumb-open").trigger("click");
    await flushPromises();

    const shownName = () => document.querySelector(".pswp__name")?.textContent;
    // Its code arrives on the first open.
    await vi.waitFor(() => expect(shownName()).toBe("set-plan.jpg"));
    expect(document.querySelector(".pswp__counter")?.textContent).toBe("2 / 2");
    document.querySelector<HTMLButtonElement>(".pswp__button[aria-label=Previous]")?.click();
    expect(shownName()).toBe("backdrop.png");
    expect(openFileTab).not.toHaveBeenCalled();
  });
});

describe("Opening and downloading from the image viewer, on any file page", () => {
  const openingNumberImages = () => ({
    "opening-number": [
      { name: "backdrop.png", size: 10 },
      { name: "build-list.pdf", size: 10 },
      { name: "set-plan.jpg", size: 10 },
      { name: "wings.webp", size: 10 },
    ],
  });
  const tab = { show: vi.fn(), close: vi.fn() };
  beforeEach(() => {
    vi.mocked(openFileTab).mockReset().mockReturnValue(tab);
    vi.mocked(downloadFrom).mockReset();
    tab.show.mockReset();
    // Without animating, so the viewer closes at once.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  async function viewSetPlan(held = openingNumberImages()) {
    apiHolds({ scenery: held });
    const { wrapper } = await openAppAt(pageOf("scenery"));
    const setPlan = wrapper
      .findAll("main [data-test=image]")
      .find((thumbnail) => thumbnail.text() === "set-plan.jpg");
    await setPlan?.get(".thumb-open").trigger("click");
    await vi.waitFor(() => expect(document.querySelector(".pswp")).not.toBeNull());
    return { wrapper, held };
  }

  const viewerButton = (name: string) => {
    const found = document.querySelector<HTMLButtonElement>(`.pswp__button[aria-label="${name}"]`);
    if (!found) throw new Error(`No ${name} button`);
    return found;
  };
  const linkRequests = () => requests((url) => url.includes("/scenery-file-link?"));
  const settle = () => new Promise((done) => setTimeout(done));

  it("opens the image alone in a new tab, with a link asked for then", async () => {
    await viewSetPlan();

    viewerButton("Open set-plan.jpg").click();
    await flushPromises();

    expect(linkRequests()).toHaveLength(1);
    expect(tab.show).toHaveBeenCalledWith(linkTo("set-plan.jpg"));
  });

  it("downloads the image through a link that saves it, asked for then, with no tab", async () => {
    await viewSetPlan();

    viewerButton("Download set-plan.jpg").click();
    await flushPromises();
    viewerButton("Download set-plan.jpg").click();
    await flushPromises();

    expect(linkRequests()).toHaveLength(2);
    expect(vi.mocked(downloadFrom).mock.calls).toEqual([
      [downloadLinkTo("set-plan.jpg")],
      [downloadLinkTo("set-plan.jpg")],
    ]);
    expect(openFileTab).not.toHaveBeenCalled();
  });

  it("lets a Read-Only Team Member open and download", async () => {
    await signInAs([], "jo");
    await viewSetPlan();

    viewerButton("Open set-plan.jpg").click();
    await flushPromises();
    viewerButton("Download set-plan.jpg").click();
    await flushPromises();

    expect(tab.show).toHaveBeenCalledWith(linkTo("set-plan.jpg"));
    expect(downloadFrom).toHaveBeenCalledWith(downloadLinkTo("set-plan.jpg"));
  });

  it.each(["Open", "Download"])(
    "closes on %s of an image removed elsewhere since, saying so, and catches up",
    async (verb) => {
      const { wrapper, held } = await viewSetPlan();
      held["opening-number"].splice(2, 1);

      viewerButton(`${verb} set-plan.jpg`).click();
      await flushPromises();
      await settle();

      expect(document.querySelector(".pswp")).toBeNull();
      expect(wrapper.get("main [data-test=file-problem]").text()).toBe(
        "set-plan.jpg isn't there any more.",
      );
      expect(wrapper.findAll("main [data-test=image]").map((each) => each.text())).toEqual([
        "backdrop.png",
        "wings.webp",
      ]);
    },
  );

  it("stays open when a download's link won't come, saying so", async () => {
    await viewSetPlan();
    const answer = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      String(url).includes("/scenery-file-link?")
        ? new Response(null, { status: 500 })
        : (answer?.(url, init) ?? new Response(null, { status: 404 })),
    );

    viewerButton("Download set-plan.jpg").click();
    await flushPromises();

    await settle();
    expect(document.querySelector(".pswp")).not.toBeNull();
    expect(document.querySelector(".pswp [role=alert]")?.textContent).toBe(
      "Couldn't download set-plan.jpg. Try again.",
    );
  });
});

describe("Removing an image, on any file page", () => {
  // As the story has it: two images and a PDF.
  const openingNumberMix = () => ({
    "opening-number": [
      { name: "backdrop.png", size: 10 },
      { name: "build-list.pdf", size: 10 },
      { name: "set-plan.jpg", size: 10 },
    ],
  });

  const thumbnails = (wrapper: VueWrapper) =>
    wrapper.findAll("main [data-test=image] [data-test=name]").map((name) => name.text());
  const trashFor = (wrapper: VueWrapper, name: string) => {
    const found = wrapper.findAll("main [data-test=image]").find((each) => each.text() === name);
    if (!found) throw new Error(`No thumbnail for ${name}`);
    return found.get("[data-test=delete]");
  };
  const deletes = () => requests((_, init) => init?.method === "DELETE");

  it("gives someone with Stage a trash icon on each thumbnail", async () => {
    await signInAs(["stage"], "pat");
    apiHolds({ scenery: openingNumberMix() });
    const { wrapper } = await openAppAt(pageOf("scenery"));

    expect(wrapper.findAll("main [data-test=image] [data-test=delete]")).toHaveLength(2);
    expect(trashFor(wrapper, "set-plan.jpg").attributes("aria-label")).toBe("Remove set-plan.jpg");
  });

  it("gives someone with only Casting no trash icon on any thumbnail", async () => {
    await signInAs(["casting"], "jo");
    apiHolds({ scenery: openingNumberMix() });
    const { wrapper } = await openAppAt(pageOf("scenery"));

    expect(thumbnails(wrapper)).toEqual(["backdrop.png", "set-plan.jpg"]);
    expect(wrapper.find("main [data-test=image] [data-test=delete]").exists()).toBe(false);
  });

  it("deletes the image once confirmed, keeping the others", async () => {
    await signInAs(["stage"], "pat");
    const held: Held = { scenery: openingNumberMix() };
    apiHolds(held);
    const { wrapper } = await openAppAt(pageOf("scenery"));

    await trashFor(wrapper, "set-plan.jpg").trigger("click");
    await flushPromises();
    await confirmDialog.goAhead();

    expect(deletes()).toEqual([
      `/api/productions/2027/items/opening-number/scenery-files?${new URLSearchParams({ name: "set-plan.jpg" })}`,
    ]);
    expect(held.scenery?.["opening-number"]?.map((file) => file.name)).toEqual([
      "backdrop.png",
      "build-list.pdf",
    ]);
    expect(thumbnails(wrapper)).toEqual(["backdrop.png"]);
  });

  it("returns the page to one list of rows once its last image goes", async () => {
    await signInAs(["stage"], "pat");
    apiHolds({
      scenery: {
        "campfire-song": [
          { name: "backdrop.png", size: 10 },
          { name: "cue-sheet.pdf", size: 10 },
        ],
      },
    });
    const { wrapper } = await openAppAt(pageOf("scenery", "campfire-song"));

    await trashFor(wrapper, "backdrop.png").trigger("click");
    await flushPromises();
    await confirmDialog.goAhead();

    expect(wrapper.findAll("main [aria-labelledby=files-heading] h3")).toEqual([]);
    expect(names(wrapper)).toEqual(["cue-sheet.pdf"]);
  });
});
