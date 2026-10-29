<script setup lang="ts">
import { nextTick, ref, shallowRef } from "vue";
import { uploadSceneryFile } from "@/services/scenery-upload.ts";
import { fileSize, replaceQuestion, uploadRefusal } from "@/utils/scenery.ts";

// Uploading one file at a time to an item's scenery, chosen with the button or dropped on the
// area, showing how much has gone (production-scenery FR8). A name the item has replaces its
// file once confirmed (FR9). The page shows any problem, and lists the files again when storage
// has changed.

const props = defineProps<{ itemId: string; names: string[] }>();
const emit = defineEmits<{ changed: []; problem: [message: string | undefined] }>();

const button = ref<HTMLButtonElement>();
const picker = ref<HTMLInputElement>();
// The upload under way, and how much of it has gone, from 0 to 1. Shallow, so each File stays
// itself: a form takes only a real File, never Vue's reactive copy of one.
const sending = shallowRef<{ file: File; fraction: number }>();
// An upload's start or end, for screen readers: never each step between, which would flood them.
const announced = ref("");
// The last upload, if it failed, so it can be tried again without choosing the file again.
const failed = shallowRef<{ file: File; replace: boolean }>();
// Whether a file is being dragged over the area, which highlights it.
const dropping = ref(false);

async function chosen() {
  const file = picker.value?.files?.[0];
  // Cleared, so choosing the same file again still uploads it.
  if (picker.value) picker.value.value = "";
  if (!file || sending.value) return;
  await take(file);
}

// Only a drag of the computer's files, not text or a link from the page.
const carriesFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes("Files");

function draggedOver(event: DragEvent) {
  if (!carriesFiles(event)) return;
  // Taken, or the browser won't drop the file here and opens it in place of the app instead.
  event.preventDefault();
  // Not drawn as a target during an upload, when a file dropped won't upload.
  dropping.value = !sending.value;
}

function dragLeft(event: DragEvent) {
  // Moving onto the area's own button or text still leaves it over the area.
  const area = event.currentTarget;
  const to = event.relatedTarget;
  if (area instanceof Node && to instanceof Node && area.contains(to)) return;
  dropping.value = false;
}

async function dropped(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  dropping.value = false;
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  if (sending.value) return emit("problem", "Wait for the upload to finish.");
  const [file] = files;
  if (files.length > 1 || !file) return emit("problem", "Drop one file at a time.");
  await take(file);
}

async function take(file: File) {
  const refused = uploadRefusal(file);
  emit("problem", refused);
  if (refused) return;
  // Compared exactly, as file storage compares names.
  const replace = props.names.includes(file.name);
  if (replace && !window.confirm(replaceQuestion(file.name))) return;
  await upload(file, replace);
}

async function upload(file: File, replace: boolean) {
  emit("problem", undefined);
  failed.value = undefined;
  sending.value = { file, fraction: 0 };
  announced.value = `Uploading ${file.name}`;
  const result = await uploadSceneryFile(props.itemId, file, {
    replace,
    onProgress: (fraction) => {
      if (sending.value) sending.value = { ...sending.value, fraction };
    },
  });
  sending.value = undefined;
  // Disabled while it ran, which drops a keyboard's focus: give it back once enabled again.
  await nextTick();
  button.value?.focus();
  if (result === "uploaded") {
    announced.value = `${file.name} uploaded`;
    emit("changed");
    return;
  }
  announced.value = "";
  if (result === "taken") {
    // Added in another browser since the page loaded: ask, as for a name the page showed.
    if (window.confirm(replaceQuestion(file.name))) await upload(file, true);
    else emit("changed");
    return;
  }
  failed.value = { file, replace };
  emit("problem", `${file.name} wasn't uploaded. Check your connection and try again.`);
}
</script>

<template>
  <div
    class="cast-actions scenery-upload"
    :class="{ dropping }"
    data-test="upload-area"
    @dragenter="draggedOver"
    @dragover="draggedOver"
    @dragleave="dragLeft"
    @drop="dropped"
  >
    <div class="upload-buttons">
      <button
        ref="button"
        type="button"
        data-test="upload"
        :disabled="!!sending"
        @click="picker?.click()"
      >
        {{ sending ? "Uploading…" : "Add a file" }}
      </button>
      <span v-if="!sending" class="upload-drop-hint">or drag one here</span>
      <button
        v-if="failed"
        type="button"
        data-test="try-again"
        @click="upload(failed.file, failed.replace)"
      >
        Try again
      </button>
    </div>
    <!-- The button opens it, so a keyboard has one stop, with the button's name. -->
    <input
      ref="picker"
      type="file"
      class="visually-hidden"
      tabindex="-1"
      aria-hidden="true"
      data-test="upload-input"
      @change="chosen"
    />
    <div v-if="sending" class="upload-progress" data-test="upload-progress">
      <span>
        Uploading {{ sending.file.name }}:
        {{ fileSize(Math.round(sending.fraction * sending.file.size)) }} of
        {{ fileSize(sending.file.size) }}
      </span>
      <progress max="1" :value="sending.fraction" :aria-label="`Uploading ${sending.file.name}`" />
    </div>
    <!-- There before anything is said in it, so screen readers hear each change. -->
    <p class="visually-hidden" role="status" data-test="upload-status">{{ announced }}</p>
    <p class="upload-rule">Scenery and set images only: no photos of cast members.</p>
  </div>
</template>
