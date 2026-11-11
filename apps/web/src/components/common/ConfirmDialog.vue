<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import { useConfirmation } from "@/composables/useConfirm.ts";

// The app's one confirmation dialog (confirm-and-loading FR1–FR4), mounted once in App and
// asked from anywhere through useConfirm. Modal, like Help's, so nothing behind it can be
// reached until it's answered.
const { asking, answer } = useConfirmation();
const questionId = useId();
const dialog = ref<HTMLDialogElement>();
const cancelButton = ref<HTMLButtonElement>();
let askedFrom: HTMLElement | undefined;

watch(asking, async (asked) => {
  if (!asked || dialog.value?.open) return;
  const focused = document.activeElement;
  askedFrom = asked.from ?? (focused instanceof HTMLElement ? focused : undefined);
  dialog.value?.showModal();
  // Cancel first, so a stray Enter never goes ahead.
  await nextTick();
  cancelButton.value?.focus();
});

// Focus goes back before the answer, so a caller that moves it afterwards has the last word.
function close(yes: boolean) {
  dialog.value?.close();
  askedFrom?.focus();
  answer(yes);
}

// A click on the backdrop lands on the dialog itself; the content fills it.
function cancelIfOutside(event: MouseEvent) {
  if (event.target === dialog.value) close(false);
}
</script>

<template>
  <!-- Escape is handled here too, so it answers no and returns focus however it closes. -->
  <dialog
    ref="dialog"
    class="dialog confirm-dialog"
    :aria-labelledby="questionId"
    @click="cancelIfOutside"
    @keydown.esc.prevent="close(false)"
    @cancel.prevent="close(false)"
  >
    <div class="dialog-content">
      <p :id="questionId">{{ asking?.question }}</p>
      <div class="editor-actions">
        <button type="button" class="primary" @click="close(true)">{{ asking?.goAhead }}</button>
        <button ref="cancelButton" type="button" @click="close(false)">Cancel</button>
      </div>
    </div>
  </dialog>
</template>
