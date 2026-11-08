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
import ClashIcon from "@/components/common/ClashIcon.vue";
import DraftNumber from "@/components/common/DraftNumber.vue";
import PageTitle from "@/components/common/PageTitle.vue";
import { downloadMicPlot } from "@/services/excel-export.ts";
import { latestMicPlot, latestPropsList } from "@/services/latest-show.ts";
import { loadData, loadRequired } from "@/services/load-data.ts";
import { canChange } from "@/services/sign-in.ts";
import { recordExport } from "@/services/usage.ts";
import { downloadPropsList } from "@/services/word-export.ts";
import {
  type DepartmentCount,
  type DepartmentPage,
  departmentPages,
  filesCount,
  listed,
} from "@/utils/departments.ts";
import { icons } from "@/utils/icons.ts";
import { fileCountsPath } from "@/utils/item-files.ts";
import { departmentNotesPath } from "@/utils/item-notes.ts";
import { keptMicsSummary, MIC_PLOT_PATH, micsCount } from "@/utils/mic-plot.ts";
import { PROPS_PATH, propCounts, propsCount } from "@/utils/props.ts";
import { RUNNING_ORDER_PATH, runningClock } from "@/utils/running-order.ts";

// Production's one page: the show's items, each with a button for every department's page
// for it and a count for each department (production-overview FR4–FR8, FR10, FR14), laid out
// as the casting Items list.

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

// Each item's notes for each department, by item id (production-props FR14,
// production-sfx-wardrobe FR11, production-mics FR13); cleared notes are left out. Shown
// under the item in the departments' order.
type Notes = Map<string, string> | "error";
const noteKinds = departmentPages.map(({ id, name }) => ({
  key: id,
  label: `${name} notes`,
  path: departmentNotesPath(id),
}));
const notesOf = ref<Record<string, Notes>>({});
const notesFailed = computed(() => Object.values(notesOf.value).includes("error"));

/** Whether a department's counts couldn't be loaded. */
function countsFailed(id: DepartmentPage["id"]) {
  switch (id) {
    case "scenery":
    case "sfx":
    case "wardrobe":
      return fileCountsOf.value[id] === "error";
    case "props":
      return propsCountOf.value === "error";
    case "mic-plot":
      return micPlots.value === "error";
    default:
      return unknownDepartment(id);
  }
}

// Everything that couldn't be loaded, in one alert so failures don't stack up above the show.
const loadFailure = computed(() => {
  const failed = departmentPages
    .filter(({ id }) => countsFailed(id))
    .map(({ noun }) => `the ${noun} counts`);
  if (notesFailed.value) failed.push("the notes");
  return failed.length ? `Couldn't load ${listed(failed)}.` : "";
});

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
  const { id, noun } = department;
  switch (id) {
    case "scenery":
    case "sfx":
    case "wardrobe":
      return shownCount(fileCountsOf.value[id], (files) => filesCount(files, noun), itemId);
    case "props":
      return shownCount(propsCountOf.value, propsCount, itemId);
    case "mic-plot":
      return shownCount(micsCountOf.value, micsCount, itemId);
    default:
      return unknownDepartment(id);
  }
}

/** A department added to the list but not here fails the typecheck, not silently at run time. */
function unknownDepartment(id: never): never {
  throw new Error(`No Overview column for the ${id} department`);
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

// The props list in Word and the mic plot in Excel, for every role, built in the browser with
// everything as saved at that moment (production-props FR22, FR23, production-mics FR14;
// ADR 0022, ADR 0033).
const generators = {
  props: {
    make: async () => {
      const { title, halves } = await latestPropsList();
      return downloadPropsList(title, halves);
    },
    generated: "Props list generated.",
    use: "word-props-list",
  },
  mics: {
    make: async () => downloadMicPlot(await latestMicPlot()),
    generated: "Mic plot generated.",
    use: "excel-mic-plot",
  },
} as const;
type Generated = keyof typeof generators;

/** The file being made, if any: one at a time. */
const generating = ref<Generated>();
const generateFailed = ref<Partial<Record<Generated, boolean>>>({});
/** Screen-reader announcement of a finished file. */
const announcement = ref("");
// A disabled button drops keyboard focus, so it is put back once the file is made.
const propsButton = ref<HTMLButtonElement>();
const micsButton = ref<HTMLButtonElement>();

async function generate(file: Generated) {
  if (generating.value) return;
  const { make, generated, use } = generators[file];
  generating.value = file;
  announcement.value = "";
  generateFailed.value = { ...generateFailed.value, [file]: false };
  let saved = false;
  try {
    saved = await make();
  } catch {
    // Something it needs couldn't be loaded: said below, as for a file that couldn't be made.
  }
  generateFailed.value = { ...generateFailed.value, [file]: !saved };
  if (saved) {
    announcement.value = generated;
    recordExport(use);
  }
  generating.value = undefined;
  await nextTick();
  (file === "props" ? propsButton : micsButton).value?.focus();
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
    const list = await loadRequired(path, ItemNoteList);
    return new Map(list.notes.filter((n) => n.text !== "").map((n) => [n.itemId, n.text]));
  } catch {
    // The items still show; only these notes are missing.
    return "error";
  }
}

