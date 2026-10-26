<script setup lang="ts">
import type { PageView } from "@app/shared";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import HelpButton from "@/components/common/HelpButton.vue";
import ReadOnlyNotice from "@/components/common/ReadOnlyNotice.vue";
import ViewSwitch from "@/components/common/ViewSwitch.vue";
import PropsList from "@/components/production/PropsList.vue";
import { recordView } from "@/services/usage.ts";
import { type DepartmentName, departments, viewNamed } from "@/utils/departments.ts";

// One department's page under Production: Stage, Tech or Wardrobe (stage-props FR10).
const props = defineProps<{ department: DepartmentName }>();

const route = useRoute();
const router = useRouter();

const config = computed(() => departments[props.department]);
const views = computed(() => config.value.views.map((view) => [view.name, view.title] as const));

// The chosen view lives in the address, so a bookmark (or an old Production address) opens
// it. The first view is the page's own address, with no ?view.
const shown = computed(() => viewNamed(config.value, route.query.view));

function choose(name: PageView) {
  const view = config.value.views.find((candidate) => candidate.name === name);
  if (!view || view === shown.value) return;
  // Each switch is a use of that view; the one the page opens on isn't (usage-tracking FR2).
  recordView(view.name);
  router.replace({ query: view === config.value.views[0] ? {} : { view: view.name } });
}
</script>

<template>
  <div class="page-title-row">
    <h1>{{ config.title }}</h1>
    <HelpButton :page="props.department" />
  </div>
  <p>{{ config.description }}</p>
  <template v-if="shown">
    <div class="view-bar">
      <ViewSwitch
        :model-value="shown.name"
        :views="views"
        label="Choose which list to see"
        @update:model-value="choose" />
    </div>
    <!-- Named for screen readers by its view, as the switch shows it chosen. -->
    <section data-test="department-view" :aria-label="shown.title">
      <!-- Straight under the switch, before the description, as on the casting pages. -->
      <ReadOnlyNotice v-if="shown.name === 'props'" about="props" />
      <p>{{ shown.description }}</p>
      <PropsList v-if="shown.name === 'props'" />
      <p v-else class="coming-soon">Coming soon</p>
    </section>
  </template>
  <p v-else class="coming-soon">Coming soon</p>
</template>
