<script setup lang="ts">
import { computed } from "vue";
import { isOpenProductionChangeable } from "@/services/production.ts";
import { hasAccessToChange } from "@/services/sign-in.ts";
import { helpFor } from "@/utils/help.ts";
import HelpButton from "./HelpButton.vue";

// Every page's title row: its title, a View only badge for someone who can't change the page
// or on any page about a past production (simplify FR10, FR21), and its Help button. The page's Help says who may change it.
// helpLabel and helpTitle name the button and dialog for a page whose own title changes.
const props = defineProps<{
  title: string;
  help: string;
  helpLabel?: string;
  helpTitle?: string;
}>();

const page = computed(() => helpFor(props.help));
const viewOnly = computed(() => {
  const { changedBy, acrossProductions } = page.value;
  // Everything about a past production is view only, even a page no one can change anyway.
  if (!acrossProductions && !isOpenProductionChangeable()) return true;
  return changedBy !== undefined && !hasAccessToChange(changedBy);
});
</script>

<template>
  <div class="page-title-row">
    <h1>{{ title }}</h1>
    <!-- Words, not colour, so a screen reader reads it straight after the title. -->
    <span v-if="viewOnly" class="badge" data-test="view-only">View only</span>
    <HelpButton :page="help" :label="helpLabel" :title="helpTitle" />
  </div>
</template>
