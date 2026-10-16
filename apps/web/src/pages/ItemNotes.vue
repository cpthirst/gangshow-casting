<script setup lang="ts">
import { ItemNote, ItemNoteList } from "@app/shared";
import { ref, watch } from "vue";
import { ITEM_NOTES_PATH, MAX_NOTES, saveNotesPath } from "../item-notes.ts";

// An item's casting notes: one free-text field, saved on its own, apart from the running
// order (casting-item-overview FR8, FR10).
const props = defineProps<{ itemId: string }>();

const text = ref("");
/** The revision the text was loaded at; 0 for an item with no notes yet. */
const revision = ref(0);
const status = ref<"loading" | "ready" | "error">("loading");
const saving = ref(false);
const message = ref("");

async function currentNote(): Promise<ItemNote | undefined> {
  const res = await fetch(ITEM_NOTES_PATH);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ItemNoteList.parse(await res.json()).notes.find((n) => n.itemId === props.itemId);
}

function show(note: ItemNote | undefined) {
  text.value = note?.text ?? "";
  revision.value = note?.revision ?? 0;
}

async function load() {
  status.value = "loading";
  message.value = "";
  try {
    show(await currentNote());
    status.value = "ready";
  } catch {
    status.value = "error";
  }
}

// Follows the item when the page steps to another (Previous and Next).
watch(() => props.itemId, load, { immediate: true });

async function save() {
  if (text.value.trim().length > MAX_NOTES) {
    message.value = `Notes can be up to ${MAX_NOTES} characters.`;
    return;
  }
  saving.value = true;
  try {
    const res = await fetch(saveNotesPath(props.itemId), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: text.value, revision: revision.value }),
    });
    if (res.status === 409) {
      show(await currentNote());
      message.value =
        "Someone else changed these notes. Here they are now; your text wasn't saved.";
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    show(ItemNote.parse(await res.json()));
    message.value = "Notes saved.";
  } catch {
    // The text stays in the field, so nothing typed is lost.
    message.value = "Couldn't save the notes. Try again.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="item-notes" aria-labelledby="notes-heading">
    <h2 id="notes-heading">Notes</h2>
    <p v-if="status === 'error'" role="alert">Couldn't load the notes.</p>
    <form v-else novalidate @submit.prevent="save">
      <label for="item-notes-text" class="visually-hidden">Notes</label>
      <textarea
        id="item-notes-text"
        v-model="text"
        name="notes"
        rows="4"
        :disabled="status === 'loading'"
      />
      <div class="editor-actions">
        <button type="submit" class="primary" :disabled="saving || status === 'loading'">
          Save notes
        </button>
      </div>
      <p class="notes-message" role="status" data-test="notes-message">{{ message }}</p>
    </form>
  </section>
</template>
