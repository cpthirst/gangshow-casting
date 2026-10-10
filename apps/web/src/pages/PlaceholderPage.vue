<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <h1>{{ route.meta.title }}</h1>
  <p>{{ route.meta.description }}</p>
  <p class="coming-soon">Coming soon</p>
</template>
