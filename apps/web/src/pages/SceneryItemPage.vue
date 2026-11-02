<script setup lang="ts">
import ItemFiles from "@/components/production/ItemFiles.vue";
import { sceneryDepartment } from "@/utils/item-files.ts";

// One item's scenery files (production-scenery FR6, FR7) and notes.
</script>

<template>
  <ItemFiles :department="sceneryDepartment" />
</template>
