<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed } from "vue";
import { type Clash, describeClash } from "./clashes.ts";
import { icons } from "./icons.ts";

// One icon for all of a person's clashes in an item, describing each one (casting-rules
// FR7, FR10, FR11); nothing when they have none. The icon carries the words for screen
// readers; the written-out text is for sighted users: on hover or focus, always on phones.
const props = defineProps<{ clashes: Clash[] }>();

// The clashes come worst first (clashesOf), so the first sets the icon.
const severity = computed(() => props.clashes[0]?.severity);
const descriptions = computed(() => props.clashes.map(describeClash));
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
      <FontAwesomeIcon :icon="icons[severity]" />
    </span>
    <span class="clash-description" aria-hidden="true" data-test="clash-description">
      <span
        v-for="(clash, i) in clashes"
        :key="i"
        :class="['clash-line', `clash-line-${clash.severity}`]"
        >{{ describeClash(clash) }}</span>
    </span>
  </span>
</template>
