<script setup lang="ts">
import ItemFiles from "@/components/production/ItemFiles.vue";
import { recordSceneryUse } from "@/services/usage.ts";
import { sceneryDepartment } from "@/utils/item-files.ts";

// One item's scenery files (production-scenery FR6, FR7) and notes.
</script>

<template>
  <ItemFiles :department="sceneryDepartment" :record-visit="recordSceneryUse" />
</template>
