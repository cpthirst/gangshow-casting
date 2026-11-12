<script setup lang="ts">
// A role with who plays it, as a prop card lists its roles and carriers (production-props
// FR18) and a costume row names its cast member (production-costume-sheets FR3): the role's
// name, then the cast in brackets as the prop form shows them, or why there's nobody.
defineProps<{ name: string; cast: string; none: string }>();
</script>

<template>
  <span class="card-name" data-test="role-name">{{ name }}</span>
  <!-- Real spaces, so a screen reader hears "Parrot Uncast", not one word. -->
  {{ " " }}
  <span v-if="cast" class="role-cast role-carriers">(<span data-test="cast">{{ cast }}</span>)</span>
  <span v-else class="uncast" data-test="uncast">{{ none }}</span>
</template>
