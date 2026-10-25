<script setup lang="ts">
import type { Prop } from "@app/shared";

// One prop on its item's props page, styled as a role card (stage-props FR18).
defineProps<{ prop: Prop }>();
</script>

<template>
  <li class="role-card" :data-prop-id="prop.id" data-test="prop">
    <span class="role-name" data-test="prop-name">{{ prop.name }}</span>
  </li>
</template>
