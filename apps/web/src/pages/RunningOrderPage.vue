<script setup lang="ts">
import { RunningOrder } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import { formatTime, runningClock, stageLabel } from "../running-order.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

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
    const res = await fetch(`/api/productions/${PRODUCTION_ID}/running-order`);
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
</script>

<template>
  <h1>Running order</h1>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'empty'">No running order yet.</p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the running order.</p>
  <template v-else-if="loaded">
    <p class="version">Draft {{ loaded.order.version }}</p>
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
                :class="{ 'not-printed': number === null }"
              >
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
                <th scope="row" colspan="7">{{ half.name }} total</th>
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
