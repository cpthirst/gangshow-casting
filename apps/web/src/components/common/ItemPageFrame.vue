<script setup lang="ts">
import { type DepartmentId, departments, RunningOrder, type RunningOrderItem } from "@app/shared";
import { computed, ref, watch, watchEffect } from "vue";
import { type RouteLocationRaw, useRoute } from "vue-router";
import { showPageTitle } from "@/router/index.ts";
import { loadData } from "@/services/load-data.ts";
import { canChange } from "@/services/sign-in.ts";
import { recordDepartmentPageUse } from "@/services/usage.ts";
import { itemRouteOf } from "@/utils/departments.ts";
import { departmentNotesPath, saveDepartmentNotesPath } from "@/utils/item-notes.ts";
import { neighboursOf, placeOf, positionOf, runningOrderPath } from "@/utils/running-order.ts";
import ItemNotes from "./ItemNotes.vue";
import ItemStepNav from "./ItemStepNav.vue";
import PageTitle from "./PageTitle.vue";
import RefusalNotice from "./RefusalNotice.vue";

// The frame every page about one item shares (CLAUDE.md domain rules, simplify FR6): All
// items, Previous and Next, a "Department: Item" title, the item's position, the page in
// between, the department's notes, and one not-found and one error state. A visit is
// recorded once the item is found.

const props = withDefaults(
  defineProps<{
    department: DepartmentId;
    /** Where All items goes back to. */
    list?: RouteLocationRaw;
    /**
     * Loads the page's own data for an item, alongside the running order, and returns how to
     * show it, given the running order loaded with it. The frame shows it only if that item is
     * still the one open, so stepping on while it loads never shows the last item's.
     */
    load: (itemId: string) => Promise<(order: RunningOrder) => void>;
  }>(),
  { list: () => ({ name: "production-overview" }) },
);
defineSlots<{ default(scope: { item: RunningOrderItem }): unknown }>();

const route = useRoute();
const order = ref<RunningOrder>();
const status = ref<"loading" | "loaded" | "error">("loading");

const named = computed(() => departments[props.department]);
const itemId = computed(() =>
  typeof route.params.itemId === "string" ? route.params.itemId : undefined,
);
const place = computed(() =>
  order.value && itemId.value ? placeOf(order.value, itemId.value) : undefined,
);
const neighbours = computed(() =>
  order.value && place.value ? neighboursOf(order.value, place.value.item.id) : {},
);
// Loaded, but the item isn't in the latest saved running order.
const notFound = computed(() => status.value === "loaded" && !place.value);
const title = computed(() => (place.value ? `${named.value.name}: ${place.value.item.title}` : ""));

// Each visit is a use, once the item is found; what's done on the page isn't.
watch(
  () => place.value?.item.id,
  (id) => {
    if (order.value && id) recordDepartmentPageUse(props.department, order.value.productionId, id);
  },
);

// Follows the item as Previous and Next reuse the page.
watchEffect(() => {
  if (place.value) showPageTitle(title.value);
  else if (notFound.value) showPageTitle("Item not found");
});

async function open(id: string) {
  status.value = "loading";
  try {
    // No saved running order at all: no item can be in it.
    const [loadedOrder, showData] = await Promise.all([
      loadData(runningOrderPath(), RunningOrder),
      props.load(id),
    ]);
    // Stepped on to another item while this one loaded: that load shows instead.
    if (id !== itemId.value) return;
    order.value = loadedOrder;
    if (loadedOrder) showData(loadedOrder);
    status.value = "loaded";
  } catch {
    // A failed load must never look like "not found" or an empty page.
    if (id === itemId.value) status.value = "error";
  }
}

/** Loads the item and the page's data again, to catch up with the API. */
async function reload() {
  if (itemId.value) await open(itemId.value);
}
defineExpose({ reload });

watch(
  itemId,
  (id) => {
    if (id) open(id);
  },
  { immediate: true },
);
</script>

<template>
  <ItemStepNav
    :list="list"
    :item-route="itemRouteOf(department)"
    :previous="neighbours.previous"
    :next="neighbours.next"
  />
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <PageTitle
      :title="title"
      :help="itemRouteOf(department)"
      help-label="Help for this item"
      help-title="Item help"
    />
    <p class="item-position" data-test="position">{{ positionOf(place) }}</p>
    <RefusalNotice :about="department" />
    <slot :item="place.item" />
    <!-- Apart from the item's other notes. A fresh instance per item, so stepping to another
         never mixes their notes. -->
    <ItemNotes
      :key="place.item.id"
      :item-id="place.item.id"
      :heading="`${named.name} notes`"
      :list-path="departmentNotesPath(department)"
      :save-path="saveDepartmentNotesPath(department, place.item.id)"
      :can-change="canChange(department)"
    />
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
