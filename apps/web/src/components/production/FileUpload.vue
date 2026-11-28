<script setup lang="ts">
import { galleryImageExtensions } from "@app/shared";
import { computed, nextTick, ref, shallowRef } from "vue";
import { useConfirm } from "@/composables/useConfirm.ts";
import { type UploadResult, uploadFile, uploadsAtOnce } from "@/services/file-upload.ts";
import { fileSize, replaceQuestion, uploadRefusal } from "@/utils/file-display.ts";

// Uploading files to an item's scenery, SFX or Wardrobe, or to a store, chosen with the button
// or dropped on the area, one or a batch, showing how much has gone (production-scenery FR8,
// stores FR9, FR10, FR12, FR13). A batch goes a few at a time, asking nothing, each file joining
// the page as it finishes. A single file's name already there replaces its file once confirmed
// (FR9). The page shows any problem, and lists the files again when storage has changed.

const props = defineProps<{
  /** Where to ask the API for each upload. */
  path: string;
  /** The names already there. */
  names: string[];
  /** What the area says the files must be, if anything. */
  rule?: string | undefined;
  /** Takes only images the gallery shows, as a store does. */
  imagesOnly?: boolean;
}>();
const emit = defineEmits<{ changed: []; problem: [message: string | undefined] }>();
const askToConfirm = useConfirm();

const button = ref<HTMLButtonElement>();
const picker = ref<HTMLInputElement>();
// The files under way, how many bytes of each have gone, and how many have finished. Shallow, so
// each File stays itself: a form takes only a real File, never Vue's reactive copy of one.
const sending = shallowRef<{ files: File[]; sent: number[]; done: number }>();
// What the upload area shows of it: one file by name, a batch as a whole.
const progress = computed(() => {
  const now = sending.value;
  if (!now) return undefined;
  const total = sum(now.files.map((file) => file.size));
  const gone = sum(now.sent);
  const count = now.files.length;
  const one = count === 1 ? now.files[0] : undefined;
  const which = one ? one.name : `${Math.min(now.done + 1, count)} of ${count}`;
  return {
    text: `Uploading ${which}: ${fileSize(gone)} of ${fileSize(total)}`,
    label: `Uploading ${one ? one.name : filesCount(count)}`,
    fraction: total > 0 ? gone / total : 0,
  };
});
// An upload's start or end, for screen readers: never each step between, which would flood them.
const announced = ref("");
// The last upload, if it failed, so it can be tried again without choosing the file again.
const failed = shallowRef<{ file: File; replace: boolean }>();
// Whether a file is being dragged over the area, which highlights it.
const dropping = ref(false);

async function chosen() {
  const files = Array.from(picker.value?.files ?? []);
  // Cleared, so choosing the same files again still uploads them.
  if (picker.value) picker.value.value = "";
  if (sending.value) return;
  await take(files);
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
  await take(Array.from(files));
}

async function take(files: File[]) {
  if (files.length > 1) return uploadAll(files);
  if (files[0]) await takeOne(files[0]);
}

async function takeOne(file: File) {
  const refused = uploadRefusal(file, props.imagesOnly);
  emit("problem", refused);
  if (refused) return;
  // Compared exactly, as file storage compares names.
  const replace = props.names.includes(file.name);
  if (replace && !(await confirmReplace(file))) return;
  await upload(file, replace);
}

// Asked from the button, whether the file was chosen or dropped: focus goes back there.
const confirmReplace = (file: File) =>
  askToConfirm(replaceQuestion(file.name), "Replace file", button.value);

async function upload(file: File, replace: boolean) {
  emit("problem", undefined);
  failed.value = undefined;
  announced.value = `Uploading ${file.name}`;
  const [result] = await send([file], replace);
  await refocus();
  if (result === "uploaded") {
    announced.value = `${file.name} uploaded`;
    return;
  }
  announced.value = "";
  if (result === "taken") {
    // Added in another browser since the page loaded: ask, as for a name the page showed.
    if (await confirmReplace(file)) await upload(file, true);
    else emit("changed");
    return;
  }
  failed.value = { file, replace };
  emit("problem", `${file.name} wasn't uploaded. Check your connection and try again.`);
}

// A batch asks nothing, so it can be left to upload (stores FR10). A file it won't take, a name
// already there, or a failure leaves the rest to upload.
async function uploadAll(files: File[]) {
  emit("problem", undefined);
  failed.value = undefined;
  const taking = files.filter(
    (file) => !uploadRefusal(file, props.imagesOnly) && !props.names.includes(file.name),
  );
  if (taking.length === 0) return;
  // Its start and end only: one for each file would flood a screen reader.
  announced.value = `Uploading ${filesCount(taking.length)}`;
  const results = await send(taking, false);
  await refocus();
  const uploaded = results.filter((result) => result === "uploaded").length;
  announced.value = `${filesCount(uploaded)} uploaded`;
}

// Sends the files a few at a time, each joining the page as it finishes, and says how each
// ended, in the order given.
async function send(files: File[], replace: boolean) {
  sending.value = { files, sent: files.map(() => 0), done: 0 };
  const results: UploadResult[] = [];
  let next = 0;
  async function sendNext(): Promise<void> {
    const at = next++;
    const file = files[at];
    if (!file) return;
    results[at] = await uploadFile(props.path, file, {
      replace,
      onProgress: (fraction) => progressed(at, Math.round(fraction * file.size)),
    });
    finished(at, file.size);
    if (results[at] === "uploaded") emit("changed");
    await sendNext();
  }
  await Promise.all(Array.from({ length: Math.min(uploadsAtOnce, files.length) }, sendNext));
  sending.value = undefined;
  return results;
}

function progressed(at: number, bytes: number) {
  const now = sending.value;
  if (now) sending.value = { ...now, sent: now.sent.with(at, bytes) };
}

function finished(at: number, bytes: number) {
  const now = sending.value;
  if (now) sending.value = { ...now, sent: now.sent.with(at, bytes), done: now.done + 1 };
}

// Disabled while it ran, which drops a keyboard's focus: give it back once enabled again.
async function refocus() {
  await nextTick();
  button.value?.focus();
}

const sum = (numbers: number[]) => numbers.reduce((total, each) => total + each, 0);
const filesCount = (count: number) => (count === 1 ? "1 file" : `${count} files`);
</script>

<template>
  <div
    class="button-row file-upload"
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
      :accept="imagesOnly ? galleryImageExtensions.join(',') : undefined"
      multiple
      data-test="upload-input"
      @change="chosen"
    />
    <div v-if="progress" class="upload-progress" data-test="upload-progress">
      <span>{{ progress.text }}</span>
      <progress max="1" :value="progress.fraction" :aria-label="progress.label" />
    </div>
    <!-- There before anything is said in it, so screen readers hear each change. -->
    <p class="visually-hidden" role="status" data-test="upload-status">{{ announced }}</p>
    <p v-if="rule" class="upload-rule">{{ rule }}</p>
  </div>
</template>
