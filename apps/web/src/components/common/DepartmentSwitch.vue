<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { departmentPages, type ProductionDepartmentId } from "@/utils/departments.ts";

// Every Production department's page for the same item, in the Overview's order
// (department-switch FR1), with the one you're in marked rather than linked.
defineProps<{ current: ProductionDepartmentId; itemId: string }>();
</script>

<template>
  <nav class="department-switch" aria-label="Departments">
    <template v-for="page in departmentPages" :key="page.id">
      <span
        v-if="page.id === current"
        class="icon-button"
        aria-current="page"
        data-test="department"
        :data-tooltip="page.name"
      >
        <FontAwesomeIcon :icon="page.icon" />
        <span class="department-name">{{ page.name }}</span>
      </span>
      <RouterLink
        v-else
        class="icon-button"
        data-test="department"
        :data-tooltip="page.name"
        :to="{ name: page.route, params: { itemId } }"
      >
        <FontAwesomeIcon :icon="page.icon" />
        <span class="department-name">{{ page.name }}</span>
      </RouterLink>
    </template>
  </nav>
</template>
