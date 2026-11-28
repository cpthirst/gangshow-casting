<script setup lang="ts">
import {
  departments,
  type ItemFile,
  ItemFileList,
  isGalleryImage,
  type RunningOrder,
  type RunningOrderItem,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import ItemPageFrame from "@/components/common/ItemPageFrame.vue";
import { useFileRemoval } from "@/composables/useFileRemoval.ts";
import { openOrDownload } from "@/services/file-open.ts";
import { loadData } from "@/services/load-data.ts";
import {
  itemFileLinkPath,
  itemFilePath,
  itemFilesPath,
  itemImageLinksPath,
  itemUploadsPath,
} from "@/services/production.ts";
import { canChange } from "@/services/sign-in.ts";
import {
  fileIconOf,
  fileLabel,
  fileSize,
  opensInBrowser,
  sortFiles,
} from "@/utils/file-display.ts";
import type { FilesDepartment } from "@/utils/item-files.ts";
import FileUpload from "./FileUpload.vue";
import ImageGrid from "./ImageGrid.vue";
import RemoveFileButton from "./RemoveFileButton.vue";

// One item's files for a department, Scenery's, SFX's or Wardrobe's (production-scenery FR6,
// FR7, production-sfx-wardrobe FR2), headed Files in the frame every item page shares. Images
// the browser shows are thumbnails under Images, above the rest under Other Files; with no
// images, the files are one list (production-image-gallery FR1, FR2). The slot under them,
// before the department's notes, holds what sets a department apart: Wardrobe's costumes
// (production-costume-sheets FR2).

const props = defineProps<{
  department: FilesDepartment;
  /** Loads the data for the slot, alongside the files; returns how to show it. */
  load?: (itemId: string) => Promise<(order: RunningOrder) => void>;
}>();
defineSlots<{ default?(scope: { item: RunningOrderItem }): unknown }>();

const route = useRoute();
const frame = useTemplateRef("frame");
const key = computed(() => props.department.key);
// Named as the shared list says (ADR 0035).
const named = computed(() => departments[props.department.key]);
const mayChange = computed(() => canChange(props.department.key));
const { deleting, remove: removeFile } = useFileRemoval();
const files = ref<ItemFile[]>([]);
const images = computed(() => files.value.filter((file) => isGalleryImage(file.name)));
const otherFiles = computed(() => files.value.filter((file) => !isGalleryImage(file.name)));
// Why the last file chosen didn't open, download, delete or upload, if it didn't.
const fileProblem = ref<string>();

// Files come from storage on every visit, so one renamed or added there shows (FR6).
async function loadFiles(id: string) {
  const [list, showRest] = await Promise.all([
    loadData(itemFilesPath(key.value, id), ItemFileList),
    props.load?.(id),
  ]);
  return (order: RunningOrder) => {
    files.value = sortFiles(list?.files ?? []);
    showRest?.(order);
  };
}

// Catching up with storage after an upload or delete loads the slot's data again too, on
// purpose: it's as likely to have moved on meanwhile.
const reload = async () => frame.value?.reload();

// A file opens in a new tab or downloads through a short-lived link (FR10), or downloads
// whatever it is from the image viewer (production-image-gallery FR10). A file deleted since
// the page loaded says so, and the grid catches up with storage.
async function choose({ name }: Pick<ItemFile, "name">, id: string, download = false) {
  fileProblem.value = undefined;
  const opens = !download && opensInBrowser(name, key.value);
  const path = itemFileLinkPath(key.value, id, name, { download });
  const { problem, gone } = await openOrDownload(name, path, opens);
  fileProblem.value = problem;
  if (gone) await reload();
}

// From a row or a thumbnail.
async function remove({ name }: Pick<ItemFile, "name">, id: string, event: MouseEvent) {
  const removal = await removeFile(name, itemFilePath(key.value, id, name), event, () => {
    files.value = files.value.filter((file) => file.name !== name);
  });
  if (!removal) return;
  fileProblem.value = removal.problem;
  if (removal.gone) await reload();
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
    <section class="item-section" aria-labelledby="files-heading">
      <h2 id="files-heading">Files</h2>
      <!-- A fresh instance per item, so a failed upload's Try again never reaches another. -->
      <FileUpload
        v-if="mayChange"
        :key="item.id"
        :path="itemUploadsPath(department.key, item.id)"
        :rule="department.uploadRule"
        :names="files.map((file) => file.name)"
        @changed="reload"
        @problem="fileProblem = $event"
      />
      <p v-if="fileProblem" class="notice" role="alert" data-test="file-problem">{{ fileProblem }}</p>
      <template v-if="images.length > 0">
        <h3>Images</h3>
        <ImageGrid
          :key="item.id"
          :department="department.key"
          :links-path="itemImageLinksPath(department.key, item.id)"
          :images="images"
          :may-remove="mayChange"
          :deleting="deleting"
          :problem="fileProblem"
          @choose="choose($event, item.id)"
          @download="choose($event, item.id, true)"
          @remove="(image, event) => remove(image, item.id, event)"
        />
        <h3 v-if="otherFiles.length > 0">Other Files</h3>
      </template>
      <!-- One row per file, as the role and prop cards: the trash icon first, as theirs. An
           explicit list role: Safari drops list semantics once bullets are styled away. -->
      <ul
        v-if="otherFiles.length > 0"
        class="card-list"
        role="list"
        :aria-label="`${named.name} files`"
      >
        <li v-for="file in otherFiles" :key="file.name" class="card" data-test="file">
          <span v-if="mayChange" class="row-icons">
            <RemoveFileButton
              :name="file.name"
              :disabled="deleting"
              @remove="remove(file, item.id, $event)"
            />
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
      <template v-else-if="images.length === 0">
        <p data-test="no-files" tabindex="-1">No {{ named.noun }} files for this item yet.</p>
        <!-- The drag clause hides on a phone or tablet, which can't drag a file in. -->
        <p v-if="mayChange" data-test="how-to-add">
          Add one with Add a file above<span class="upload-drop-hint">, or drag one there</span>.
        </p>
      </template>
    </section>
    <slot :item="item" />
  </ItemPageFrame>
</template>
