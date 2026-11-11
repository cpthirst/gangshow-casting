import { flushPromises } from "@vue/test-utils";
import { afterEach } from "vitest";
import { type Component, h } from "vue";
import { useConfirmation } from "@/composables/useConfirm.ts";
import ConfirmDialog from "./ConfirmDialog.vue";

// Answers the app's one confirmation dialog (ConfirmDialog.vue), as someone tapping it would.

// The question lives outside any component, so one a test left open mustn't reach the next.
afterEach(() => useConfirmation().answer(false));

/** A page with the dialog App mounts beside it, for a test that mounts the page alone. */
export const withConfirmDialog = (page: Component) => ({
  render: () => [h(page), h(ConfirmDialog)],
});

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

/** Chooses the go-ahead button for yes, or Cancel for no. */
export const answerConfirmation = (yes: boolean) => (yes ? goAhead() : cancelConfirmation());
