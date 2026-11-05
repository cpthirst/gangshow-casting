<script setup lang="ts">
import {
  channelsKeptAgainstTheRule,
  type FileDepartment,
  fileDepartments,
  type ItemMicPlot,
  ItemNoteList,
  MicPlotList,
  PropList,
  RunningOrder,
  SceneryFileCounts,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import ClashIcon from "@/components/common/ClashIcon.vue";
import HelpButton from "@/components/common/HelpButton.vue";
import { latestPropsList } from "@/services/latest-show.ts";
import { apiFetch, canChange } from "@/services/sign-in.ts";
import { recordExport } from "@/services/usage.ts";
import { downloadPropsList } from "@/services/word-export.ts";
import {
  type DepartmentCount,
  type DepartmentPage,
  departmentPages,
  filesCount,
} from "@/utils/departments.ts";
import { icons } from "@/utils/icons.ts";
import { departmentNotesPath, fileCountsPath } from "@/utils/item-files.ts";
import {
  keptMicsSummary,
  MIC_PLOT_NOTES_PATH,
  MIC_PLOT_PATH,
  micsCount,
} from "@/utils/mic-plot.ts";
import { PROPS_PATH, propCounts, propsCount } from "@/utils/props.ts";
import { PROPS_NOTES_PATH } from "@/utils/props-notes.ts";
import { RUNNING_ORDER_PATH, runningClock } from "@/utils/running-order.ts";

// Production's one page: the show's items, each with a button for every department's page
// for it and a count for each department (production-overview FR4–FR8, FR10, FR14), laid out
// as the casting Items list.

const route = useRoute();

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; order: RunningOrder };

const state = ref<State>({ status: "loading" });
// Each loaded separately: if one fails, the items still show, just without its counts.
type Counts = ((itemId: string) => number) | "error";
const propsCountOf = ref<Counts>();
// Every item's channels given out (production-mics FR12).
const micPlots = ref<ItemMicPlot[] | "error">();
const micsCountOf = computed<Counts | undefined>(() => {
  const plots = micPlots.value;
  if (plots === undefined || plots === "error") return plots;
  return (itemId) => plots.find((plot) => plot.itemId === itemId)?.mics.length ?? 0;
});
// Each department with files, by its key: how many files each item has.
const fileCountsOf = ref<Partial<Record<FileDepartment, Counts>>>({});
const isFileDepartment = (path: string): path is FileDepartment =>
  fileDepartments.some((department) => department === path);
// The departments whose file counts couldn't be loaded, as their counts' alerts name them.
const fileCountsFailed = computed(() =>
  departmentPages.filter(
    ({ path }) => isFileDepartment(path) && fileCountsOf.value[path] === "error",
  ),
);

// Each item's notes for each department, by item id (production-props FR14,
// production-sfx-wardrobe FR11, production-mics FR13); cleared notes are left out. Shown
// under the item in this order: Scenery, Props, SFX, Mic plot, Wardrobe.
type Notes = Map<string, string> | "error";
const noteKinds = [
  { key: "scenery", label: "Scenery notes", path: departmentNotesPath("scenery") },
  { key: "props", label: "Props notes", path: PROPS_NOTES_PATH },
  { key: "sfx", label: "SFX notes", path: departmentNotesPath("sfx") },
  { key: "mic-plot", label: "Mic plot notes", path: MIC_PLOT_NOTES_PATH },
  { key: "wardrobe", label: "Wardrobe notes", path: departmentNotesPath("wardrobe") },
];
const notesOf = ref<Record<string, Notes>>({});
const notesFailed = computed(() => Object.values(notesOf.value).includes("error"));

function notesUnder(itemId: string) {
  return noteKinds.flatMap(({ key, label }) => {
    const notes = notesOf.value[key];
    const text = notes instanceof Map ? notes.get(itemId) : undefined;
    return text ? [{ key, label, text }] : [];
  });
}

// Numbers come from the running clock, so they always match the Running order page.
const halves = computed(() =>
  state.value.status === "loaded" ? runningClock(state.value.order).halves : [],
);

/** A department's count for the item; none while its counts are loading or unavailable, so a
 *  count that couldn't be loaded never reads as 0. */
