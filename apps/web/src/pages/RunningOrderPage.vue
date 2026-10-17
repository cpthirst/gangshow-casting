<script setup lang="ts">
import { RunningOrder, type RunningOrderItem } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { icons } from "../icons.ts";
import {
  dropItem,
  formatTime,
  locate,
  type Move,
  moveItem,
  RUNNING_ORDER_PATH,
  replaceItem,
  runningClock,
  sameContent,
  stageLabel,
  updateOf,
} from "../running-order.ts";
import { apiFetch } from "../sign-in.ts";
import { type RowDrop, vSortableRows } from "../sortable-rows.ts";
import ItemEditor from "./ItemEditor.vue";

// Moves change the working copy only; "Save as Draft N+1" turns it into the next
// saved version, and "Reset" goes back to the saved one (PRD FR6).
type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; saved: RunningOrder; working: RunningOrder };

const state = ref<State>({ status: "loading" });

const loaded = computed(() => {
  if (state.value.status !== "loaded") return undefined;
  const { saved, working } = state.value;
  return { saved, working, clock: runningClock(working), unsaved: !sameContent(saved, working) };
});

const showSaved = (order: RunningOrder) => {
  state.value = { status: "loaded", saved: order, working: order };
};

async function load() {
  try {
    const res = await apiFetch(RUNNING_ORDER_PATH);
    if (res.status === 404) {
      state.value = { status: "empty" };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showSaved(RunningOrder.parse(await res.json()));
  } catch {
    state.value = { status: "error" };
  }
}

/** Screen-reader announcement of the last move, save or reset. */
const announcement = ref("");
/** Visible message about a conflict or failed save. */
const notice = ref("");
/** True while a save is in flight: everything that would change the page waits. */
const saving = ref(false);
/** The item whose edit form is open, if any. One at a time; other changes wait. */
const editingId = ref<string | null>(null);
const busy = computed(() => saving.value || editingId.value !== null);

async function move(itemId: string, direction: Move) {
  if (state.value.status !== "loaded" || busy.value) return;
  const moved = moveItem(state.value.working, itemId, direction);
  if (!moved) return;
  changeWorking(moved, itemId);
  await nextTick();
  refocus(itemId, direction);
}

function drop({ itemId, toHalf, toIndex }: RowDrop) {
  if (state.value.status !== "loaded" || busy.value) return;
  const { working } = state.value;
  const dropped = dropItem(working, itemId, toHalf, toIndex);
  if (!sameContent(dropped, working)) changeWorking(dropped, itemId);
}

function startEdit(itemId: string) {
  if (busy.value) return;
  editingId.value = itemId;
}

// An applied edit is an unsaved change, like a move (PRD FR6).
async function applyEdit(edited: RunningOrderItem) {
  if (state.value.status !== "loaded") return;
  const { working } = state.value;
  const changed = replaceItem(working, edited);
  if (!sameContent(changed, working)) {
    state.value = { ...state.value, working: changed };
    notice.value = "";
    announcement.value = `${edited.title} updated. Not saved yet.`;
  }
  await endEdit(edited.id);
}

async function endEdit(itemId: string) {
  editingId.value = null;
  await nextTick();
  document
    .querySelector<HTMLButtonElement>(`[data-item-id="${CSS.escape(itemId)}"] [data-edit]`)
    ?.focus();
}

// Moves and drags both change only the working copy, until Save.
function changeWorking(changed: RunningOrder, itemId: string) {
  // Callers have already checked; this narrows the type.
  if (state.value.status !== "loaded") return;
  const before = state.value.working;
  state.value = { ...state.value, working: changed };
  notice.value = "";
  announcement.value = `${describeMove(before, changed, itemId)} Not saved yet.`;
}

async function save() {
  if (state.value.status !== "loaded" || busy.value || !loaded.value?.unsaved) return;
  const { saved, working } = state.value;
  saving.value = true;
  const result = await saveDraft(saved.version, working);
  saving.value = false;

  if (result.outcome === "failed") {
    notice.value = "Couldn't save the draft. Your changes are still here. Try again.";
    announcement.value = notice.value;
    return;
  }
  showSaved(result.order);
  notice.value =
    result.outcome === "conflict"
      ? `Someone else saved a newer draft. Showing the latest (Draft ${result.order.version}). Your unsaved changes were discarded.`
      : "";
  announcement.value = notice.value || `Saved as Draft ${result.order.version}.`;
}

function reset() {
  if (state.value.status !== "loaded" || busy.value) return;
  showSaved(state.value.saved);
  notice.value = "";
  announcement.value = `Changes discarded. Back to Draft ${state.value.saved.version}.`;
}

type SaveResult = { outcome: "saved" | "conflict"; order: RunningOrder } | { outcome: "failed" };

// 201 → saved; 409 → someone else saved first (the body is their version); anything else failed.
async function saveDraft(baseVersion: number, working: RunningOrder): Promise<SaveResult> {
  try {
    const res = await apiFetch(`${RUNNING_ORDER_PATH}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseVersion, change: updateOf(working) }),
    });
    if (res.status !== 201 && res.status !== 409) return { outcome: "failed" };
    const order = RunningOrder.parse(await res.json());
    return { outcome: res.status === 201 ? "saved" : "conflict", order };
  } catch {
    return { outcome: "failed" };
  }
}

// Unsaved changes live only in this page, so ask before they're thrown away.
onBeforeRouteLeave(() => !loaded.value?.unsaved || window.confirm("Discard unsaved changes?"));

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (loaded.value?.unsaved) event.preventDefault();
}

onMounted(() => {
  window.addEventListener("beforeunload", warnBeforeUnload);
  load();
});
onUnmounted(() => window.removeEventListener("beforeunload", warnBeforeUnload));

function describeMove(before: RunningOrder, after: RunningOrder, itemId: string) {
  const from = locate(before, itemId);
  const to = locate(after, itemId);
  if (!to) return "";
  const { title } = to.item;
  return from?.half.id === to.half.id
    ? `${title} moved to position ${to.position}.`
    : `${title} moved to the ${to.half.name.toLowerCase()}, position ${to.position}.`;
}

const otherHalf = (halfIndex: number) => (halfIndex === 0 ? "second" : "first");

// The row moves in the DOM, so put focus back on the same button, or another
// move button in that row if the same move is no longer possible.
function refocus(itemId: string, direction: Move) {
  const row = document.querySelector(`[data-item-id="${CSS.escape(itemId)}"]`);
  const button =
    row?.querySelector<HTMLButtonElement>(`[data-move="${direction}"]:not(:disabled)`) ??
    row?.querySelector<HTMLButtonElement>("[data-move]:not(:disabled)");
  button?.focus();
}
</script>

<template>
  <h1>Running order</h1>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'empty'">No running order yet.</p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the running order.</p>
  <template v-else-if="loaded">
    <div class="draft-bar">
      <p class="version">Draft {{ loaded.saved.version }}</p>
      <p v-if="loaded.unsaved" class="unsaved" data-test="unsaved">Unsaved changes</p>
      <button
        type="button"
        class="primary"
        data-test="save"
        :disabled="!loaded.unsaved || busy"
        @click="save"
      >
        Save as Draft {{ loaded.saved.version + 1 }}
      </button>
      <button
        type="button"
        data-test="reset"
        :disabled="!loaded.unsaved || busy"
        @click="reset"
      >
        Reset
      </button>
    </div>
    <p v-if="notice" class="notice" role="alert">{{ notice }}</p>
    <p class="visually-hidden" role="status">{{ announcement }}</p>
    <template v-for="({ half, rows, totalMinutes }, i) in loaded.clock.halves" :key="half.id">
      <!-- The interval sits between the two halves. -->
      <p v-if="i > 0" class="interval" data-test="interval">
        Interval {{ formatTime(loaded.clock.interval.startsAt) }} –
        {{ formatTime(loaded.clock.interval.endsAt) }}
      </p>
      <section class="half" :aria-labelledby="half.id">
        <h2 :id="half.id">{{ half.name }}</h2>
        <div class="table-scroll" tabindex="0" role="region" :aria-label="`${half.name} items`">
          <!-- Explicit roles: card mode restyles the table as blocks, which can drop its
               semantics in some browsers (e.g. Safari + VoiceOver). -->
          <table class="running-order" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">Move</th>
                <th scope="col" role="columnheader">#</th>
                <th scope="col" role="columnheader">Starts</th>
                <th scope="col" role="columnheader">Item</th>
                <th scope="col" role="columnheader">Cast</th>
                <th scope="col" role="columnheader">Stage</th>
                <th scope="col" role="columnheader">Leads</th>
                <th scope="col" role="columnheader">Comments</th>
                <th scope="col" role="columnheader" class="minutes">Mins</th>
              </tr>
            </thead>
            <tbody role="rowgroup" :data-half="i" v-sortable-rows="{ onDrop: drop, disabled: busy }">
              <tr
                v-for="{ item, number, startsAt } in rows"
                role="row"
                :key="item.id"
                :data-item-id="item.id"
                :class="{ 'not-printed': number === null }"
              >
                <!-- While editing, the row holds the form instead of its cells. -->
                <td v-if="editingId === item.id" colspan="9" class="editing" role="cell">
                  <ItemEditor :item="item" @apply="applyEdit" @cancel="endEdit(item.id)" />
                </td>
                <template v-else>
                  <td class="moves" data-label="Move" role="cell">
                    <span
                      class="drag-handle"
                      role="img"
                      data-tooltip="Drag to reorder"
                      :aria-label="`Drag ${item.title}`"
                      ><FontAwesomeIcon :icon="icons.drag"
                    /></span>
                    <button
                      type="button"
                      data-move="up"
                      :aria-label="`Move ${item.title} up`"
                      data-tooltip="Move up"
                      :disabled="busy || !moveItem(loaded.working, item.id, 'up')"
                      @click="move(item.id, 'up')"
                    >
                      <FontAwesomeIcon :icon="icons.moveUp" />
                    </button>
                    <button
                      type="button"
                      data-move="down"
                      :aria-label="`Move ${item.title} down`"
                      data-tooltip="Move down"
                      :disabled="busy || !moveItem(loaded.working, item.id, 'down')"
                      @click="move(item.id, 'down')"
                    >
                      <FontAwesomeIcon :icon="icons.moveDown" />
                    </button>
                    <button
                      type="button"
                      data-move="other-half"
                      :disabled="busy"
                      :aria-label="`Move ${item.title} to ${otherHalf(i)} half`"
                      :data-tooltip="`Move to ${otherHalf(i)} half`"
                      @click="move(item.id, 'other-half')"
                    >
                      <FontAwesomeIcon :icon="icons.moveToOtherHalf" />
                    </button>
                    <button
                      type="button"
                      data-edit
                      :disabled="busy"
                      :aria-label="`Edit ${item.title}`"
                      data-tooltip="Edit details"
                      @click="startEdit(item.id)"
                    >
                      <FontAwesomeIcon :icon="icons.edit" />
                    </button>
                  </td>
                  <td data-test="number" class="number" data-label="#" role="cell">
                    <template v-if="number !== null">{{ number }}</template>
                    <span v-else class="badge">Not in printed programme</span>
                  </td>
                  <td data-test="starts" class="starts" data-label="Starts" role="cell">{{ formatTime(startsAt) }}</td>
                  <td data-test="title" class="title" data-label="Item" role="cell">{{ item.title }}</td>
                  <td class="cast" data-label="Cast" role="cell">{{ item.cast }}</td>
                  <td data-label="Stage" role="cell">{{ stageLabel(item.stage) }}</td>
                  <td data-label="Leads" role="cell">{{ item.leads }}</td>
                  <td class="comments" data-label="Comments" role="cell">{{ item.comments }}</td>
                  <td data-test="minutes" class="minutes" data-label="Mins" role="cell">
                    <template v-if="item.minutes !== null">{{ item.minutes }}</template>
                    <span v-else class="badge">Untimed</span>
                  </td>
                </template>
              </tr>
              <tr v-if="rows.length === 0" class="empty-half" role="row">
                <td colspan="9" role="cell">No items. Drag one here, or use “Move to {{ half.name.toLowerCase() }}” on an item.</td>
              </tr>
            </tbody>
            <tfoot role="rowgroup">
              <tr role="row">
                <th scope="row" colspan="8" role="rowheader">{{ half.name }} total</th>
                <td data-test="total" class="minutes" role="cell">{{ totalMinutes }} mins</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </template>
    <p class="finish" data-test="finish">
      Projected finish {{ formatTime(loaded.clock.finish) }}
    </p>
  </template>
</template>
