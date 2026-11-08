<script setup lang="ts">
// The saved running order's number, worded the same on every page that shows it.
defineProps<{ version: number }>();
</script>

<template>
  <p class="version" data-test="version">Draft {{ version }}</p>
</template>