function countFor(department: DepartmentPage, itemId: string): DepartmentCount | undefined {
  const { path, noun } = department;
  if (isFileDepartment(path)) {
    return shownCount(fileCountsOf.value[path], (files) => filesCount(files, noun), itemId);
  }
  if (path === "props") return shownCount(propsCountOf.value, propsCount, itemId);
  return shownCount(micsCountOf.value, micsCount, itemId);
}

/** The Error icon's line for an item's channels kept against the rule after a reorder
 *  (production-mics FR10); none for an item without any, or while the plots are loading or
 *  unavailable. */
function keptMicLines(itemId: string) {
  const plots = micPlots.value;
  if (state.value.status !== "loaded" || plots === undefined || plots === "error") return [];
  return keptMicsSummary(channelsKeptAgainstTheRule(state.value.order, plots, itemId));
}

const shownCount = (
  counts: Counts | undefined,
  inWords: (count: number) => DepartmentCount,
  itemId: string,
) => (typeof counts === "function" ? inWords(counts(itemId)) : undefined);

// The props list in Word, for every role, built in the browser with everything as saved at
// that moment (production-props FR22, FR23; ADR 0022).
const generating = ref(false);
const generateFailed = ref(false);
/** Screen-reader announcement of a finished list. */
const announcement = ref("");
// A disabled button drops keyboard focus, so it is put back once the list is made.
const generateButton = ref<HTMLButtonElement>();

async function generatePropsList() {
  if (generating.value) return;
  generating.value = true;
  announcement.value = "";
  generateFailed.value = false;
  let saved = false;
  try {
    const { title, halves } = await latestPropsList();
    saved = await downloadPropsList(title, halves);
  } catch {
    // Something it needs couldn't be loaded: said below, as for a file that couldn't be made.
  }
  generateFailed.value = !saved;
  if (saved) {
    announcement.value = "Props list generated.";
    recordExport("word-props-list");
  }
  generating.value = false;
  await nextTick();
  generateButton.value?.focus();
}

onMounted(() => {
  loadRunningOrder();
  loadProps();
  loadMicPlots();
  for (const department of fileDepartments) {
    loadFileCounts(department).then((counts) => {
      fileCountsOf.value = { ...fileCountsOf.value, [department]: counts };
    });
  }
  for (const { key, path } of noteKinds) {
    loadNotes(path).then((notes) => {
      notesOf.value = { ...notesOf.value, [key]: notes };
    });
  }
});

async function loadNotes(path: string): Promise<Notes> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = ItemNoteList.parse(await res.json()).notes;
    return new Map(list.filter((n) => n.text !== "").map((n) => [n.itemId, n.text]));
  } catch {
    // The items still show; only these notes are missing.
    return "error";
  }
}

