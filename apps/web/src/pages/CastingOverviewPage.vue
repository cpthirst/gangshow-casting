<script setup lang="ts">
import { CastList, type CastMember, type Role, RoleList, RunningOrder } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import CastingGrid from "../CastingGrid.vue";
import ClashIcon from "../ClashIcon.vue";
import { CAST_PATH } from "../cast.ts";
import { downloadGridExport } from "../casting-grid-export.ts";
import { type Clash, clashesOfPerson, describeEach, findClashes } from "../clashes.ts";
import HelpButton from "../HelpButton.vue";
import { icons } from "../icons.ts";
import { type LatestShow, latestShow } from "../latest-show.ts";
import {
  biggestParts,
  castBySection,
  gridColumns,
  itemIdsInOrder,
  type PartCounts,
  partsByMember,
  peopleCount,
  roleTotals,
  showByItem,
  sizesHeld,
  spokenParts,
  timelineOf,
} from "../overview.ts";
import ReadOnlyNotice from "../ReadOnlyNotice.vue";
import { ROLES_PATH, roleSizeLabel } from "../roles.ts";
import { RUNNING_ORDER_PATH } from "../running-order.ts";
import ShowByItem from "../ShowByItem.vue";
import ShowTimeline from "../ShowTimeline.vue";
import { apiFetch } from "../sign-in.ts";
import { recordView } from "../usage.ts";
import { downloadCastingSheets, downloadItemOverview } from "../word-export.ts";

const state = ref<
  { status: "loading" } | { status: "error" } | { status: "loaded"; cast: CastMember[] }
>({
  status: "loading",
});

// Loaded separately from the cast: if the casting fails, the cast still shows, without
// counts, and nobody is wrongly marked "No parts yet" (casting-overview FR8).
const parts = ref<Map<number, PartCounts> | "error">();
// How big the show is; none until the roles load, or if they fail.
const totals = ref<ReturnType<typeof roleTotals>>();
// From the same roles and running order, so they fail together: no icons then
// (casting-rules FR9, FR13).
const clashes = ref<Clash[]>([]);
// The show, its roles and everyone's parts in it, for each person's timeline and the By item
// view; none until both load.
const timeline = ref<{
  order: RunningOrder;
  roles: Role[];
  parts: ReturnType<typeof biggestParts>;
}>();

// The Overview's three views of the same cast: by person (default), each item's roles in
// show order, or the grid of items.
const view = ref<"people" | "grid" | "items">("people");
const VIEWS = [
  ["people", "By person"],
  ["items", "By item"],
  ["grid", "Grid"],
] as const;

const halvesByItem = computed(() =>
  timeline.value && state.value.status === "loaded"
    ? showByItem(timeline.value.order, timeline.value.roles, state.value.cast)
    : [],
);

// The grid: a column per item in running order, and the same people in the same order as
// the by-person view, each with their part in every item.
const columnsOfGrid = computed(() => (timeline.value ? gridColumns(timeline.value.order) : []));
const gridRows = computed(() =>
  sections.value.flatMap((section) =>
    section.people.map(({ member, halves, clashLines }) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      section: section.label,
      clashLines,
      slots: halves?.flat() ?? [],
    })),
  ),
);

// The grid as shown goes to the server, which makes the Excel file (ADR 0019), for every
// role (ADR 0021).
const exporting = ref(false);
const exportFailed = ref(false);
/** Screen-reader announcement of a finished export. */
const exportAnnouncement = ref("");
// A disabled button drops keyboard focus, so it is put back once the export is over.
const exportButton = ref<HTMLButtonElement>();

async function exportGrid() {
  const order = timeline.value?.order;
  if (!order || exporting.value) return;
  exporting.value = true;
  exportAnnouncement.value = "";
  exportFailed.value = !(await downloadGridExport(
    order.title,
    columnsOfGrid.value,
    gridRows.value,
  ));
  if (!exportFailed.value) exportAnnouncement.value = "Casting grid exported.";
  exporting.value = false;
  await nextTick();
  exportButton.value?.focus();
}

// The Word exports are built in the browser for every role (ADR 0022), each from its view,
// with the casting as saved at that moment (casting-overview-by-item FR15). One shows at a
// time, beside the view switch, once its view has something to export: always "Export to
// Word", making that view's document.
const wordExportFailure = ref("");
const wordExportButton = ref<HTMLButtonElement>();

