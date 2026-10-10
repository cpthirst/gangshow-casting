<script setup lang="ts">
import { type ReorderChange, RunningOrder } from "@app/shared";
import { computed, nextTick, onMounted, ref } from "vue";
import {
  formatTime,
  locate,
  type Move,
  planMove,
  runningClock,
  stageLabel,
} from "../running-order.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";
const API_PATH = `/api/productions/${PRODUCTION_ID}/running-order`;

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; order: RunningOrder };

const state = ref<State>({ status: "loading" });

const loaded = computed(() =>
  state.value.status === "loaded"
    ? { order: state.value.order, clock: runningClock(state.value.order) }
    : undefined,
);

onMounted(async () => {
  try {
    const res = await fetch(API_PATH);
    if (res.status === 404) {
      state.value = { status: "empty" };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", order: RunningOrder.parse(await res.json()) };
  } catch {
    state.value = { status: "error" };
  }
});

/** Screen-reader announcement of the last move or conflict. */
const announcement = ref("");
/** Visible message about a conflict or failed save. */
const notice = ref("");
let saving = false;

// Every move is saved straight away as the next version (PRD FR6).
async function move(itemId: string, title: string, direction: Move) {
  if (state.value.status !== "loaded" || saving) return;
  const { order } = state.value;
  const change = planMove(order, itemId, direction);
  if (!change) return;

  saving = true;
  notice.value = "";
  const result = await saveChange(order.version, change);
  saving = false;

  if (result.outcome === "failed") {
    notice.value = "Couldn't save that change. Try again.";
  } else {
    state.value = { status: "loaded", order: result.order };
    if (result.outcome === "conflict") {
      notice.value = `Someone else changed the running order. Showing the latest (Draft ${result.order.version}).`;
    }
  }
  announcement.value =
    notice.value ||
    (result.outcome === "saved"
      ? `${describeMove(order, result.order, itemId, title)} Saved as Draft ${result.order.version}.`
      : "");
  await nextTick();
  refocus(itemId, direction);
}

type SaveResult = { outcome: "saved" | "conflict"; order: RunningOrder } | { outcome: "failed" };

// 201 → saved; 409 → someone else saved first (the body is their version); anything else failed.
async function saveChange(baseVersion: number, change: ReorderChange): Promise<SaveResult> {
  try {
    const res = await fetch(`${API_PATH}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseVersion, change }),
    });
    if (res.status !== 201 && res.status !== 409) return { outcome: "failed" };
    const order = RunningOrder.parse(await res.json());
    return { outcome: res.status === 201 ? "saved" : "conflict", order };
  } catch {
    return { outcome: "failed" };
  }
}

function describeMove(before: RunningOrder, after: RunningOrder, itemId: string, title: string) {
  const from = locate(before, itemId);
  const to = locate(after, itemId);
  if (!to) return `${title} moved.`;
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
    <p class="version">Draft {{ loaded.order.version }}</p>
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
            <tbody>
              <tr
                v-for="{ item, number, startsAt } in rows"
                :key="item.id"
                :data-item-id="item.id"
                :class="{ 'not-printed': number === null }"
              >
                <td class="moves">
                  <button
                    type="button"
                    data-move="up"
                    :aria-label="`Move ${item.title} up`"
                    :disabled="!planMove(loaded.order, item.id, 'up')"
                    @click="move(item.id, item.title, 'up')"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    data-move="down"
                    :aria-label="`Move ${item.title} down`"
                    :disabled="!planMove(loaded.order, item.id, 'down')"
                    @click="move(item.id, item.title, 'down')"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    data-move="other-half"
                    :aria-label="`Move ${item.title} to ${otherHalf(i)} half`"
                    @click="move(item.id, item.title, 'other-half')"
                  >
                    To {{ otherHalf(i) }} half
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
