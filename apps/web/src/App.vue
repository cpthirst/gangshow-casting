<script setup lang="ts">
import HealthStatus from "./HealthStatus.vue";

defineProps<{ title?: string }>();
</script>

<template>
  <main>
    <h1>{{ title ?? "Chester Gang Show casting" }}</h1>
    <HealthStatus />
  </main>
</template>