async function loadProps() {
  try {
    propsCountOf.value = propCounts((await loadRequired(PROPS_PATH, PropList)).props);
  } catch {
    propsCountOf.value = "error";
  }
}

async function loadMicPlots() {
  try {
    micPlots.value = (await loadRequired(MIC_PLOT_PATH, MicPlotList)).items;
  } catch {
    micPlots.value = "error";
  }
}

// From file storage on every visit, so a file added there is counted (FR14).
async function loadFileCounts(department: FileDepartment): Promise<Counts> {
  try {
    const { counts } = await loadRequired(fileCountsPath(department), SceneryFileCounts);
    return (itemId) => counts[itemId] ?? 0;
  } catch {
    return "error";
  }
}

async function loadRunningOrder() {
  try {
    // The latest saved version, as on the casting Items list.
    const order = await loadData(RUNNING_ORDER_PATH, RunningOrder);
    state.value = order ? { status: "loaded", order } : { status: "empty" };
  } catch {
    // A failed load must never look like "no running order yet".
    state.value = { status: "error" };
  }
}
</script>

<template>
  <PageTitle title="Overview" help="production-overview" />
  <p class="visually-hidden" role="status" data-test="announcement">{{ announcement }}</p>
  <p v-if="state.status === 'empty'">
    There's no saved running order yet. Set one up on the
    <RouterLink :to="{ name: 'running-order' }">Running order page</RouterLink>.
  </p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the items.</p>
  <template v-else-if="state.status === 'loaded'">
    <DraftNumber :version="state.order.version" />
    <div class="view-bar">
      <button
        ref="propsButton"
        type="button"
        class="word-export-button"
        :disabled="generating !== undefined"
        @click="generate('props')">
        <FontAwesomeIcon :icon="icons.exportWord" />
        Generate Props List
      </button>
      <button
        ref="micsButton"
        type="button"
        class="grid-export-button"
        :disabled="generating !== undefined"
        @click="generate('mics')">
        <FontAwesomeIcon :icon="icons.exportFile" />
        Generate Mic Plot
      </button>
    </div>
    <p v-if="generateFailed.props" class="notice word-export-error" role="alert">
      Couldn't generate the props list. Try again.
    </p>
    <p v-if="generateFailed.mics" class="notice mic-plot-export-error" role="alert">
      Couldn't generate the mic plot. Try again.
    </p>
    <p v-if="loadFailure" class="notice" role="alert">{{ loadFailure }}</p>
    <section v-for="{ half, rows } in halves" :key="half.id" class="half" :aria-labelledby="half.id">
      <h2 :id="half.id">{{ half.name }}</h2>
      <div class="table-scroll" tabindex="0" role="region" :aria-label="`${half.name} items`">
        <table class="items-table items-list" role="table">
          <!-- The same column widths in both halves, so they line up. -->
          <colgroup>
            <col class="col-departments" />
            <col class="col-number narrow" />
            <col />
            <col v-for="department in departmentPages" :key="department.id" class="col-count" />
          </colgroup>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Open</th>
              <th scope="col" role="columnheader">#</th>
              <th scope="col" role="columnheader">Item</th>
              <th
                v-for="department in departmentPages"
                :key="department.id"
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
                <td class="icon-column" data-label="Open" role="cell">
                  <!-- Each says whether it edits or views, by the department's permission. -->
                  <RouterLink
                    v-for="department in departmentPages"
                    :key="department.route"
                    class="icon-button"
                    :data-test="`open-${department.id}`"
                    :to="{ name: department.route, params: { itemId: item.id } }"
                    :aria-label="`${canChange(department.id) ? 'Edit' : 'View'} ${department.noun} for ${item.title}`"
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
                  :key="department.id"
                  data-test="count"
                  :data-department="department.id"
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
