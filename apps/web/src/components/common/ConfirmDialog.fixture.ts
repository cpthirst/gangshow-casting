import { flushPromises } from "@vue/test-utils";
import { afterEach } from "vitest";
import { useConfirmation } from "@/composables/useConfirm.ts";

// Answers the app's one confirmation dialog (ConfirmDialog.vue), as someone tapping it would.

// The question lives outside any component, so one a test left open mustn't reach the next.
afterEach(() => useConfirmation().answer(false));

const openDialog = () =>
  document.querySelector<HTMLDialogElement>("dialog.confirm-dialog[open]") ?? undefined;

const buttonsOf = (dialog: HTMLDialogElement) => [...dialog.querySelectorAll("button")];

/** What the dialog is asking, and its buttons' labels, or undefined while it's closed. */
export function confirmation() {
  const dialog = openDialog();
  if (!dialog) return undefined;
  return {
    question: dialog.querySelector("p")?.textContent?.trim(),
    buttons: buttonsOf(dialog).map((button) => button.textContent?.trim()),
  };
}

async function choose(label: (dialog: HTMLDialogElement) => HTMLButtonElement | undefined) {
  const dialog = openDialog();
  if (!dialog) throw new Error("No confirmation dialog is open");
  label(dialog)?.click();
  await flushPromises();
}

/** Chooses the go-ahead button ("Remove role", "Discard changes"…). */
export const goAhead = () =>
  choose((dialog) => dialog.querySelector("button.primary") ?? undefined);

/** Chooses Cancel. */
export const cancelConfirmation = () =>
  choose((dialog) => buttonsOf(dialog).find((button) => button.textContent?.trim() === "Cancel"));
