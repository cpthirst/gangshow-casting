<script setup lang="ts">
import { computed } from "vue";
import { canChange } from "@/services/sign-in.ts";
import { helpFor } from "@/utils/help.ts";
import HelpButton from "./HelpButton.vue";

// Every page's title row: its title, a View only badge for someone who can't change the page
// (simplify FR10), and its Help button. The page's Help says which department may change it.
// helpLabel and helpTitle name the button and dialog for a page whose own title changes.
const props = defineProps<{
  title: string;
  help: string;
  helpLabel?: string;
  helpTitle?: string;
}>();

const department = computed(() => helpFor(props.help).department);
const viewOnly = computed(() => department.value !== undefined && !canChange(department.value));
</script>

<template>
  <div class="page-title-row">
    <h1>{{ title }}</h1>
    <!-- Words, not colour, so a screen reader reads it straight after the title. -->
    <span v-if="viewOnly" class="badge" data-test="view-only">View only</span>
    <HelpButton :page="help" :label="helpLabel" :title="helpTitle" />
  </div>
</template>
