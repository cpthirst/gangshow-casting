<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed } from "vue";
import type { ClashLine } from "./clashes.ts";
import { icons } from "./icons.ts";

// One icon for a set of clashes: a person's, or an item's summed up (casting-rules FR7–FR11);
// nothing when there are none. The icon carries the words for screen readers; the
// written-out lines are for sighted users: on hover or focus, always on phones.
const props = defineProps<{ lines: ClashLine[] }>();

// The lines come worst first, so the first sets the icon.
const severity = computed(() => props.lines[0]?.severity);
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
      :aria-label="lines.map((line) => line.text).join('. ')"
      data-test="clash-icon"
    >
      <!-- A different shape for each severity, so it never relies on colour alone. -->
      <FontAwesomeIcon :icon="icons[severity]" />
    </span>
    <span class="clash-description" aria-hidden="true" data-test="clash-description">
      <span
        v-for="(line, i) in lines"
        :key="i"
        :class="['clash-line', `clash-line-${line.severity}`]"
        >{{ line.text }}</span>
    </span>
  </span>
</template>
