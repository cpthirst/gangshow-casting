<script setup lang="ts">
import { RunningOrder } from "@app/shared";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import {
  dropItem,
  formatTime,
  locate,
  type Move,
  moveItem,
  reorderOf,
  runningClock,
  sameOrder,
  stageLabel,
} from "../running-order.ts";
import { type RowDrop, vSortableRows } from "../sortable-rows.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";
const API_PATH = `/api/productions/${PRODUCTION_ID}/running-order`;

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
  return { saved, working, clock: runningClock(working), unsaved: !sameOrder(saved, working) };
});

const showSaved = (order: RunningOrder) => {
  state.value = { status: "loaded", saved: order, working: order };
};

async function load() {
  try {
    const res = await fetch(API_PATH);
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

async function move(itemId: string, direction: Move) {
  if (state.value.status !== "loaded" || saving.value) return;
  const moved = moveItem(state.value.working, itemId, direction);
  if (!moved) return;
  changeWorking(moved, itemId);
  await nextTick();
  refocus(itemId, direction);
}

function drop({ itemId, toHalf, toIndex }: RowDrop) {
  if (state.value.status !== "loaded" || saving.value) return;
  const { working } = state.value;
  const dropped = dropItem(working, itemId, toHalf, toIndex);
  if (!sameOrder(dropped, working)) changeWorking(dropped, itemId);
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
  if (state.value.status !== "loaded" || saving.value || !loaded.value?.unsaved) return;
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
  if (state.value.status !== "loaded" || saving.value) return;
  showSaved(state.value.saved);
  notice.value = "";
  announcement.value = `Changes discarded. Back to Draft ${state.value.saved.version}.`;
}

type SaveResult = { outcome: "saved" | "conflict"; order: RunningOrder } | { outcome: "failed" };

// 201 → saved; 409 → someone else saved first (the body is their version); anything else failed.
async function saveDraft(baseVersion: number, working: RunningOrder): Promise<SaveResult> {
  try {
    const res = await fetch(`${API_PATH}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseVersion, change: reorderOf(working) }),
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
        :disabled="!loaded.unsaved || saving"
        @click="save"
      >
        Save as Draft {{ loaded.saved.version + 1 }}
      </button>
      <button
        type="button"
        data-test="reset"
        :disabled="!loaded.unsaved || saving"
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
          <table class="running-order">
            <thead>
              <tr>
                <th scope="col">Move</th>
                <th scope="col">#</th>
                <th scope="col">Starts</th>
                <th scope="col">Item</th>
                <th scope="col">Cast</th>
                <th scope="col">Stage</th>
                <th scope="col">Leads</th>
                <th scope="col">Comments</th>
                <th scope="col">Mins</th>
              </tr>
            </thead>
            <tbody :data-half="i" v-sortable-rows="{ onDrop: drop, disabled: saving }">
              <tr
                v-for="{ item, number, startsAt } in rows"
                :key="item.id"
                :data-item-id="item.id"
                :class="{ 'not-printed': number === null }"
              >
                <td class="moves">
                  <span
                    class="drag-handle"
                    role="img"
                    :aria-label="`Drag ${item.title}`"
                    >⠿</span
                  >
                  <button
                    type="button"
                    data-move="up"
                    :aria-label="`Move ${item.title} up`"
                    title="Move up"
                    :disabled="saving || !moveItem(loaded.working, item.id, 'up')"
                    @click="move(item.id, 'up')"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    data-move="down"
                    :aria-label="`Move ${item.title} down`"
                    title="Move down"
                    :disabled="saving || !moveItem(loaded.working, item.id, 'down')"
                    @click="move(item.id, 'down')"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    data-move="other-half"
                    :disabled="saving"
                    :aria-label="`Move ${item.title} to ${otherHalf(i)} half`"
                    :title="`Move to ${otherHalf(i)} half`"
                    @click="move(item.id, 'other-half')"
                  >
                    ⇄
                  </button>
                </td>
                <td data-test="number">
                  <template v-if="number !== null">{{ number }}</template>
                  <span v-else class="badge">Not in printed programme</span>
                </td>
                <td data-test="starts" class="starts">{{ formatTime(startsAt) }}</td>
                <td data-test="title" class="title">{{ item.title }}</td>
                <td>{{ item.cast }}</td>
                <td>{{ stageLabel(item.stage) }}</td>
                <td>{{ item.leads }}</td>
                <td>{{ item.comments }}</td>
                <td data-test="minutes" class="minutes">
                  <template v-if="item.minutes !== null">{{ item.minutes }}</template>
                  <span v-else class="badge">Untimed</span>
                </td>
              </tr>
              <tr v-if="rows.length === 0" class="empty-half">
                <td colspan="9">No items. Drag one here, or use ⇄ to move one into the {{ half.name.toLowerCase() }}.</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colspan="8">{{ half.name }} total</th>
                <td data-test="total" class="minutes">{{ totalMinutes }} mins</td>
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
