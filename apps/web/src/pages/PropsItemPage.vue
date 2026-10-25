<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { icons } from "@/utils/icons.ts";

// One item's props: a placeholder the Props list opens, until stage-props.E4.S2 builds it.
</script>

<template>
  <nav class="step-nav" aria-label="Item navigation">
    <RouterLink :to="{ name: 'stage', query: { view: 'props' } }" class="back-link">
      <span class="step-label"><FontAwesomeIcon :icon="icons.allItems" /> All items</span>
    </RouterLink>
  </nav>
  <h1>Item props</h1>
  <p class="coming-soon">Coming soon</p>
</template>
