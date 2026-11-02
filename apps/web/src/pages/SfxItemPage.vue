<script setup lang="ts">
import ItemFiles from "@/components/production/ItemFiles.vue";
import { sfxDepartment } from "@/utils/item-files.ts";

// One item's SFX files and notes, laid out as its Scenery page (production-sfx-wardrobe FR2).
</script>

<template>
  <ItemFiles :department="sfxDepartment" />
</template>
