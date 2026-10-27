<script setup lang="ts">
import { RunningOrder } from "@app/shared";
import { computed, onMounted, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import ItemStepNav from "@/components/common/ItemStepNav.vue";
import { showPageTitle } from "@/router/index.ts";
import { apiFetch } from "@/services/sign-in.ts";
import type { DepartmentPage } from "@/utils/departments.ts";
import { neighboursOf, placeOf, positionOf, RUNNING_ORDER_PATH } from "@/utils/running-order.ts";

// One item's page for a department that has nothing of its own yet (production-overview
// FR10), laid out as the props item page. Each department's feature fills it in later.

const props = defineProps<{ department: DepartmentPage }>();

const route = useRoute();
const order = ref<RunningOrder>();
const status = ref<"loading" | "loaded" | "error">("loading");

const place = computed(() => {
  const itemId = route.params.itemId;
  return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
});
const neighbours = computed(() =>
  order.value && place.value ? neighboursOf(order.value, place.value.item.id) : {},
);
// Loaded, but the item isn't in the latest saved running order.
const notFound = computed(() => status.value === "loaded" && !place.value);
const title = computed(() =>
  place.value ? `${props.department.name}: ${place.value.item.title}` : "",
);

// Follows the item even if the page is reused for another one (Previous and Next).
watchEffect(() => {
  if (place.value) showPageTitle(title.value);
  else if (notFound.value) showPageTitle("Item not found");
});

onMounted(async () => {
  try {
    const res = await apiFetch(RUNNING_ORDER_PATH);
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
  <ItemStepNav
    :list="{ name: 'production-overview' }"
    :item-route="department.route"
    :previous="neighbours.previous"
    :next="neighbours.next"
  />
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <h1>{{ title }}</h1>
    <p class="item-position" data-test="position">{{ positionOf(place) }}</p>
    <p>Coming soon.</p>
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
