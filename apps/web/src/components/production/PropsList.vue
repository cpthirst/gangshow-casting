<script setup lang="ts">
import { PropList, RunningOrder } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, onMounted, ref } from "vue";
import { apiFetch, canChangeStage } from "@/services/sign-in.ts";
import { icons } from "@/utils/icons.ts";
import { PROPS_PATH, propCountLabel, propCounts } from "@/utils/props.ts";
import { RUNNING_ORDER_PATH, runningClock } from "@/utils/running-order.ts";

// The Stage page's Props view: the show's items with how many props each has (stage-props
// FR13, FR15), laid out as the casting Items list.

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; order: RunningOrder };

const state = ref<State>({ status: "loading" });
// Loaded separately: if the props fail, the items still show, just without counts.
const countOf = ref<((itemId: string) => number) | "error">();

// Numbers come from the running clock, so they always match the Running order page.
const halves = computed(() =>
  state.value.status === "loaded" ? runningClock(state.value.order).halves : [],
);

/** The item's count, labelled; empty while the props are loading or unavailable, so a count
 *  that couldn't be loaded never reads as 0. */
const countLabel = (itemId: string) =>
  typeof countOf.value === "function" ? propCountLabel(countOf.value(itemId)) : "";

onMounted(() => {
  loadRunningOrder();
  loadProps();
});

async function loadProps() {
  try {
    const res = await apiFetch(PROPS_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    countOf.value = propCounts(PropList.parse(await res.json()).props);
  } catch {
    countOf.value = "error";
  }
}

async function loadRunningOrder() {
  try {
    // The latest saved version, as on the casting Items list.
    const res = await apiFetch(RUNNING_ORDER_PATH);
    if (res.status === 404) {
      state.value = { status: "empty" };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", order: RunningOrder.parse(await res.json()) };
  } catch {
    // A failed load must never look like "no running order yet".
    state.value = { status: "error" };
  }
}
</script>

<template>
  <p v-if="state.status === 'empty'">
    There's no saved running order yet. Set one up on the
    <RouterLink :to="{ name: 'running-order' }">Running order page</RouterLink>.
  </p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the items.</p>
  <template v-else-if="state.status === 'loaded'">
    <p class="based-on" data-test="version">Based on Draft {{ state.order.version }}</p>
    <p v-if="countOf === 'error'" class="notice" role="alert">Couldn't load the props counts.</p>
    <section v-for="{ half, rows } in halves" :key="half.id" class="half" :aria-labelledby="half.id">
      <h2 :id="half.id">{{ half.name }}</h2>
      <div class="table-scroll" tabindex="0" role="region" :aria-label="`${half.name} items`">
        <table class="running-order items-list" role="table">
          <!-- The same column widths in both halves, so they line up. -->
          <colgroup>
            <col class="col-cast" />
            <col class="col-number" />
            <col />
            <col class="col-counts" />
          </colgroup>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Props</th>
              <th scope="col" role="columnheader">#</th>
              <th scope="col" role="columnheader">Item</th>
              <th scope="col" role="columnheader">Props count</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            <tr
              v-for="{ item, number } in rows"
              :key="item.id"
              role="row"
              data-test="item"
              :data-item-id="item.id"
              :class="{ 'not-printed': number === null }"
            >
              <td class="moves" data-label="Props" role="cell">
                <RouterLink
                  class="icon-button"
                  data-test="open-props"
                  :to="{ name: 'props-item', params: { itemId: item.id } }"
                  :aria-label="`${canChangeStage ? 'Edit' : 'View'} props for ${item.title}`"
                  :data-tooltip="canChangeStage ? 'Edit this item\'s props' : 'View this item\'s props'"
                >
                  <FontAwesomeIcon :icon="icons.edit" />
                </RouterLink>
              </td>
              <td data-test="number" class="number" data-label="#" role="cell">
                <template v-if="number !== null">{{ number }}</template>
                <span v-else class="badge">Not in printed programme</span>
              </td>
              <td class="title" data-label="Item" role="cell">
                <span data-test="title">{{ item.title }}</span>
              </td>
              <td data-test="count" class="counts" data-label="Props count" role="cell">{{ countLabel(item.id) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
