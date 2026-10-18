<script setup lang="ts">
import { ItemNote, ItemNoteList, MAX_NOTE_LENGTH } from "@app/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { ITEM_NOTES_PATH, saveNotesPath } from "../item-notes.ts";
import { apiFetch, isReadOnly } from "../sign-in.ts";

// An item's casting notes: one free-text field, saved on its own, apart from the running
// order (casting-item-overview FR8, FR10). The page gives each item a fresh instance (keyed
// by item id), so a slow load or save can't land on another item's notes.
const props = defineProps<{ itemId: string }>();

const text = ref("");
/** What's saved, and the revision it was saved at (0 for an item with no notes yet). */
const saved = ref<{ text: string; revision: number }>({ text: "", revision: 0 });
const status = ref<"loading" | "ready" | "error">("loading");
const saving = ref(false);
/** A failed or refused save, or the length limit: shown as an error. */
const error = ref("");
/** "Notes saved.": shown beside the Save button, and announced, until the text changes. */
const announcement = ref("");

const unsaved = computed(() => status.value === "ready" && text.value !== saved.value.text);
/** What a Read-Only Team Member reads in place of the form. */
const readOnlyText = computed(() =>
  status.value === "loading" ? "Loading…" : saved.value.text || "No notes yet.",
);

async function currentNote(): Promise<ItemNote | undefined> {
  const res = await apiFetch(ITEM_NOTES_PATH);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ItemNoteList.parse(await res.json()).notes.find((n) => n.itemId === props.itemId);
}

function show(note: ItemNote | undefined) {
  saved.value = { text: note?.text ?? "", revision: note?.revision ?? 0 };
  text.value = saved.value.text;
}

// Typing makes any earlier message out of date. Loading saved or newer notes into the field
// isn't typing, so it keeps the message that explains it.
watch(text, (value) => {
  if (value === saved.value.text) return;
  announcement.value = "";
  error.value = "";
});

async function save() {
  if (text.value.trim().length > MAX_NOTE_LENGTH) {
    error.value = `Notes can be up to ${MAX_NOTE_LENGTH} characters.`;
    return;
  }
  saving.value = true;
  try {
    const res = await apiFetch(saveNotesPath(props.itemId), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: text.value, revision: saved.value.revision }),
    });
    if (res.status === 409) {
      show(await currentNote());
      error.value = "Someone else changed these notes. Here they are now; your text wasn't saved.";
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    show(ItemNote.parse(await res.json()));
    announcement.value = "Notes saved.";
  } catch {
    // The text stays in the field, so nothing typed is lost.
    error.value = "Couldn't save the notes. Try again.";
  } finally {
    saving.value = false;
  }
}

// Unsaved notes aren't lost without asking: stepping to another item, leaving the page or
// closing the tab.
const discardUnsaved = () => !unsaved.value || window.confirm("Discard your unsaved notes?");
onBeforeRouteUpdate(discardUnsaved);
onBeforeRouteLeave(discardUnsaved);
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (unsaved.value) event.preventDefault();
}

onMounted(async () => {
  window.addEventListener("beforeunload", warnBeforeUnload);
  try {
    show(await currentNote());
    status.value = "ready";
  } catch {
    status.value = "error";
  }
});
onUnmounted(() => window.removeEventListener("beforeunload", warnBeforeUnload));
</script>

<template>
  <section class="item-notes" aria-labelledby="notes-heading">
    <h2 id="notes-heading">Notes</h2>
    <p v-if="status === 'error'" role="alert">Couldn't load the notes.</p>
    <!-- Read-only members read the notes; they can't change them (team-roles FR6). -->
    <p v-else-if="isReadOnly" class="notes-text" data-test="notes-text">
      {{ readOnlyText }}
    </p>
    <form v-else novalidate @submit.prevent="save">
      <textarea
        v-model="text"
        name="notes"
        rows="4"
        :maxlength="MAX_NOTE_LENGTH"
        aria-labelledby="notes-heading"
        :aria-describedby="error ? 'notes-hint notes-error' : 'notes-hint'"
        :aria-invalid="error ? true : undefined"
        :disabled="status === 'loading'"
      />
      <p id="notes-hint" class="hint" data-test="notes-hint">
        Up to {{ MAX_NOTE_LENGTH }} characters
      </p>
      <p
        v-if="error"
        id="notes-error"
        class="field-error form-error"
        role="alert"
        data-test="notes-error"
      >
        {{ error }}
      </p>
      <div class="editor-actions">
        <button type="submit" class="primary" :disabled="saving || status === 'loading'">
          Save notes
        </button>
        <p class="notes-saved" role="status" data-test="notes-status">{{ announcement }}</p>
      </div>
    </form>
  </section>
</template>
