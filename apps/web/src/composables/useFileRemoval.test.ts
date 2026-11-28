import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import * as confirmDialog from "@/components/common/ConfirmDialog.fixture.ts";
import type { FileOutcome } from "@/services/file-open.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { useFileRemoval } from "./useFileRemoval.ts";

enableAutoUnmount(afterEach);
beforeEach(() => useLocalSignIn());
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** The API, answering every delete with the status given, or not at all for undefined. */
function deletesAnswer(status: number | undefined) {
  const fetch = vi.fn(async () =>
    status === undefined ? Promise.reject(new Error("offline")) : new Response(null, { status }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** A page of made-up files, each with a trash icon, an upload button, and the empty message
 *  once none are left; what each removal came to. The upload button waits while uploading. */
function mountPage(names: string[], { uploading = false } = {}) {
  const outcomes: (FileOutcome | undefined)[] = [];
  const Page = defineComponent(() => {
    const files = ref(names);
    const { remove } = useFileRemoval();
    const removeFile = async (name: string, event: MouseEvent) => {
      const drop = () => {
        files.value = files.value.filter((each) => each !== name);
      };
      outcomes.push(await remove(name, `/api/files?name=${name}`, event, drop));
    };
    return () =>
      h("main", [
        h("button", { "data-test": "upload", disabled: uploading }, "Add a file"),
        ...files.value.map((name) =>
          h(
            "button",
            {
              "data-test": "delete",
              "aria-label": `Remove ${name}`,
              onClick: (event: MouseEvent) => removeFile(name, event),
            },
            name,
          ),
        ),
        files.value.length === 0 ? h("p", { "data-test": "no-files", tabindex: -1 }, "None") : null,
      ]);
  });
  const wrapper = mount(confirmDialog.withConfirmDialog(Page), { attachTo: document.body });
  return { wrapper, outcomes };
}

const trashFor = (wrapper: VueWrapper, name: string) =>
  wrapper.get(`[aria-label="Remove ${name}"]`);

async function chooseTrash(wrapper: VueWrapper, name: string) {
  await trashFor(wrapper, name).trigger("click");
  await flushPromises();
}

const shown = (wrapper: VueWrapper) =>
  wrapper.findAll("[data-test=delete]").map((icon) => icon.text());

describe("Removing a file", () => {
  it("asks first, in the words a removal has", async () => {
    deletesAnswer(204);
    const { wrapper } = mountPage(["throne.jpg"]);

    await chooseTrash(wrapper, "throne.jpg");

    expect(confirmDialog.confirmation()).toEqual({
      question: "Remove throne.jpg? This can't be undone.",
      buttons: ["Remove file", "Cancel"],
    });
  });

  it("deletes nothing, and comes to nothing, when cancelled", async () => {
    const fetch = deletesAnswer(204);
    const { wrapper, outcomes } = mountPage(["throne.jpg"]);

    await chooseTrash(wrapper, "throne.jpg");
    await confirmDialog.cancelConfirmation();

    expect(fetch).not.toHaveBeenCalled();
    expect(outcomes).toEqual([undefined]);
    expect(shown(wrapper)).toEqual(["throne.jpg"]);
  });

  it("deletes the file once confirmed and takes it off the page, with no problem", async () => {
    const fetch = deletesAnswer(204);
    const { wrapper, outcomes } = mountPage(["crown.png", "throne.jpg"]);

    await chooseTrash(wrapper, "throne.jpg");
    await confirmDialog.goAhead();

    expect(fetch).toHaveBeenCalledWith(
      "/api/files?name=throne.jpg",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(outcomes).toEqual([{}]);
    expect(shown(wrapper)).toEqual(["crown.png"]);
  });

  it("says a file deleted elsewhere meanwhile isn't there any more, so the page can catch up", async () => {
    deletesAnswer(404);
    const { wrapper, outcomes } = mountPage(["throne.jpg"]);

    await chooseTrash(wrapper, "throne.jpg");
    await confirmDialog.goAhead();

    expect(outcomes).toEqual([{ problem: "throne.jpg isn't there any more.", gone: true }]);
  });

  it.each([500, undefined])(
    "says a delete that failed (%s) didn't happen, keeping the file",
    async (status) => {
      deletesAnswer(status);
      const { wrapper, outcomes } = mountPage(["throne.jpg"]);

      await chooseTrash(wrapper, "throne.jpg");
      await confirmDialog.goAhead();

      expect(outcomes).toEqual([{ problem: "Couldn't remove throne.jpg. Try again." }]);
      expect(shown(wrapper)).toEqual(["throne.jpg"]);
    },
  );

  it("ignores another removal while one is on its way", async () => {
    let answer = (_: Response) => {};
    const fetch = vi.fn(
      () =>
        new Promise<Response>((done) => {
          answer = done;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const { wrapper, outcomes } = mountPage(["crown.png", "throne.jpg"]);
    await chooseTrash(wrapper, "throne.jpg");
    await confirmDialog.goAhead();

    // The stand-in page doesn't disable its icons, as a tap can come before a page re-renders.
    await chooseTrash(wrapper, "crown.png");
    const asked = confirmDialog.confirmation();
    answer(new Response(null, { status: 204 }));
    await flushPromises();

    expect(asked).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([undefined, {}]);
  });

  it.each([
    ["the next trash icon", ["crown.png", "sword.gif", "throne.jpg"], "sword.gif", "throne.jpg"],
    ["the one before, after the last", ["crown.png", "throne.jpg"], "throne.jpg", "crown.png"],
  ])("moves focus to %s once removed", async (_, names, removed, focused) => {
    deletesAnswer(204);
    const { wrapper } = mountPage(names);

    await chooseTrash(wrapper, removed);
    await confirmDialog.goAhead();

    expect(document.activeElement).toBe(trashFor(wrapper, focused).element);
  });

  it.each([
    ["the upload button", false, "[data-test=upload]"],
    ["the empty message, while an upload is on its way", true, "[data-test=no-files]"],
  ])("moves focus to %s once the only file goes", async (_, uploading, focused) => {
    deletesAnswer(204);
    const { wrapper } = mountPage(["throne.jpg"], { uploading });

    await chooseTrash(wrapper, "throne.jpg");
    await confirmDialog.goAhead();

    expect(document.activeElement).toBe(wrapper.get(focused).element);
  });
});
