<script setup lang="ts" generic="View extends string">
// A page's choice of views, such as the Overview's By person, By item and Grid: a labelled
// group of toggle buttons, each heard as pressed or not, so screen readers say which is chosen.
defineProps<{ views: readonly (readonly [View, string])[]; label: string }>();
const chosen = defineModel<View>({ required: true });
</script>

<template>
  <div class="view-switch" role="group" :aria-label="label">
    <button
      v-for="[view, title] in views"
      :key="view"
      type="button"
      :aria-pressed="chosen === view"
      @click="chosen = view">
      {{ title }}
    </button>
  </div>
</template>
