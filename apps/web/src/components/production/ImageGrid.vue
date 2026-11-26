<script setup lang="ts">
import {
  departments,
  FILE_LINK_SECONDS,
  type FileDepartment,
  type ItemFile,
  ItemImageLinks,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref, watch } from "vue";
import { loadData } from "@/services/load-data.ts";
import { itemImageLinksPath } from "@/services/production.ts";
import { fileLabel } from "@/utils/file-display.ts";
import { icons } from "@/utils/icons.ts";

// One item's images as square thumbnails, named beneath, each loading only as it nears the
// screen (production-image-gallery FR4, FR6). Every image's link comes from one request, asked
// again once they've lapsed. Choosing one is the page's to handle, as choosing a row is.

const props = defineProps<{ department: FileDepartment; itemId: string; images: ItemFile[] }>();
const emit = defineEmits<{ choose: [image: ItemFile] }>();

// An image asked for a moment before its link lapsed can reach storage after it has.
const LAPSED_MS = (FILE_LINK_SECONDS - 60) * 1000;

const named = computed(() => departments[props.department]);
const links = ref(new Map<string, string>());
// Whether the links have been answered, so a square with none shows the icon, not a gap.
const answered = ref(false);
// Images that won't load with a fresh link: damaged, or gone since the list.
const broken = ref(new Set<string>());
// Images shown already, which keep their link when the others get fresh ones, so the browser
// needn't fetch them again.
const loaded = new Set<string>();
let askedAt = 0;
let asks = 0;
let asking: Promise<void> | undefined;

async function askForLinks() {
  const ask = ++asks;
  askedAt = Date.now();
  try {
    const answer = await loadData(
      itemImageLinksPath(props.department, props.itemId),
      ItemImageLinks,
    );
    // An earlier ask answering late mustn't undo a later one.
    if (ask !== asks) return;
    const linkOf = (name: string, url: string) =>
      loaded.has(name) ? (links.value.get(name) ?? url) : url;
    links.value = new Map(answer?.links.map(({ name, url }) => [name, linkOf(name, url)]));
  } catch {
    // The links already given stay. With none, every square shows the icon, and each image
    // still opens as a row's would.
  }
  answered.value = true;
}

function askAfresh() {
  const ask = askForLinks().finally(() => {
    if (asking === ask) asking = undefined;
  });
  asking = ask;
}

// An image that won't load with a lapsed link gets a fresh one, shared by every image that
// fails meanwhile; one that won't load with a fresh link shows the icon.
async function failed(name: string, event: Event) {
  const tried =
    event.currentTarget instanceof HTMLImageElement
      ? event.currentTarget.getAttribute("src")
      : null;
  // A fresher link is already on the image, which the browser is trying instead.
  if (tried !== links.value.get(name)) return;
  if (asking || Date.now() - askedAt >= LAPSED_MS) {
    if (!asking) askAfresh();
    while (asking) await asking;
    if (links.value.get(name) !== tried) return;
  }
  broken.value.add(name);
}

const urlOf = (name: string) => (broken.value.has(name) ? undefined : links.value.get(name));

// A new image, after an upload, needs a link of its own, which a request already on its way
// for a lapse won't have.
watch(
  () => props.images.map((image) => image.name).join("/"),
  () => {
    broken.value.clear();
    askAfresh();
  },
  { immediate: true },
);
</script>

<template>
  <!-- An explicit list role: Safari drops list semantics once bullets are styled away. -->
  <ul class="thumb-grid" role="list" :aria-label="`${named.name} images`">
    <li v-for="image in images" :key="image.name" data-test="image">
      <button
        type="button"
        class="thumb-open"
        :aria-label="fileLabel(image.name, department)"
        @click="emit('choose', image)"
      >
        <span class="thumb-square">
          <img
            v-if="urlOf(image.name)"
            :src="urlOf(image.name)"
            alt=""
            loading="lazy"
            decoding="async"
            @load="loaded.add(image.name)"
            @error="failed(image.name, $event)"
          />
          <FontAwesomeIcon v-else-if="answered" :icon="icons.imageFile" class="file-icon" />
        </span>
        <span class="thumb-name" data-test="name">{{ image.name }}</span>
      </button>
    </li>
  </ul>
</template>
