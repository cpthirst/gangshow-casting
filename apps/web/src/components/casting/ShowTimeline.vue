<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { icons } from "@/utils/icons.ts";
import { dotLabel, type TimelineSlot, timelineSummary } from "@/utils/overview.ts";

// A person's evening as a row of dots, one per item, with a wider gap at the interval
// (casting-overview-timeline FR1–FR3): a green circle-dot where they appear, a grey circle
// where they don't. Each dot names its item on hover (FR5); screen readers hear one sentence
// instead of every dot (FR6), and the dots are never tab stops.
defineProps<{ halves: TimelineSlot[][] }>();
</script>

<template>
  <div class="timeline-wrap">
    <p class="visually-hidden" data-test="timeline-summary">{{ timelineSummary(halves) }}</p>
    <!-- How many dots, so the row can shrink to fit (styles.css, .timeline). -->
    <div
      class="timeline"
      :style="{ '--dots': halves.flat().length }"
      aria-hidden="true"
      data-test="timeline"
    >
      <span v-for="(half, h) in halves" :key="h" class="timeline-half" data-test="timeline-half">
        <span
          v-for="slot in half"
          :key="slot.itemId"
          :class="['timeline-dot', slot.part ? 'timeline-in' : 'timeline-out']"
          :data-tooltip="dotLabel(slot)"
          data-test="dot"
        >
          <FontAwesomeIcon :icon="slot.part ? icons.inItem : icons.notInItem" />
        </span>
      </span>
    </div>
  </div>
</template>
