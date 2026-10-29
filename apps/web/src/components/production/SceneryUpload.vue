<script setup lang="ts">
import { nextTick, ref } from "vue";
import { uploadSceneryFile } from "@/services/scenery-upload.ts";
import { nameTakenMessage, uploadRefusal } from "@/utils/scenery.ts";

// Uploading one file to an item's scenery, chosen with the button (production-scenery FR8).
// The page shows any problem, and reloads the files once one is kept.

const props = defineProps<{ itemId: string; names: string[] }>();
const emit = defineEmits<{ uploaded: []; problem: [message: string | undefined] }>();

const button = ref<HTMLButtonElement>();
const picker = ref<HTMLInputElement>();
const uploading = ref(false);

async function upload() {
  const file = picker.value?.files?.[0];
  // Cleared, so choosing the same file again still uploads it.
  if (picker.value) picker.value.value = "";
  if (!file || uploading.value) return;
  const refused = uploadRefusal(file, props.names);
  emit("problem", refused);
  if (refused) return;
  uploading.value = true;
  const result = await uploadSceneryFile(props.itemId, file);
  uploading.value = false;
  // Disabled while it ran, which drops a keyboard's focus: give it back once enabled again.
  await nextTick();
  button.value?.focus();
  if (result === "uploaded") emit("uploaded");
  else if (result === "taken") emit("problem", nameTakenMessage(file.name));
  else emit("problem", `${file.name} wasn't uploaded. Check your connection and try again.`);
}
</script>

<template>
  <div class="cast-actions scenery-upload" data-test="upload-area">
    <button
      ref="button"
      type="button"
      data-test="upload"
      :disabled="uploading"
      @click="picker?.click()"
    >
      {{ uploading ? "Uploading…" : "Add a file" }}
    </button>
    <!-- The button opens it, so a keyboard has one stop, with the button's name. -->
    <input
      ref="picker"
      type="file"
      class="visually-hidden"
      tabindex="-1"
      aria-hidden="true"
      data-test="upload-input"
      @change="upload"
    />
    <p class="upload-rule">Scenery and set images only: no photos of cast members.</p>
  </div>
</template>
