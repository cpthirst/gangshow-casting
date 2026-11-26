<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { icons } from "@/utils/icons.ts";

// The trash icon that removes one of an item's files, on its row or its thumbnail
// (production-scenery FR11, production-image-gallery FR7).

defineProps<{ name: string; disabled: boolean }>();
const emit = defineEmits<{ remove: [event: MouseEvent] }>();
</script>

<template>
  <button
    type="button"
    class="icon-button"
    data-test="delete"
    :aria-label="`Remove ${name}`"
    data-tooltip="Remove file"
    :disabled="disabled"
    @click="emit('remove', $event)"
  >
    <FontAwesomeIcon :icon="icons.remove" />
  </button>
</template>
