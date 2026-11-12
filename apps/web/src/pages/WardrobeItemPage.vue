<script setup lang="ts">
import ItemCostumes from "@/components/production/ItemCostumes.vue";
import ItemFiles from "@/components/production/ItemFiles.vue";
import { useCasting } from "@/composables/useCasting.ts";
import { wardrobeDepartment } from "@/utils/item-files.ts";

// One item's Wardrobe files and notes, laid out as its Scenery page (production-sfx-wardrobe
// FR2), with who wears what in between (production-costume-sheets FR2).

const { roles, cast, load: loadCasting } = useCasting();
</script>

<template>
  <ItemFiles v-slot="{ item }" :department="wardrobeDepartment" :load="loadCasting">
    <ItemCostumes :item-id="item.id" :roles="roles" :cast="cast" />
  </ItemFiles>
</template>
