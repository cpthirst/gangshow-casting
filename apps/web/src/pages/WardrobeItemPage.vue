<script setup lang="ts">
import { type Costume, CostumeList } from "@app/shared";
import { ref } from "vue";
import ItemCostumes from "@/components/production/ItemCostumes.vue";
import ItemFiles from "@/components/production/ItemFiles.vue";
import { useCasting } from "@/composables/useCasting.ts";
import { loadData } from "@/services/load-data.ts";
import { costumesPath } from "@/services/production.ts";
import { canChange } from "@/services/sign-in.ts";
import { wardrobeDepartment } from "@/utils/item-files.ts";

// One item's Wardrobe files and notes, laid out as its Scenery page (production-sfx-wardrobe
// FR2), with who wears what in between (production-costume-sheets FR2).

const { roles, cast, load: loadCasting } = useCasting();
const costumes = ref<Costume[]>([]);

// The casting and every costume, loaded with the files. A production nobody has saved a
// costume in answers with none.
async function loadCastingAndCostumes() {
  const [showCasting, loaded] = await Promise.all([
    loadCasting(),
    loadData(costumesPath(), CostumeList),
  ]);
  return () => {
    showCasting();
    costumes.value = loaded?.costumes ?? [];
  };
}
</script>

<template>
  <ItemFiles v-slot="{ item }" :department="wardrobeDepartment" :load="loadCastingAndCostumes">
    <!-- A fresh instance per item, so an open form never carries over to the next. -->
    <ItemCostumes
      :key="item.id"
      v-model:costumes="costumes"
      :item-id="item.id"
      :roles="roles"
      :cast="cast"
      :can-change="canChange('wardrobe')"
    />
  </ItemFiles>
</template>
