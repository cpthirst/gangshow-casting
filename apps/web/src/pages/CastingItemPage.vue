<script setup lang="ts">
import { RunningOrder } from "@app/shared";
import { computed, onMounted, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { showPageTitle } from "../router.ts";
import { placeOf, RUNNING_ORDER_PATH } from "../running-order.ts";

const route = useRoute();
const order = ref<RunningOrder>();
const status = ref<"loading" | "loaded" | "error">("loading");

const place = computed(() => {
  const itemId = route.params.itemId;
  return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
});

// Loaded, but the item isn't in the latest saved running order (PRD FR6).
const notFound = computed(() => status.value === "loaded" && !place.value);

// "Item 2 · First half", or just the half for an item without a programme number.
const position = computed(() => {
  if (!place.value) return "";
  const { half, number } = place.value;
  return number === null
    ? `${half.name} · Not in printed programme`
    : `Item ${number} · ${half.name}`;
});

// Follows the item even if the page is reused for another one (back/forward between items).
watchEffect(() => {
  if (place.value) showPageTitle(place.value.item.title);
  else if (notFound.value) showPageTitle("Item not found");
});

onMounted(async () => {
  try {
    // Name and position come from the latest saved running order, like the Items list.
    const res = await fetch(RUNNING_ORDER_PATH);
    // No saved running order at all: no item can be in it.
    if (res.status !== 404) {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      order.value = RunningOrder.parse(await res.json());
    }
    status.value = "loaded";
  } catch {
    // A failed load must never look like "not found".
    status.value = "error";
  }
});
</script>

<template>
  <RouterLink :to="{ name: 'casting-items' }" class="back-link">All items</RouterLink>
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <h1>{{ place.item.title }}</h1>
    <p class="item-position" data-test="position">{{ position }}</p>
    <p>No roles have been added yet.</p>
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
