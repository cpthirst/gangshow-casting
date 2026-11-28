import { nextTick, readonly, ref } from "vue";
import type { FileOutcome } from "@/services/file-open.ts";
import { apiFetch } from "@/services/sign-in.ts";
import { controlOf, useConfirm } from "./useConfirm.ts";

// Where focus goes once the last trash icon has gone: the upload button, or else the page's
// empty message.
const AFTER_THE_LAST =
  "[data-test=upload]:not(:disabled), [data-test=no-files], [data-test=no-images]";

/**
 * Removes a file for everyone, for good, from its trash icon: an item's file or a store's
 * image alike (production-scenery FR11, stores FR19). There's no history to bring it back, so
 * it asks first. `deleting` is true while one is on its way, so the trash icons wait for it.
 */
export function useFileRemoval() {
  const askToConfirm = useConfirm();
  const deleting = ref(false);

  /** Once removed, `drop` takes it off the page, and focus moves to the next trash icon, or
   *  the one before if it was the last, so the next removal is one tap away. Undefined if
   *  they cancelled, or another removal is on its way. */
  async function remove(
    name: string,
    path: string,
    event: MouseEvent,
    drop: () => void,
  ): Promise<FileOutcome | undefined> {
    if (deleting.value) return undefined;
    // Read before any await: the event forgets it once it has been handled.
    const control = controlOf(event);
    const question = `Remove ${name}? This can't be undone.`;
    if (!(await askToConfirm(question, "Remove file", control))) return undefined;
    const page = control?.closest("main") ?? document;
    const at = trashIcons(page).findIndex((icon) => icon === control);
    deleting.value = true;
    const code = await sendDelete(path);
    deleting.value = false;
    if (code === 204) {
      drop();
      await nextTick();
      focusAfter(page, at);
      return {};
    }
    // Deleted in another browser meanwhile.
    if (code === 404) return { problem: `${name} isn't there any more.`, gone: true };
    return { problem: `Couldn't remove ${name}. Try again.` };
  }

  return { deleting: readonly(deleting), remove };
}

const trashIcons = (page: ParentNode) => [
  ...page.querySelectorAll<HTMLElement>("[data-test=delete]"),
];

function focusAfter(page: ParentNode, at: number) {
  const left = trashIcons(page);
  const next = left[at] ?? left[at - 1] ?? page.querySelector<HTMLElement>(AFTER_THE_LAST);
  next?.focus();
}

// The status code, or undefined if the request didn't get an answer.
async function sendDelete(path: string) {
  try {
    return (await apiFetch(path, { method: "DELETE" })).status;
  } catch {
    return undefined;
  }
}
