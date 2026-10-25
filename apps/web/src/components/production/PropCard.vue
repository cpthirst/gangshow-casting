<script setup lang="ts">
import type { CastMember, Prop, Role } from "@app/shared";
import { computed } from "vue";
import { rolesOf } from "@/utils/props.ts";
import { castNames } from "@/utils/roles.ts";

// One prop on its item's props page, styled as a role card (stage-props FR18): its roles,
// each with who plays it now, from the casting. roles and cast: the production's.
const props = defineProps<{ prop: Prop; roles: Role[]; cast: CastMember[] }>();

const linked = computed(() =>
  rolesOf(props.prop, props.roles).map((role) => ({ role, cast: castNames(role, props.cast) })),
);
</script>

<template>
  <li class="role-card" :data-prop-id="prop.id" data-test="prop">
    <span class="role-name" data-test="prop-name">{{ prop.name }}</span>
    <ul v-if="linked.length > 0" class="prop-roles" role="list" :aria-label="`Roles for ${prop.name}`">
      <li v-for="{ role, cast: names } in linked" :key="role.id" data-test="prop-role">
        <span class="role-name" data-test="prop-role-name">{{ role.name }}</span>
        <!-- Real spaces, so a screen reader hears "Parrot Uncast", not one word. -->
        {{ " " }}
        <span v-if="names" class="role-cast" data-test="cast">{{ names }}</span>
        <span v-else class="uncast" data-test="uncast">Uncast</span>
      </li>
    </ul>
  </li>
</template>
