import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as confirmDialog from "@/components/common/ConfirmDialog.fixture.ts";
import { aFile, chooseFiles, dropOnto } from "@/services/file-upload.fixture.ts";
import { type UploadResult, uploadFile, uploadsAtOnce } from "@/services/file-upload.ts";
import FileUpload from "./FileUpload.vue";

// The upload area every file page shares, for one file or a batch (stores FR9, FR10, FR13).
// The file pages' own tests cover the one-file upload's checks, questions and failures.

vi.mock("@/services/file-upload.ts", async (original) => ({
  ...(await original<typeof import("@/services/file-upload.ts")>()),
  uploadFile: vi.fn(),
}));

enableAutoUnmount(afterEach);
beforeEach(() => {
  vi.mocked(uploadFile).mockReset().mockResolvedValue("uploaded");
});
afterEach(() => {
  document.body.innerHTML = "";
});

const PATH = "/api/stores/wardrobe/uploads";
const MB = 1_000_000;

/** The Wardrobe store's upload area, holding the names given. */
function openUpload(names: string[] = []) {
  return mount(
    confirmDialog.withConfirmDialog(FileUpload, { path: PATH, names, imagesOnly: true }),
    {
      attachTo: document.body,
    },
  );
}

const area = (wrapper: VueWrapper) => wrapper.getComponent(FileUpload);
const changes = (wrapper: VueWrapper) => area(wrapper).emitted("changed")?.length ?? 0;
const problems = (wrapper: VueWrapper) =>
  area(wrapper)
    .emitted("problem")
    ?.map(([said]) => said);
const status = (wrapper: VueWrapper) => wrapper.get("[data-test=upload-status]").text();
const sentNames = () => vi.mocked(uploadFile).mock.calls.map(([, file]) => file.name);
const batch = () => [aFile("cloak.jpg", MB), aFile("crown.jpg", MB), aFile("tunic.jpg", MB)];

/** Holds each upload until the test finishes it, as photos take a while on a slow connection,
 *  counting the most under way at once. */
function holdUploads() {
  const going: { name: string; progress: (fraction: number) => void; end: () => void }[] = [];
  let most = 0;
  vi.mocked(uploadFile).mockImplementation((_path, file, { onProgress }) => {
    return new Promise<UploadResult>((resolve) => {
      const upload = {
        name: file.name,
        progress: onProgress,
        end: () => {
          going.splice(going.indexOf(upload), 1);
          resolve("uploaded");
        },
      };
      going.push(upload);
      most = Math.max(most, going.length);
    });
  });
  const find = (name: string) => {
    const found = going.find((upload) => upload.name === name);
    if (!found) throw new Error(`${name} isn't uploading`);
    return found;
  };
  return {
    going,
    most: () => most,
    progress: async (name: string, fraction: number) => {
      find(name).progress(fraction);
      await flushPromises();
    },
    finish: async (name: string) => {
      find(name).end();
      await flushPromises();
    },
  };
}

