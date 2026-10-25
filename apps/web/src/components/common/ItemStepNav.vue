<script setup lang="ts">
import type { RunningOrderItem } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import type { RouteLocationRaw } from "vue-router";
import { icons } from "@/utils/icons.ts";

// The links every page about one item has: back to its list, and Previous and Next in
// running order (CLAUDE.md domain rules). itemRoute is the route name of the neighbours'
// pages, which take the item id as their itemId param.
defineProps<{
  list: RouteLocationRaw;
  itemRoute: string;
  previous?: RunningOrderItem | undefined;
  next?: RunningOrderItem | undefined;
}>();
</script>

<template>
  <nav class="step-nav" aria-label="Item navigation">
    <RouterLink :to="list" class="back-link">
      <span class="step-label"><FontAwesomeIcon :icon="icons.allItems" /> All items</span>
    </RouterLink>
    <RouterLink
      v-if="previous"
      :to="{ name: itemRoute, params: { itemId: previous.id } }"
      rel="prev"
      :data-tooltip="previous.title"
      class="step-link step-previous"
    >
      <span class="step-label"><FontAwesomeIcon :icon="icons.back" /> Previous</span>
      <!-- A real space, so the link reads "Previous Pirate Sketch", not one word. -->
      {{ " " }}
      <span class="step-title">{{ previous.title }}</span>
    </RouterLink>
    <RouterLink
      v-if="next"
      :to="{ name: itemRoute, params: { itemId: next.id } }"
      rel="next"
      :data-tooltip="next.title"
      class="step-link step-next"
    >
      <span class="step-label">Next <FontAwesomeIcon :icon="icons.forward" /></span>
      {{ " " }}
      <span class="step-title">{{ next.title }}</span>
    </RouterLink>
  </nav>
</template>
