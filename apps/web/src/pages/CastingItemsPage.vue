<script setup lang="ts">
import {
  CastList,
  type CastMember,
  ItemNoteList,
  type Role,
  RoleList,
  RunningOrder,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, onMounted, ref } from "vue";
import ClashIcon from "@/components/common/ClashIcon.vue";
import HelpButton from "@/components/common/HelpButton.vue";
import ReadOnlyNotice from "@/components/common/ReadOnlyNotice.vue";
import { apiFetch, canChangeCasting } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { clashesInItem, findClashes, summariseClashes } from "@/utils/clashes.ts";
import { icons } from "@/utils/icons.ts";
import { ITEM_NOTES_PATH } from "@/utils/item-notes.ts";
import { ROLES_PATH, roleCounts, spokenCounts } from "@/utils/roles.ts";
import { RUNNING_ORDER_PATH, runningClock } from "@/utils/running-order.ts";

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; order: RunningOrder };

const state = ref<State>({ status: "loading" });
// Loaded separately: if the roles fail, the items still show, just without counts.
const roles = ref<Role[] | "error">();
// Only needed to name who clashes; if it fails, the counts still show.
const cast = ref<CastMember[] | "error">();
// Each item's notes, by item id (casting-item-overview FR9); cleared notes are left out.
const notes = ref<Map<string, string> | "error">();
const notesOf = (itemId: string) =>
  notes.value instanceof Map ? notes.value.get(itemId) : undefined;

// Clashes need the order and the roles, and the cast to say who (casting-rules FR8, FR13).
const clashes = computed(() =>
  state.value.status === "loaded" && Array.isArray(roles.value) && Array.isArray(cast.value)
    ? findClashes(state.value.order, roles.value)
    : [],
);

/** An item's clashes as one summed-up line, for its icon. */
function clashLines(itemId: string) {
  const theirs = clashesInItem(clashes.value, itemId);
  const [worst] = theirs;
  // There are clashes only once the cast has loaded; checked again to name them.
  if (!worst || !Array.isArray(cast.value)) return [];
  return [{ severity: worst.severity, text: summariseClashes(theirs, cast.value) }];
}

// Numbers come from the running clock, so they always match the Running order page. Each
// row also carries its role counts: undefined while the roles are loading or unavailable.
const halves = computed(() => {
  if (state.value.status !== "loaded") return [];
  const allRoles = Array.isArray(roles.value) ? roles.value : undefined;
  return runningClock(state.value.order).halves.map(({ half, rows }) => ({
    half,
    rows: rows.map((row) => ({
      ...row,
      counts: allRoles ? roleCounts(allRoles, row.item.id) : undefined,
    })),
  }));
});

onMounted(() => Promise.all([loadRunningOrder(), loadRoles(), loadCast(), loadNotes()]));

