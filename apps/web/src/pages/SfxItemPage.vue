<script setup lang="ts">
import ItemFiles from "@/components/production/ItemFiles.vue";
import { sfxDepartment } from "@/utils/item-files.ts";

// One item's SFX files and notes, laid out as its Scenery page (production-sfx-wardrobe FR2).
// Visits aren't recorded until the Usage page shows them (E2.S1).
</script>

<template>
  <ItemFiles :department="sfxDepartment" />
</template>
