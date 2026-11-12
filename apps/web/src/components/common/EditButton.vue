<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { icons } from "@/utils/icons.ts";

// The pencil that opens a row's edit form, in a list with one form open at a time
// (useListEditing), which puts focus back on it when the form closes. label: what it edits,
// for screen readers ("Edit Captain Hook"); tooltip: what it does ("Edit role").
defineProps<{ label: string; tooltip: string; disabled: boolean }>();
</script>

<template>
  <button
    type="button"
    class="icon-button"
    data-test="edit"
    :aria-label="label"
    :data-tooltip="tooltip"
    :disabled="disabled"
  >
    <FontAwesomeIcon :icon="icons.edit" />
  </button>
</template>
