<script setup lang="ts">
import type { CastMember, Prop, Role } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed } from "vue";
import { icons } from "@/utils/icons.ts";
import { carryingOf } from "@/utils/props.ts";

// One prop on its item's props page, styled as a role card (production-props FR18): its roles,
// each with who carries it from the casting now, how many are left to choose (FR26), and how
// many aren't given to anyone (FR27).
// roles and cast: the production's.
// canChange: shows the pencil and trash can (production-props FR19); busy: disables them.
const props = defineProps<{
  prop: Prop;
  roles: Role[];
  cast: CastMember[];
  canChange: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{ edit: []; remove: [] }>();

const carrying = computed(() => carryingOf(props.prop, props.roles, props.cast));
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
    <!-- A pill, like a role's size. The "×" is read out, not hidden, and the real space
         keeps it a word apart, so a screen reader hears "Umbrella times 10". A quantity of 1
         isn't shown (production-props FR24). -->
    <template v-if="prop.quantity > 1">
      {{ " " }}<span class="pill pill-quantity" data-test="quantity">×{{ prop.quantity }}</span>
    </template>
    <ul
      v-if="carrying.roles.length > 0"
      class="prop-roles"
      role="list"
      :aria-label="`Roles for ${prop.name}`"
    >
      <li v-for="{ role, carriers, none } in carrying.roles" :key="role.id" data-test="prop-role">
        <span class="role-name" data-test="prop-role-name">{{ role.name }}</span>
        <!-- Real spaces, so a screen reader hears "Parrot Uncast", not one word. -->
        {{ " " }}
        <span v-if="carriers" class="role-cast" data-test="cast">{{ carriers }}</span>
        <span v-else class="uncast" data-test="uncast">{{ none }}</span>
      </li>
    </ul>
    <p v-if="carrying.toChoose > 0" class="prop-to-choose" data-test="to-choose">
      {{ carrying.toChoose }} left to choose
    </p>
    <p v-if="carrying.notGiven > 0" class="prop-to-choose" data-test="not-given">
      {{ carrying.notGiven }} not given to anyone
    </p>
  </li>
</template>
