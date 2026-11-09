<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { useRouter } from "vue-router";
import {
  listedProductionYears,
  openProduction,
  openProductionYear,
} from "@/services/production.ts";

// Everyone can look back at an older production (simplify FR20, FR21). A drop-down and a
// button, not a choice that takes effect as it changes, so arrow keys can pick without moving.
const router = useRouter();
const uid = useId();

const open = computed(openProductionYear);
const years = computed(listedProductionYears);
const chosen = ref(open.value);
watch(open, (year) => {
  chosen.value = year;
});

// Leaving first lets the page ask about unsaved changes. The Running order is every
// production's own page: an item open now mightn't be in the other production.
async function switchProduction() {
  if (chosen.value === open.value) return;
  const stayed = await router.push({ name: "leaving" });
  if (stayed) {
    chosen.value = open.value;
    return;
  }
  openProduction(chosen.value);
  await router.replace({ name: "running-order" });
}
</script>

<template>
  <form
    v-if="years.length > 1"
    class="production-switch"
    data-test="production-switch"
    @submit.prevent="switchProduction"
  >
    <label :for="`${uid}-production`">Productions</label>
    <select :id="`${uid}-production`" v-model="chosen" name="production">
      <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
    </select>
    <button type="submit">Open</button>
  </form>
</template>