async function loadProps() {
  try {
    const res = await apiFetch(PROPS_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    propsCountOf.value = propCounts(PropList.parse(await res.json()).props);
  } catch {
    propsCountOf.value = "error";
  }
}

async function loadMicPlots() {
  try {
    const res = await apiFetch(MIC_PLOT_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    micPlots.value = MicPlotList.parse(await res.json()).items;
  } catch {
    micPlots.value = "error";
  }
}

// From file storage on every visit, so a file added there is counted (FR14).
async function loadFileCounts(department: FileDepartment): Promise<Counts> {
  try {
    const res = await apiFetch(fileCountsPath(department));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { counts } = SceneryFileCounts.parse(await res.json());
    return (itemId) => counts[itemId] ?? 0;
  } catch {
    return "error";
  }
}

async function loadRunningOrder() {
  try {
    // The latest saved version, as on the casting Items list.
    const res = await apiFetch(RUNNING_ORDER_PATH);
    if (res.status === 404) {
      state.value = { status: "empty" };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", order: RunningOrder.parse(await res.json()) };
  } catch {
    // A failed load must never look like "no running order yet".
    state.value = { status: "error" };
  }
}
</script>

<template>
  <div class="page-title-row">
    <h1>Overview</h1>
    <HelpButton page="production-overview" />
  </div>
  <p>{{ route.meta.description }}</p>
  <p class="visually-hidden" role="status" data-test="announcement">{{ announcement }}</p>
  <p v-if="state.status === 'empty'">
    There's no saved running order yet. Set one up on the
    <RouterLink :to="{ name: 'running-order' }">Running order page</RouterLink>.
  </p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the items.</p>
  <template v-else-if="state.status === 'loaded'">
    <p class="based-on" data-test="version">Based on Draft {{ state.order.version }}</p>
    <div class="view-bar">
      <button
        ref="generateButton"
        type="button"
        class="word-export-button"
        :disabled="generating"
        @click="generatePropsList">
        <FontAwesomeIcon :icon="icons.exportWord" />
        Generate Props List
      </button>
    </div>
    <p v-if="generateFailed" class="notice word-export-error" role="alert">
      Couldn't generate the props list. Try again.
    </p>
    <p v-if="propsCountOf === 'error'" class="notice" role="alert">
      Couldn't load the props counts.
    </p>
    <p v-if="micPlots === 'error'" class="notice" role="alert">
      Couldn't load the mic plot counts.
    </p>
    <p v-for="{ path, noun } in fileCountsFailed" :key="path" class="notice" role="alert">
      Couldn't load the {{ noun }} counts.
    </p>
    <p v-if="notesFailed" class="notice" role="alert">Couldn't load the notes.</p>
    <section v-for="{ half, rows } in halves" :key="half.id" class="half" :aria-labelledby="half.id">
      <h2 :id="half.id">{{ half.name }}</h2>
      <div class="table-scroll" tabindex="0" role="region" :aria-label="`${half.name} items`">
        <table class="running-order items-list" role="table">
          <!-- The same column widths in both halves, so they line up. -->
          <colgroup>
            <col class="col-departments" />
            <col class="col-number narrow" />
            <col />
            <col v-for="department in departmentPages" :key="department.path" class="col-count" />
          </colgroup>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Open</th>
              <th scope="col" role="columnheader">#</th>
              <th scope="col" role="columnheader">Item</th>
              <th
                v-for="department in departmentPages"
                :key="department.path"
                class="count"
                scope="col"
                role="columnheader"
              >
                {{ department.name }}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            <template v-for="{ item, number } in rows" :key="item.id">
              <tr
                role="row"
                data-test="item"
                :data-item-id="item.id"
                :class="{ 'not-printed': number === null }"
              >
                <td class="moves" data-label="Open" role="cell">
                  <!-- Each says whether it edits or views, by the department's permission. -->
                  <RouterLink
                    v-for="department in departmentPages"
                    :key="department.route"
                    class="icon-button"
                    :data-test="`open-${department.path}`"
                    :to="{ name: department.route, params: { itemId: item.id } }"
                    :aria-label="`${canChange(department.permissions) ? 'Edit' : 'View'} ${department.noun} for ${item.title}`"
                    :data-tooltip="department.name"
                  >
                    <FontAwesomeIcon :icon="department.icon" />
                  </RouterLink>
                </td>
                <td data-test="number" class="number" data-label="#" role="cell">
                  <template v-if="number !== null">{{ number }}</template>
                  <span v-else class="badge">Not in printed programme</span>
                </td>
                <td class="title" data-label="Item" role="cell">
                  <span data-test="title">{{ item.title }}</span>
                  <!-- Beside the title, as the Items list's clash icon is. -->
                  <ClashIcon :lines="keptMicLines(item.id)" />
                </td>
                <!-- Each count's number and word are hidden from screen readers, which hear them
                     as one phrase instead ("9 scenery files"). -->
                <td
                  v-for="department in departmentPages"
                  :key="department.path"
                  data-test="count"
                  :data-department="department.path"
                  class="count"
                  :data-label="department.name"
                  role="cell"
                >
                  <template v-for="count in [countFor(department, item.id)]" :key="item.id">
                    <template v-if="count">
                      <span class="count-number" data-test="count-number" aria-hidden="true">{{
                        count.number
                      }}</span>
                      <span class="count-word" data-test="count-word" aria-hidden="true">{{
                        count.word
                      }}</span>
                      <span class="visually-hidden">{{ count.label }}</span>
                    </template>
                  </template>
                </td>
              </tr>
              <!-- The item's notes, in full, across the table under its row (FR14). -->
              <tr
                v-for="note in notesUnder(item.id)"
                :key="note.key"
                role="row"
                class="item-notes-row"
                :class="{ 'not-printed': number === null }"
                :data-test="`${note.key}-notes`"
              >
                <!-- Across every column: Open, #, Item and each department's count. -->
                <td
                  :colspan="3 + departmentPages.length"
                  class="item-notes-text" :data-label="note.label" role="cell">
                  {{ note.text }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
