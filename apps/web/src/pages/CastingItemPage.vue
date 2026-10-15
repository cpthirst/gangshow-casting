<script setup lang="ts">
import { RunningOrder } from "@app/shared";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { showPageTitle } from "../router.ts";
import { placeOf, RUNNING_ORDER_PATH } from "../running-order.ts";

const route = useRoute();
const order = ref<RunningOrder>();

const place = computed(() => {
  const itemId = route.params.itemId;
  return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
});

// "Item 2 · First half", or just the half for an item without a programme number.
const position = computed(() => {
  if (!place.value) return "";
  const { half, number } = place.value;
  return number === null
    ? `${half.name} · Not in printed programme`
    : `Item ${number} · ${half.name}`;
});

// Follows the item even if the page is reused for another one (back/forward between items).
watch(place, (found) => found && showPageTitle(found.item.title));

onMounted(async () => {
  try {
    // Name and position come from the latest saved running order, like the Items list.
    const res = await fetch(RUNNING_ORDER_PATH);
    if (res.ok) order.value = RunningOrder.parse(await res.json());
  } catch {
    // For now an unknown item or a failed load shows only the way back (E1.S2 explains them).
  }
});
</script>

<template>
  <RouterLink :to="{ name: 'casting-items' }" class="back-link">All items</RouterLink>
  <template v-if="place">
    <h1>{{ place.item.title }}</h1>
    <p class="item-position" data-test="position">{{ position }}</p>
    <p>No roles have been added yet.</p>
  </template>
</template>
