<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, ref, useId } from "vue";
import { helpFor } from "@/utils/help.ts";
import { icons } from "@/utils/icons.ts";
import PageHelp from "./PageHelp.vue";

// A page's help, opened where you are (in-app-help FR6–FR8). A modal dialog, so the page
// behind, and anything unsaved on it, waits untouched until the help closes.
// label and title name the button and dialog for a page whose own title changes (an item's).
const props = defineProps<{ page: string; label?: string; title?: string }>();

const help = computed(() => helpFor(props.page));
const titleId = useId();
const dialog = ref<HTMLDialogElement>();
const button = ref<HTMLButtonElement>();
const closeButton = ref<HTMLButtonElement>();

async function open() {
  dialog.value?.showModal();
  // Browsers focus the dialog's first button themselves; this makes sure of it everywhere.
  await nextTick();
  closeButton.value?.focus();
}

function close() {
  dialog.value?.close();
  button.value?.focus();
}

// A click on the backdrop lands on the dialog itself; the content fills it, so a click
// inside lands there instead.
function closeIfOutside(event: MouseEvent) {
  if (event.target === dialog.value) close();
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="help-button"
    :aria-label="label ?? `Help for ${help.title}`"
    @click="open"
  >
    <FontAwesomeIcon :icon="icons.help" />
    Help
  </button>
  <!-- Escape is handled here too, so focus goes back to the help button however it closes. -->
  <dialog
    ref="dialog"
    class="help-dialog"
    :aria-labelledby="titleId"
    @click="closeIfOutside"
    @keydown.esc.prevent="close"
    @cancel.prevent="close"
  >
    <div class="help-dialog-content">
      <div class="help-dialog-title">
        <h2 :id="titleId">{{ title ?? `${help.title} help` }}</h2>
        <button ref="closeButton" type="button" @click="close">Close</button>
      </div>
      <PageHelp :help="help" />
    </div>
  </dialog>
</template>
