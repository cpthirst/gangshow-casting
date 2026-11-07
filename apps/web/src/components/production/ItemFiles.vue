<script setup lang="ts">
import { departments, type SceneryFile, SceneryFileLink, SceneryFileList } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import ItemPageFrame from "@/components/common/ItemPageFrame.vue";
import { downloadFrom, openFileTab } from "@/services/file-link.ts";
import { loadData } from "@/services/load-data.ts";
import { apiFetch, canChange } from "@/services/sign-in.ts";
import { icons } from "@/utils/icons.ts";
import {
  type FilesDepartment,
  itemFileLinkPath,
  itemFilePath,
  itemFilesPath,
} from "@/utils/item-files.ts";
import { fileIconOf, fileLabel, fileSize, opensInBrowser, sortFiles } from "@/utils/scenery.ts";
import FileUpload from "./FileUpload.vue";

// One item's files for a department, Scenery's, SFX's or Wardrobe's (production-scenery FR6,
// FR7, production-sfx-wardrobe FR2), in the frame every item page shares.

const props = defineProps<{ department: FilesDepartment }>();

const route = useRoute();
const frame = useTemplateRef("frame");
const key = computed(() => props.department.key);
// Named as the shared list says (ADR 0035).
const named = computed(() => departments[props.department.key]);
const mayChange = computed(() => canChange(props.department.key));
const files = ref<SceneryFile[]>([]);
// Why the last file chosen didn't open, download, delete or upload, if it didn't.
const fileProblem = ref<string>();
// A delete is on its way, so the trash icons wait for it.
const deleting = ref(false);

// Files come from storage on every visit, so one renamed or added there shows (FR6).
async function loadFiles(id: string) {
  const list = await loadData(itemFilesPath(key.value, id), SceneryFileList);
  return () => {
    files.value = sortFiles(list?.files ?? []);
  };
}

const reload = async () => frame.value?.reload();

// A file opens in a new tab or downloads through a short-lived link (FR10). A file deleted
// since the page loaded says so, and the grid catches up with storage.
async function choose({ name }: SceneryFile, id: string) {
  fileProblem.value = undefined;
  const tab = opensInBrowser(name, key.value) ? openFileTab() : undefined;
  try {
    const link = await loadData(itemFileLinkPath(key.value, id, name), SceneryFileLink);
    if (!link) {
      tab?.close();
      fileProblem.value = `${name} isn't there any more.`;
      await reload();
      return;
    }
    const { url } = link;
    if (tab) tab.show(url);
    else downloadFrom(url);
  } catch {
    tab?.close();
    fileProblem.value = `Couldn't ${tab ? "open" : "download"} ${name}. Try again.`;
  }
}

// For everyone, for good (FR11): there's no history to bring it back, so confirm first.
async function remove({ name }: SceneryFile, id: string) {
  if (deleting.value) return;
  if (!window.confirm(`Remove ${name}? This can't be undone.`)) return;
  fileProblem.value = undefined;
  deleting.value = true;
  const code = await sendDelete(id, name);
  deleting.value = false;
  if (code === 204) {
    files.value = files.value.filter((file) => file.name !== name);
  } else if (code === 404) {
    // Deleted in another browser meanwhile: say so, and catch up with storage.
    fileProblem.value = `${name} isn't there any more.`;
    await reload();
  } else {
    fileProblem.value = `Couldn't remove ${name}. Try again.`;
  }
}

// The status code, or undefined if the request didn't get an answer.
async function sendDelete(id: string, name: string) {
  try {
    return (await apiFetch(itemFilePath(key.value, id, name), { method: "DELETE" })).status;
  } catch {
    return undefined;
  }
}

// A problem with one item's file isn't another's.
watch(
  () => route.params.itemId,
  () => {
    fileProblem.value = undefined;
  },
);
</script>

<template>
  <ItemPageFrame ref="frame" v-slot="{ item }" :department="department.key" :load="loadFiles">
    <!-- A fresh instance per item, so a failed upload's Try again never reaches another. -->
    <FileUpload
      v-if="mayChange"
      :key="item.id"
      :department="department"
      :item-id="item.id"
      :names="files.map((file) => file.name)"
      @changed="reload"
      @problem="fileProblem = $event"
    />
    <p v-if="fileProblem" class="notice" role="alert" data-test="file-problem">{{ fileProblem }}</p>
    <!-- One row per file, as the role and prop cards: the trash icon first, as theirs. An
         explicit list role: Safari drops list semantics once bullets are styled away. -->
    <ul
      v-if="files.length > 0"
      class="role-cards"
      role="list"
      :aria-label="`${named.name} files`"
    >
      <li v-for="file in files" :key="file.name" class="role-card" data-test="file">
        <span v-if="mayChange" class="row-icons">
          <button
            type="button"
            class="icon-button"
            data-test="delete"
            :aria-label="`Remove ${file.name}`"
            data-tooltip="Remove file"
            :disabled="deleting"
            @click="remove(file, item.id)"
          >
            <FontAwesomeIcon :icon="icons.remove" />
          </button>
        </span>
        <button
          type="button"
          class="file-open"
          :aria-label="fileLabel(file.name, department.key)"
          @click="choose(file, item.id)"
        >
          <FontAwesomeIcon :icon="fileIconOf(file.name, department.key)" class="file-icon" fixed-width />
          <span class="file-name" data-test="name">{{ file.name }}</span>
          <span class="file-size" data-test="size">{{ fileSize(file.size) }}</span>
        </button>
      </li>
    </ul>
    <template v-else>
      <p data-test="no-files">No {{ named.noun }} files for this item yet.</p>
      <!-- The drag clause hides on a phone or tablet, which can't drag a file in. -->
      <p v-if="mayChange" data-test="how-to-add">
        Add one with Add a file above<span class="upload-drop-hint">, or drag one there</span>.
      </p>
    </template>
  </ItemPageFrame>
</template>
