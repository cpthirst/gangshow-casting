<script setup lang="ts">
import PageHelp from "@/components/common/PageHelp.vue";
import { pageHelp } from "@/utils/help.ts";
</script>

<template>
  <h1>Help</h1>
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
