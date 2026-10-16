<script setup lang="ts">
import { computed } from "vue";
import { type Clash, describeClash } from "./clashes.ts";

// One icon for all of a person's clashes in an item, describing each one (casting-rules
// FR7, FR10, FR11); nothing when they have none. The icon carries the words for screen
// readers; the written-out text is for sighted users: on hover or focus, always on phones.
const props = defineProps<{ clashes: Clash[]; itemId: string }>();

const severity = computed(() => props.clashes[0]?.severity);
const descriptions = computed(() => props.clashes.map((c) => describeClash(c, props.itemId)));
</script>

<template>
  <span
    v-if="severity"
    :class="['clash', `clash-${severity}`]"
    :data-severity="severity"
    data-test="clash"
  >
    <span
      class="clash-icon"
      role="img"
      tabindex="0"
      :aria-label="descriptions.join('. ')"
      data-test="clash-icon"
    >
      <!-- A different shape for each severity, so it never relies on colour alone. -->
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          v-if="severity === 'error'"
          d="M8 2h8l6 6v8l-6 6H8l-6-6V8l6-6zm3 5v7h2V7h-2zm0 9v2h2v-2h-2z"
          fill="currentColor"
        />
        <path
          v-else-if="severity === 'warning'"
          d="M12 2l11 20H1L12 2zm-1 7v6h2V9h-2zm0 8v2h2v-2h-2z"
          fill="currentColor"
        />
        <path
          v-else
          d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 8v7h2v-7h-2zm0-4v2h2V6h-2z"
          fill="currentColor"
        />
      </svg>
    </span>
    <span class="clash-description" aria-hidden="true" data-test="clash-description">
      <span v-for="description in descriptions" :key="description" class="clash-line">{{
        description
      }}</span>
    </span>
  </span>
</template>