const wordExport = computed(() => {
  if (view.value === "items" && halvesByItem.value.some((half) => half.items.length > 0)) {
    return {
      done: "Item overview exported.",
      failure: "Couldn't export the item overview. Try again.",
      download: ({ order, roles, cast }: LatestShow) =>
        downloadItemOverview(order.title, showByItem(order, roles, cast)),
    };
  }
  if (view.value === "people" && sections.value.length > 0) {
    return {
      done: "Casting sheets exported.",
      failure: "Couldn't export the casting sheets. Try again.",
      download: downloadCastingSheets,
    };
  }
  return undefined;
});

// A failure belongs to the view it happened on: moving away forgets it.
watch(view, () => {
  wordExportFailure.value = "";
});

// Each switch is a use of that view; the one the page opens on isn't (usage-tracking FR2).
const VIEW_USES = { people: "by-person", items: "by-item", grid: "grid" } as const;
watch(view, (shown) => recordView(VIEW_USES[shown]));

async function exportWord() {
  const action = wordExport.value;
  if (!action || exporting.value) return;
  exporting.value = true;
  exportAnnouncement.value = "";
  wordExportFailure.value = "";
  const saved = await latestShow().then(action.download, () => false);
  if (saved) exportAnnouncement.value = action.done;
  else wordExportFailure.value = action.failure;
  exporting.value = false;
  await nextTick();
  wordExportButton.value?.focus();
}

// Beside the view switch, on the grid, once there is a grid to export.
const canExport = computed(
  () => view.value === "grid" && sections.value.length > 0 && columnsOfGrid.value.length > 0,
);

// Each person carries their part counts: undefined while loading or unavailable, or
// when they have no parts in the show.
const sections = computed(() => {
  if (state.value.status !== "loaded") return [];
  const counts = parts.value instanceof Map ? parts.value : undefined;
  return castBySection(state.value.cast, counts).map(({ key, label, members }) => ({
    key,
    label,
    people: members.map((member) => ({
      member,
      counts: counts?.get(member.id),
      clashLines: describeEach(clashesOfPerson(clashes.value, member.id)),
      halves: timeline.value
        ? timelineOf(timeline.value.order, timeline.value.parts.get(member.id))
        : undefined,
    })),
  }));
});

// Each loader catches its own errors and shows them, so neither rejects.
onMounted(() => Promise.all([loadCast(), loadParts()]));

async function loadParts() {
  try {
    const [rolesRes, orderRes] = await Promise.all([
      apiFetch(ROLES_PATH),
      apiFetch(RUNNING_ORDER_PATH),
    ]);
    if (!rolesRes.ok) throw new Error(`HTTP ${rolesRes.status}`);
    const roles = RoleList.parse(await rolesRes.json()).roles;
    // No saved running order: no items, so no roles count yet.
    if (orderRes.status === 404) {
      parts.value = partsByMember(roles, new Set());
      totals.value = roleTotals(roles, new Set());
      return;
    }
    if (!orderRes.ok) throw new Error(`HTTP ${orderRes.status}`);
    const order = RunningOrder.parse(await orderRes.json());
    clashes.value = findClashes(order, roles);
    timeline.value = { order, roles, parts: biggestParts(roles) };
    const itemsInShow = itemIdsInOrder(order);
    parts.value = partsByMember(roles, itemsInShow);
    totals.value = roleTotals(roles, itemsInShow);
  } catch {
    parts.value = "error";
    totals.value = undefined;
    clashes.value = [];
    timeline.value = undefined;
  }
}

