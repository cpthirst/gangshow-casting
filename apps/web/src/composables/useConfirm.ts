import { shallowReadonly, shallowRef } from "vue";

/**
 * What the confirmation dialog asks: the question, word for word, its go-ahead button, and
 * the control it was asked from, which gets focus back when it closes.
 */
interface Confirmation {
  question: string;
  goAhead: string;
  from: HTMLElement | undefined;
}

// One question at a time, for the one dialog App mounts (ConfirmDialog.vue).
const asking = shallowRef<Confirmation & { answer: (yes: boolean) => void }>();

/**
 * Asks before going ahead, in iCUE's own dialog rather than the browser's box
 * (confirm-and-loading FR1). Resolves true only if they choose the go-ahead button.
 * Pass the control that asks: a tap doesn't focus a button on every phone (iOS Safari), so
 * whatever had focus is only the fallback, for a question with no control (leaving a page).
 */
export function useConfirm() {
  return (question: string, goAhead: string, from?: HTMLElement) =>
    new Promise<boolean>((answer) => {
      // A newer question replaces one still open, which is left as if cancelled.
      asking.value?.answer(false);
      asking.value = { question, goAhead, from, answer };
    });
}

/** The control that asks, to pass as useConfirm's `from`: the button a form was submitted
 *  with, or else the one clicked. Read it before any await: the event forgets it once it has
 *  been handled. */
export function controlOf(event: Event) {
  const control = "submitter" in event ? event.submitter : event.currentTarget;
  return control instanceof HTMLElement ? control : undefined;
}

/** For the dialog: what it's asked, and how to answer. */
export function useConfirmation() {
  return {
    asking: shallowReadonly(asking),
    answer(yes: boolean) {
      const asked = asking.value;
      asking.value = undefined;
      asked?.answer(yes);
    },
  };
}
