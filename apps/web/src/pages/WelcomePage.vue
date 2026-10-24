<script setup lang="ts">
import { pageHelp } from "../help.ts";
import PageHelp from "../PageHelp.vue";
</script>

<template>
  <h1>Welcome</h1>
  <p data-test="intro">
    This is iCUE, the Chester Gang Show's app for managing the show, so every department works from
    the same information. Today it covers casting, showing who is in which item and when; props
    lists, sound effects and mic plots are to come.
  </p>
  <section
    v-for="help in pageHelp"
    :key="help.page"
    class="help-section"
    :aria-labelledby="`help-${help.page}`"
  >
    <h2 :id="`help-${help.page}`">{{ help.title }}</h2>
    <PageHelp :help="help" />
    <p>
      <RouterLink :to="{ name: (help.reachedFrom ?? help).page }"
        >Go to the {{ (help.reachedFrom ?? help).title }} page</RouterLink
      >
    </p>
  </section>
</template>
