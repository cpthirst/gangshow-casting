<script setup lang="ts">
import type { CastMember, Prop, Role } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed } from "vue";
import { icons } from "@/utils/icons.ts";
import { rolesOf } from "@/utils/props.ts";
import { castNames } from "@/utils/roles.ts";

// One prop on its item's props page, styled as a role card (production-props FR18): its roles,
// each with who plays it now, from the casting. roles and cast: the production's.
// canChange: shows the pencil and trash can (production-props FR19); busy: disables them.
const props = defineProps<{
  prop: Prop;
  roles: Role[];
  cast: CastMember[];
  canChange: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{ edit: []; remove: [] }>();

const linked = computed(() =>
  rolesOf(props.prop, props.roles).map((role) => ({ role, cast: castNames(role, props.cast) })),
);
</script>

<template>
  <li class="role-card" :data-prop-id="prop.id" data-test="prop">
    <!-- Icons first, as on the role cards; above the prop on phones. -->
    <span v-if="canChange" class="role-actions row-icons">
      <button
        type="button"
        class="icon-button"
        data-test="edit"
        :aria-label="`Edit ${prop.name}`"
        data-tooltip="Edit prop"
        :disabled="busy"
        @click="emit('edit')"
      >
        <FontAwesomeIcon :icon="icons.edit" />
      </button>
      <button
        type="button"
        class="icon-button"
        data-test="remove"
        :aria-label="`Remove ${prop.name}`"
        data-tooltip="Remove prop"
        :disabled="busy"
        @click="emit('remove')"
      >
        <FontAwesomeIcon :icon="icons.remove" />
      </button>
    </span>
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
