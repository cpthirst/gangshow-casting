<script setup lang="ts">
import { departments, ItemImageLinks, type StoreId, storeTitle } from "@app/shared";
import { computed, ref, watch } from "vue";
import ImageGrid from "@/components/production/ImageGrid.vue";
import { showPageTitle } from "@/router/index.ts";
import { openOrDownload } from "@/services/file-open.ts";
import { loadData } from "@/services/load-data.ts";
import { storeImageLinkPath, storeImageLinksPath } from "@/services/production.ts";
import { opensInBrowser, sortFiles } from "@/utils/file-display.ts";

// One of the show's stores, from the shared list (stores FR3): its images in the gallery's
// grid and viewer, from one request for their links (FR6), whichever production is open, as
// stores belong to none (FR2, ADR 0043).

const props = defineProps<{ store: StoreId }>();

type Links = ItemImageLinks["links"];
type State = { status: "loading" } | { status: "error" } | { status: "loaded"; links: Links };

const state = ref<State>({ status: "loading" });
const title = computed(() => storeTitle(props.store));
// Why the last image chosen in the viewer didn't open or download, if it didn't.
const problem = ref<string>();

let loads = 0;

async function load() {
  const asked = ++loads;
  const store = props.store;
  try {
    const answer = await loadData(storeImageLinksPath(store), ItemImageLinks);
    // Another store, or a later look at this one, asked meanwhile: its answer wins.
    if (asked === loads) state.value = { status: "loaded", links: sortFiles(answer?.links ?? []) };
  } catch {
    if (asked === loads) state.value = { status: "error" };
  }
}

watch(
  () => props.store,
  () => {
    showPageTitle(title.value);
    state.value = { status: "loading" };
    problem.value = undefined;
    void load();
  },
  { immediate: true },
);

// From the viewer's Open and Download, as an item's file page does. An image deleted since
// the page loaded says so, and the grid catches up with storage.
async function choose({ name }: { name: string }, download = false) {
  problem.value = undefined;
  const opens = !download && opensInBrowser(name, props.store);
  const path = storeImageLinkPath(props.store, name, { download });
  const chosen = await openOrDownload(name, path, opens);
  problem.value = chosen.problem;
  if (chosen.gone) await load();
}
</script>

<template>
  <h1>{{ title }}</h1>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the store's images.</p>
  <template v-else>
    <p v-if="problem" class="notice" role="alert" data-test="file-problem">{{ problem }}</p>
    <ImageGrid
      v-if="state.links.length > 0"
      :key="store"
      :department="store"
      :links-path="storeImageLinksPath(store)"
      :images="state.links"
      :given-links="state.links"
      :may-remove="false"
      :deleting="false"
      :problem="problem"
      @choose="choose($event)"
      @download="choose($event, true)"
    />
    <p v-else data-test="no-images">The {{ departments[store].name }} store has no images yet.</p>
  </template>
</template>
