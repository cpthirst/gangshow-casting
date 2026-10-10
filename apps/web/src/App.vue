<script setup lang="ts">
import HealthStatus from "./HealthStatus.vue";

defineProps<{ title?: string }>();
</script>

<template>
  <main>
    <h1>{{ title ?? "dev-project-template-opinionated-harness" }}</h1>
    <HealthStatus />
  </main>
</template>
