<script setup lang="ts">
import { RunningOrder } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import { RUNNING_ORDER_PATH, runningClock } from "../running-order.ts";

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; order: RunningOrder };

const state = ref<State>({ status: "loading" });

// Numbers come from the running clock, so they always match the Running order page.
const halves = computed(() =>
  state.value.status === "loaded" ? runningClock(state.value.order).halves : [],
);

onMounted(async () => {
  try {
    // The latest saved version: unsaved moves live only on the Running order page (PRD FR1).
    const res = await fetch(RUNNING_ORDER_PATH);
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
});
</script>

<template>
  <h1>Items</h1>
  <p>The show's items, with how far each one's casting has got.</p>
  <p v-if="state.status === 'empty'">
    There's no saved running order yet. Set one up on the
    <RouterLink to="/">Running order page</RouterLink>.
  </p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the items.</p>
  <template v-else-if="state.status === 'loaded'">
    <p class="based-on" data-test="version">Based on Draft {{ state.order.version }}</p>
    <section v-for="{ half, rows } in halves" :key="half.id" class="half" :aria-labelledby="half.id">
      <h2 :id="half.id">{{ half.name }}</h2>
      <ol class="casting-items">
        <li v-for="{ item, number } in rows" :key="item.id" data-test="item">
          <span class="casting-item-number" data-test="number">
            <template v-if="number !== null">{{ number }}</template>
            <span v-else class="badge">Not in printed programme</span>
          </span>
          <span data-test="title">{{ item.title }}</span>
        </li>
      </ol>
    </section>
  </template>
</template>
