<script setup lang="ts">
import { RunningOrder } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import { RUNNING_ORDER_PATH, runningClock } from "../running-order.ts";

const order = ref<RunningOrder>();

// Numbers come from the running clock, so they always match the Running order page.
const halves = computed(() => order.value && runningClock(order.value).halves);

onMounted(async () => {
  try {
    // The latest saved version: unsaved moves live only on the Running order page (PRD FR1).
    const res = await fetch(RUNNING_ORDER_PATH);
    if (res.ok) order.value = RunningOrder.parse(await res.json());
  } catch {
    // Left blank until the page explains a missing or failed load (casting-items.E1.S2).
  }
});
</script>

<template>
  <h1>Items</h1>
  <p>The show's items, with how far each one's casting has got.</p>
  <template v-if="order && halves">
    <p class="based-on" data-test="version">Based on Draft {{ order.version }}</p>
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
