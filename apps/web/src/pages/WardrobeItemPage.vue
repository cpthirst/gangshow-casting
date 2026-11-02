<script setup lang="ts">
import ItemFiles from "@/components/production/ItemFiles.vue";
import { wardrobeDepartment } from "@/utils/item-files.ts";

// One item's Wardrobe files and notes, laid out as its Scenery page (production-sfx-wardrobe FR2).
</script>

<template>
  <ItemFiles :department="wardrobeDepartment" />
</template>
