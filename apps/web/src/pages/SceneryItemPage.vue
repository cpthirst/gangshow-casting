<script setup lang="ts">
import { RunningOrder, type SceneryFile, SceneryFileLink, SceneryFileList } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
import HelpButton from "@/components/common/HelpButton.vue";
import ItemNotes from "@/components/common/ItemNotes.vue";
import ItemStepNav from "@/components/common/ItemStepNav.vue";
import ReadOnlyNotice from "@/components/common/ReadOnlyNotice.vue";
import { showPageTitle } from "@/router/index.ts";
import { downloadFrom, openFileTab } from "@/services/file-link.ts";
import { apiFetch, canChangeScenery } from "@/services/sign-in.ts";
import { neighboursOf, placeOf, positionOf, RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import {
  fileIconOf,
  fileSize,
  opensInBrowser,
  SCENERY_NOTES_PATH,
  saveSceneryNotesPath,
  sceneryFileLinkPath,
  sceneryFilesPath,
  sortFiles,
  tileLabel,
} from "@/utils/scenery.ts";

// One item's scenery files (production-scenery FR6, FR7) and notes, laid out as the props
// item page.

const route = useRoute();
const order = ref<RunningOrder>();
const files = ref<SceneryFile[]>([]);
const status = ref<"loading" | "loaded" | "error">("loading");
// Why the last file chosen didn't open or download, if it didn't.
const fileProblem = ref<string>();

const itemId = computed(() =>
  typeof route.params.itemId === "string" ? route.params.itemId : undefined,
);
const place = computed(() =>
  order.value && itemId.value ? placeOf(order.value, itemId.value) : undefined,
);
const neighbours = computed(() =>
  order.value && place.value ? neighboursOf(order.value, place.value.item.id) : {},
);
// Loaded, but the item isn't in the latest saved running order.
const notFound = computed(() => status.value === "loaded" && !place.value);
const title = computed(() => (place.value ? `Scenery: ${place.value.item.title}` : ""));

// Follows the item even if the page is reused for another one (Previous and Next).
watchEffect(() => {
  if (place.value) showPageTitle(title.value);
  else if (notFound.value) showPageTitle("Item not found");
});

// Files come from storage on every visit, so one renamed or added there shows (FR6).
async function load(id: string) {
  status.value = "loading";
  try {
    const [orderRes, filesRes] = await Promise.all([
      apiFetch(RUNNING_ORDER_PATH),
      apiFetch(sceneryFilesPath(id)),
    ]);
    // No saved running order at all: no item can be in it.
    const loadedOrder =
      orderRes.status === 404 ? undefined : RunningOrder.parse(await okJson(orderRes));
    const loadedFiles = SceneryFileList.parse(await okJson(filesRes)).files;
    // Stepped on to another item while this one loaded: that load shows instead.
    if (id !== itemId.value) return;
    order.value = loadedOrder;
    files.value = sortFiles(loadedFiles);
    status.value = "loaded";
  } catch {
    // A failed load must never look like "not found" or "no files".
    if (id === itemId.value) status.value = "error";
  }
}

async function okJson(res: Response): Promise<unknown> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// A file opens in a new tab or downloads through a short-lived link (FR10). A file deleted
// since the page loaded says so, and the grid catches up with storage.
async function choose({ name }: SceneryFile) {
  const id = itemId.value;
  if (!id) return;
  fileProblem.value = undefined;
  const tab = opensInBrowser(name) ? openFileTab() : undefined;
  try {
    const res = await apiFetch(sceneryFileLinkPath(id, name));
    if (res.status === 404) {
      tab?.close();
      fileProblem.value = `${name} isn't there any more.`;
      await load(id);
      return;
    }
    const { url } = SceneryFileLink.parse(await okJson(res));
    if (tab) tab.show(url);
    else downloadFrom(url);
  } catch {
    tab?.close();
    fileProblem.value = `Couldn't ${tab ? "open" : "download"} ${name}. Try again.`;
  }
}

watch(
  itemId,
  (id) => {
    fileProblem.value = undefined;
    if (id) load(id);
  },
  { immediate: true },
);
</script>

<template>
  <ItemStepNav
    :list="{ name: 'production-overview' }"
    item-route="scenery-item"
    :previous="neighbours.previous"
    :next="neighbours.next"
  />
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <div class="page-title-row">
      <h1>{{ title }}</h1>
      <HelpButton page="scenery-item" label="Help for this item" title="Item help" />
    </div>
    <p class="item-position" data-test="position">{{ positionOf(place) }}</p>
    <!-- Those without Stage, Tech or Director see the files with nothing to change them. -->
    <ReadOnlyNotice about="scenery" />
    <!-- An explicit list role: Safari drops list semantics once bullets are styled away. -->
    <p v-if="fileProblem" class="notice" role="alert" data-test="file-problem">{{ fileProblem }}</p>
    <ul v-if="files.length > 0" class="file-tiles" role="list" aria-label="Scenery files">
      <li v-for="file in files" :key="file.name" data-test="file">
        <button
          type="button"
          class="file-tile"
          :aria-label="tileLabel(file.name)"
          @click="choose(file)"
        >
          <FontAwesomeIcon :icon="fileIconOf(file.name)" class="file-icon" />
          <span class="file-name" data-test="name">{{ file.name }}</span>
          <span class="file-size" data-test="size">{{ fileSize(file.size) }}</span>
        </button>
      </li>
    </ul>
    <p v-else data-test="no-files">No scenery files for this item yet.</p>
    <!-- Apart from the casting and props notes. A fresh instance per item, so stepping to
         another never mixes their notes. -->
    <ItemNotes
      :key="place.item.id"
      :item-id="place.item.id"
      heading="Scenery notes"
      :list-path="SCENERY_NOTES_PATH"
      :save-path="saveSceneryNotesPath(place.item.id)"
      :can-change="canChangeScenery"
    />
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
