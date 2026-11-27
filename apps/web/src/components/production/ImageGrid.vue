<script setup lang="ts">
import {
  type DepartmentId,
  departments,
  FILE_LINK_SECONDS,
  type ItemFile,
  ItemImageLinks,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref, useTemplateRef, watch } from "vue";
import { useImageViewer, type ViewerImage } from "@/composables/useImageViewer.ts";
import { loadData } from "@/services/load-data.ts";
import { fileLabel } from "@/utils/file-display.ts";
import { icons } from "@/utils/icons.ts";
import RemoveFileButton from "./RemoveFileButton.vue";

// An item's or a store's images as square thumbnails, named beneath, each loading only as it
// nears the screen (production-image-gallery FR4, FR6, stores FR6). Every image's link comes
// from one request, asked again once they've lapsed. Choosing one opens the viewer, to swipe
// through the rest (FR8, FR9); one with no link to show it by is the page's to open, as a row
// is. Opening or downloading from the viewer (FR10), and removing one (FR7), are the page's to
// handle too.

type Image = Pick<ItemFile, "name">;

const props = defineProps<{
  department: DepartmentId;
  /** Where to ask for a link to each image, from one request. */
  linksPath: string;
  images: readonly Image[];
  /** Links already in hand, from the request that listed the images, so the grid asks for
   *  fresh ones only once these lapse. */
  givenLinks?: ItemImageLinks["links"];
  /** Whoever may change the page gets a trash icon on each thumbnail. */
  mayRemove: boolean;
  /** A delete is on its way, so the trash icons wait for it. */
  deleting: boolean;
  /** Why the last file chosen didn't open or download, which the viewer says while it's open. */
  problem: string | undefined;
}>();
const emit = defineEmits<{
  choose: [image: Image];
  download: [image: Image];
  remove: [image: Image, event: MouseEvent];
}>();

// An image asked for a moment before its link lapsed can reach storage after it has.
const LAPSED_MS = (FILE_LINK_SECONDS - 60) * 1000;

const named = computed(() => departments[props.department]);
const grid = useTemplateRef("grid");
const imageNamed = (name: string) => props.images.find((image) => image.name === name);
// The viewer's Open and Download are a row's, for the image shown.
const viewer = useImageViewer(() => `${named.value.name} images`, {
  open(name) {
    const image = imageNamed(name);
    if (image) emit("choose", image);
  },
  download(name) {
    const image = imageNamed(name);
    if (image) emit("download", image);
  },
});
watch(
  () => props.problem,
  (problem) => viewer.say(problem),
);
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

// Starts an ask for links, which are fresh from now.
function beginAsk() {
  askedAt = Date.now();
  return ++asks;
}

// Takes the links an ask got, unless a later ask has begun since: an earlier ask answering
// late mustn't undo a later one. Images already shown keep their links.
function answerWith(ask: number, given: ItemImageLinks["links"] = []) {
  answered.value = true;
  if (ask !== asks) return;
  const linkOf = (name: string, url: string) =>
    loaded.has(name) ? (links.value.get(name) ?? url) : url;
  links.value = new Map(given.map(({ name, url }) => [name, linkOf(name, url)]));
}

async function askForLinks() {
  const ask = beginAsk();
  try {
    answerWith(ask, (await loadData(props.linksPath, ItemImageLinks))?.links);
  } catch {
    // The links already given stay. With none, every square shows the icon, and each image
    // still opens as a row's would.
    answered.value = true;
  }
}

function askAfresh() {
  const ask = askForLinks().finally(() => {
    if (asking === ask) asking = undefined;
  });
  asking = ask;
}

// Links that haven't lapsed: fresh ones if they have, shared with whatever else asks meanwhile.
async function freshLinks() {
  if (!asking && Date.now() - askedAt < LAPSED_MS) return;
  if (!asking) askAfresh();
  while (asking) await asking;
}

// An image that won't load with a lapsed link gets a fresh one; one that won't load with a
// fresh link shows the icon.
async function failed(name: string, event: Event) {
  const tried =
    event.currentTarget instanceof HTMLImageElement
      ? event.currentTarget.getAttribute("src")
      : null;
  // A fresher link is already on the image, which the browser is trying instead.
  if (tried !== links.value.get(name)) return;
  await freshLinks();
  if (links.value.get(name) === tried) broken.value.add(name);
}

const urlOf = (name: string) => (broken.value.has(name) ? undefined : links.value.get(name));

async function view(image: Image) {
  if (urlOf(image.name)) await freshLinks();
  const shown = viewable();
  const index = shown.findIndex(({ name }) => name === image.name);
  if (index < 0) {
    emit("choose", image);
    return;
  }
  try {
    await viewer.open(shown, index);
  } catch {
    // Its code wouldn't load, as when a release replaces it while the page is open.
    emit("choose", image);
  }
}

// The images with a link to show them by, each sized from its thumbnail if that has loaded.
function viewable(): ViewerImage[] {
  const thumbnails = grid.value?.querySelectorAll<HTMLElement>(".thumb-open") ?? [];
  return props.images.flatMap(({ name }, at) => {
    const src = urlOf(name);
    const thumbnail = thumbnails[at];
    if (!src || !thumbnail) return [];
    const img = thumbnail.querySelector("img");
    return [
      { name, src, width: img?.naturalWidth ?? 0, height: img?.naturalHeight ?? 0, thumbnail },
    ];
  });
}

// A new image, after an upload, needs a link of its own: one given with it, or a fresh ask,
// as a request already on its way for a lapse won't have it. The viewer closes, as what it
// shows may have gone.
watch(
  () => props.images.map((image) => image.name).join("/"),
  () => {
    viewer.close();
    broken.value.clear();
    // Links given with the images are as good as an answer just now.
    if (props.givenLinks) answerWith(beginAsk(), props.givenLinks);
    else askAfresh();
  },
  { immediate: true },
);
</script>

<template>
  <!-- An explicit list role: Safari drops list semantics once bullets are styled away. -->
  <ul ref="grid" class="thumb-grid" role="list" :aria-label="`${named.name} images`">
    <li v-for="image in images" :key="image.name" data-test="image">
      <!-- First, as a row's is, though it sits in the square's corner: beside what opens the
           image rather than in it, so choosing one never does the other. -->
      <RemoveFileButton
        v-if="mayRemove"
        class="thumb-remove"
        :name="image.name"
        :disabled="deleting"
        @remove="emit('remove', image, $event)"
      />
      <button
        type="button"
        class="thumb-open"
        :aria-label="urlOf(image.name) ? `View ${image.name}` : fileLabel(image.name, department)"
        @click="view(image)"
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
