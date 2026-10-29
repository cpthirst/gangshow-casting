<script setup lang="ts">
import { DIRECTOR_GROUP, type Permission, permissions } from "@app/shared";
import { computed, useId } from "vue";
import { PERMISSION_NAMES } from "@/utils/accounts.ts";

/**
 * An account's access as a labelled group of tick boxes: Admin, or any mix of the department
 * permissions (production-props FR6). Common, as the local access switch offers it too (FR9).
 */
const { readOnlyHint = "With nothing ticked, the account will be read-only." } = defineProps<{
  legend: string;
  readOnlyHint?: string;
}>();
const admin = defineModel<boolean>("admin", { required: true });
const ticked = defineModel<Permission[]>("permissions", { required: true });

// Director waits for its tick box and confirmation (production-scenery E1.S2). An account
// that has it keeps it, as only the boxes shown are ticked or unticked.
const offered = permissions.filter((permission) => permission !== DIRECTOR_GROUP);

const hintId = `${useId()}-read-only`;
// Nothing ticked is a choice too, so it's said rather than left to be guessed.
const readOnly = computed(() => !admin.value && ticked.value.length === 0);
const describedBy = computed(() => (readOnly.value ? hintId : undefined));
</script>

<template>
  <fieldset class="access-choice">
    <legend>{{ legend }}</legend>
    <label class="checkbox">
      <input
        v-model="admin"
        type="checkbox"
        name="admin"
        :aria-describedby="describedBy"
      />
      <span>Admin</span>
    </label>
    <!-- Admin is everything, so the permissions wait until it's unticked. -->
    <label v-for="permission in offered" :key="permission" class="checkbox">
      <input
        v-model="ticked"
        type="checkbox"
        name="permissions"
        :value="permission"
        :disabled="admin"
        :aria-describedby="describedBy"
      />
      <span>{{ PERMISSION_NAMES[permission] }}</span>
    </label>
    <p v-if="readOnly" :id="hintId" class="hint" data-test="read-only-hint">
      {{ readOnlyHint }}
    </p>
  </fieldset>
</template>