describe("Uploading many files at once", () => {
  it("takes many files from the picker, and uploads each one chosen", async () => {
    const wrapper = openUpload();

    await chooseFiles(wrapper, ...batch());

    expect(wrapper.get("[data-test=upload-input]").attributes()).toHaveProperty("multiple");
    expect(sentNames()).toEqual(["cloak.jpg", "crown.jpg", "tunic.jpg"]);
    expect(changes(wrapper)).toBe(3);
  });

  it("uploads each of many files dropped at once", async () => {
    const wrapper = openUpload();

    await dropOnto(wrapper, ...batch());

    expect(sentNames()).toEqual(["cloak.jpg", "crown.jpg", "tunic.jpg"]);
    expect(problems(wrapper)).not.toContain("Drop one file at a time.");
  });

  it("uploads one file chosen alone, as before", async () => {
    const wrapper = openUpload();

    await chooseFiles(wrapper, aFile("cloak.jpg"));

    expect(
      vi
        .mocked(uploadFile)
        .mock.calls.map(([path, file, { replace }]) => [path, file.name, replace]),
    ).toEqual([[PATH, "cloak.jpg", false]]);
    expect(changes(wrapper)).toBe(1);
    expect(status(wrapper)).toBe("cloak.jpg uploaded");
  });

  it("asks nothing before every file of a batch has gone", async () => {
    const uploads = holdUploads();
    const wrapper = openUpload();

    await chooseFiles(wrapper, ...batch());

    expect(confirmDialog.confirmation()).toBeUndefined();
    expect(wrapper.find("input:not([type=file]), textarea, select").exists()).toBe(false);
    for (const name of ["cloak.jpg", "crown.jpg", "tunic.jpg"]) await uploads.finish(name);
    expect(sentNames()).toEqual(["cloak.jpg", "crown.jpg", "tunic.jpg"]);
  });

  it("uploads the rest of a batch without asking, past a file it won't take and a name already there", async () => {
    const wrapper = openUpload(["crown.jpg"]);

    await chooseFiles(wrapper, ...batch(), aFile("build-list.pdf"));

    expect(confirmDialog.confirmation()).toBeUndefined();
    expect(sentNames()).toEqual(["cloak.jpg", "tunic.jpg"]);
  });

  it("shows which of the batch is uploading, and how much of the whole batch has gone", async () => {
    const uploads = holdUploads();
    const wrapper = openUpload();
    await chooseFiles(wrapper, ...batch());

    await uploads.finish("cloak.jpg");
    await uploads.progress("crown.jpg", 0.5);

    const progress = wrapper.get("[data-test=upload-progress]");
    expect(progress.text()).toBe("Uploading 2 of 3: 1.5 MB of 3 MB");
    const bar = progress.get("progress").element;
    if (!(bar instanceof HTMLProgressElement)) throw new Error("expected a progress bar");
    expect(bar.value / bar.max).toBe(0.5);
  });

  it("has each file join the page as it finishes, while the rest go on", async () => {
    const uploads = holdUploads();
    const wrapper = openUpload();
    await chooseFiles(wrapper, ...batch());

    await uploads.finish("cloak.jpg");

    expect(changes(wrapper)).toBe(1);
    expect(uploads.going.map((upload) => upload.name)).toEqual(["crown.jpg", "tunic.jpg"]);
  });

  it("uploads only a few of a big batch at once, and finishes them all", async () => {
    const uploads = holdUploads();
    const wrapper = openUpload();
    const photos = Array.from({ length: 50 }, (_, at) => aFile(`photo-${at + 1}.jpg`));

    await chooseFiles(wrapper, ...photos);
    while (uploads.going[0]) await uploads.finish(uploads.going[0].name);

    expect(uploads.most()).toBe(uploadsAtOnce);
    expect(uploads.most()).toBeGreaterThan(1);
    expect(sentNames()).toHaveLength(50);
    expect(changes(wrapper)).toBe(50);
  });

  it("announces only a batch's start and end, nothing for each file between", async () => {
    const uploads = holdUploads();
    const wrapper = openUpload();

    await chooseFiles(wrapper, ...batch());
    expect(status(wrapper)).toBe("Uploading 3 files");
    await uploads.progress("cloak.jpg", 0.5);
    await uploads.finish("cloak.jpg");
    await uploads.finish("crown.jpg");
    expect(status(wrapper)).toBe("Uploading 3 files");

    await uploads.finish("tunic.jpg");
    expect(status(wrapper)).toBe("3 files uploaded");
  });

  it("uploads nothing dropped during a batch, saying to wait", async () => {
    const uploads = holdUploads();
    const wrapper = openUpload();
    await chooseFiles(wrapper, aFile("cloak.jpg"), aFile("tunic.jpg"));

    await dropOnto(wrapper, aFile("crown.jpg"));

    expect(problems(wrapper)?.at(-1)).toBe("Wait for the upload to finish.");
    await uploads.finish("cloak.jpg");
    await uploads.finish("tunic.jpg");
    expect(sentNames()).toEqual(["cloak.jpg", "tunic.jpg"]);
  });
});