async function loadNotes() {
  try {
    const res = await apiFetch(ITEM_NOTES_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = ItemNoteList.parse(await res.json()).notes;
    notes.value = new Map(list.filter((n) => n.text !== "").map((n) => [n.itemId, n.text]));
  } catch {
    // The items still show; only their notes are missing.
    notes.value = "error";
  }
}

async function loadCast() {
  try {
    const res = await apiFetch(CAST_PATH);
    // No cast list yet just means nobody can clash.
    if (res.status === 404) {
      cast.value = [];
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cast.value = CastList.parse(await res.json()).members;
  } catch {
    cast.value = "error";
  }
}

async function loadRoles() {
  try {
    const res = await apiFetch(ROLES_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    roles.value = RoleList.parse(await res.json()).roles;
  } catch {
    // Never shown as "No roles yet": that would hide work still to do (PRD FR2).
    roles.value = "error";
  }
}

async function loadRunningOrder() {
  try {
    // The latest saved version: unsaved moves live only on the Running order page (PRD FR1).
    const res = await apiFetch(RUNNING_ORDER_PATH);
    if (res.status === 404) {
      state.value = { status: "empty" };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", order: RunningOrder.parse(await res.json()) };
  } catch {
    // A failed load must never look like "no running order yet" (PRD FR6).
    state.value = { status: "error" };
  }
}
</script>

<template>
  <div class="page-title-row">
    <h1>Items</h1>
    <HelpButton page="casting-items" />
  </div>
  <ReadOnlyNotice />
  <p>The show's items, with how far each one's casting has got.</p>
  <p v-if="state.status === 'empty'">
    There's no saved running order yet. Set one up on the
    <RouterLink :to="{ name: 'running-order' }">Running order page</RouterLink>.
  </p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the items.</p>
  <template v-else-if="state.status === 'loaded'">
    <p class="based-on" data-test="version">Based on Draft {{ state.order.version }}</p>
    <p v-if="roles === 'error'" class="notice" role="alert">Couldn't load the role counts.</p>
    <p v-else-if="cast === 'error'" class="notice" role="alert">
      Couldn't check the casting for clashes.
    </p>
    <p v-if="notes === 'error'" class="notice" role="alert">Couldn't load the notes.</p>
    <section v-for="{ half, rows } in halves" :key="half.id" class="half" :aria-labelledby="half.id">
      <h2 :id="half.id">{{ half.name }}</h2>
      <div class="table-scroll" tabindex="0" role="region" :aria-label="`${half.name} items`">
        <!-- The Running order table, with a Cast button where the moves are. -->
        <table class="running-order items-list" role="table">
          <!-- The same column widths in both halves, so they line up. -->
          <colgroup>
            <col class="col-cast" />
            <col class="col-number" />
            <col />
            <col class="col-counts" />
            <col class="col-minutes" />
          </colgroup>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Cast</th>
              <th scope="col" role="columnheader">#</th>
              <th scope="col" role="columnheader">Item</th>
              <th scope="col" role="columnheader">Roles</th>
              <th scope="col" role="columnheader" class="minutes">Mins</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            <template v-for="{ item, number, counts } in rows" :key="item.id">
              <tr
                role="row"
                data-test="item"
                :data-item-id="item.id"
                :class="{ 'not-printed': number === null }"
              >
                <td class="moves" data-label="Cast" role="cell">
                  <RouterLink
                    class="icon-button"
                    data-test="cast"
                    :to="{ name: 'casting-item', params: { itemId: item.id } }"
                    :aria-label="`${canChangeCasting ? 'Cast' : 'View'} ${item.title}`"
                    :data-tooltip="canChangeCasting ? 'Cast this item' : 'View this item'"
                  >
                    <FontAwesomeIcon :icon="icons.cast" />
                  </RouterLink>
                </td>
                <td data-test="number" class="number" data-label="#" role="cell">
                  <template v-if="number !== null">{{ number }}</template>
                  <span v-else class="badge">Not in printed programme</span>
                </td>
                <td class="title" data-label="Item" role="cell">
                  <span data-test="title">{{ item.title }}</span>
                  <ClashIcon :lines="clashLines(item.id)" />
                </td>
                <!-- Seen as "Roles 5 · Cast 3", heard as "5 roles, 3 cast". Empty while the
                     counts are loading or unavailable. -->
                <td data-test="counts" class="counts" data-label="Roles" role="cell">
                  <template v-if="counts?.total === 0">No roles yet</template>
                  <template v-else-if="counts">
                    <span aria-hidden="true">Roles {{ counts.total }} · Cast {{ counts.cast }}</span>
                    <span class="visually-hidden">{{ spokenCounts(counts) }}</span>
                  </template>
                </td>
                <!-- Left empty when unknown, so the phone card hides the row. -->
                <td data-test="minutes" class="minutes" data-label="Mins" role="cell">
                  <template v-if="item.minutes !== null">{{ item.minutes }}</template>
                </td>
              </tr>
              <!-- The item's notes, in full, across the table under its row (FR9). -->
              <tr
                v-if="notesOf(item.id)"
                role="row"
                class="item-notes-row"
                :class="{ 'not-printed': number === null }"
                data-test="item-notes"
              >
                <td colspan="5" class="item-notes-text" data-label="Notes" role="cell">
                  {{ notesOf(item.id) }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