async function loadCast() {
  try {
    const res = await apiFetch(CAST_PATH);
    // No cast list yet: an empty cast, not an error.
    if (res.status === 404) {
      state.value = { status: "loaded", cast: [] };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", cast: CastList.parse(await res.json()).members };
  } catch {
    // A failed load must never look like an empty cast (casting-overview FR8).
    state.value = { status: "error" };
  }
}
</script>

<template>
  <div class="page-title-row">
    <h1>Overview</h1>
    <HelpButton page="casting-overview" />
  </div>
  <ReadOnlyNotice />
  <p>Everyone in the cast and how much they're cast.</p>
  <p class="visually-hidden" role="status" data-test="announcement">{{ exportAnnouncement }}</p>
  <p v-if="state.status === 'error'" role="alert">Couldn't load the cast.</p>
  <template v-else-if="state.status === 'loaded'">
    <p v-if="parts === 'error'" class="notice" role="alert">Couldn't load the casting.</p>
    <!-- Real text, large: heard as "Lead 12", not an image (casting-overview-grid FR1). -->
    <template v-if="totals">
      <!-- Said out loud too, so the row is clearly roles and not people. Tinted like each
           size's pills on the cards below. -->
      <p id="role-totals-caption" class="role-totals-caption">Roles in the show</p>
      <ul class="role-totals" role="list" aria-labelledby="role-totals-caption">
        <li v-for="{ size, count } in totals" :key="size" :class="['role-total', `role-total-${size}`]" data-test="total">
          {{ roleSizeLabel(size) }} · <span class="role-total-count">{{ count }}</span>
        </li>
      </ul>
    </template>
    <p v-if="sections.length === 0">No cast members yet.</p>
    <template v-else>
    <div class="view-bar">
      <div class="view-switch" role="group" aria-label="Choose how to see the cast">
        <button
          v-for="choice in VIEWS"
          :key="choice[0]"
          type="button"
          :aria-pressed="view === choice[0]"
          @click="view = choice[0]">
          {{ choice[1] }}
        </button>
      </div>
      <!-- Shaped like the switch's buttons but outside its group: it's an action, not a view. -->
      <button
        v-if="canExport"
        ref="exportButton"
        type="button"
        class="grid-export-button"
        :disabled="exporting"
        @click="exportGrid">
        <FontAwesomeIcon :icon="icons.exportFile" />
        Export to Excel
      </button>
      <button
        v-if="wordExport"
        ref="wordExportButton"
        type="button"
        class="word-export-button"
        :disabled="exporting"
        @click="exportWord">
        <FontAwesomeIcon :icon="icons.exportWord" />
        Export to Word
      </button>
    </div>
    <p v-if="wordExportFailure" class="notice word-export-error" role="alert">
      {{ wordExportFailure }}
    </p>
    <template v-if="view === 'grid'">
      <template v-if="columnsOfGrid.length > 0">
        <p v-if="exportFailed" class="notice grid-export-error" role="alert">
          Couldn't export the grid. Try again.
        </p>
        <CastingGrid :columns="columnsOfGrid" :rows="gridRows" />
      </template>
      <p v-else-if="parts === 'error'">Couldn't load the grid.</p>
      <p v-else-if="parts instanceof Map">No items in the running order yet.</p>
    </template>
    <!-- As on the grid, the error and empty messages follow the casting's load (parts). -->
    <div v-else-if="view === 'items'" data-test="by-item">
      <ShowByItem v-if="halvesByItem.some((half) => half.items.length > 0)" :halves="halvesByItem" :clashes="clashes" />
      <p v-else-if="parts === 'error'">Couldn't load the items.</p>
      <p v-else-if="parts instanceof Map">No items in the running order yet.</p>
    </div>
    <template v-else>
    <section v-for="section in sections" :key="section.key" class="overview-section">
      <h2 :id="`section-${section.key}`">
        <span class="section-name">{{ section.label }}</span>
        <!-- A real space, so a screen reader hears "Scouts 3 people", not one word. -->
        {{ " " }}
        <span class="section-count">{{ peopleCount(section.people.length) }}</span>
      </h2>
      <!-- Cards like an item's role cards (casting-overview UI consistency). An explicit
           list role: Safari drops list semantics once bullets are styled away. -->
      <ul class="role-cards" role="list" :aria-labelledby="`section-${section.key}`">
        <li v-for="{ member, counts, clashLines, halves } in section.people" :key="member.id" class="role-card" data-test="person">
          <!-- Name and clash icon together, so the icon stays beside the name, as on an
               item's page, with any written-out clashes beneath. -->
          <span class="person-who">
            <span class="person-name role-name">{{ member.firstName }} {{ member.lastName }}</span>
            <ClashIcon :lines="clashLines" />
          </span>
          <template v-if="counts">
            <!-- Seen as pills; heard as "1 lead, 3 ensemble". -->
            <span class="person-parts" aria-hidden="true">
              <span
                v-for="{ size, count } in sizesHeld(counts)"
                :key="size"
                :class="['pill', `pill-${size}`]"
                data-test="size">
                {{ roleSizeLabel(size) }} · {{ count }}
              </span>
            </span>
            <span class="visually-hidden">{{ spokenParts(counts) }}</span>
          </template>
          <span v-else-if="parts instanceof Map" class="uncast" data-test="no-parts">No parts yet</span>
          <ShowTimeline v-if="halves" :halves="halves" />
        </li>
      </ul>
    </section>
    </template>
    </template>
  </template>
</template>
