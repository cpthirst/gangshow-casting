<script setup lang="ts">
import type { AddPropRequest, CastMember, Prop, Role } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, ref, useId, watch } from "vue";
import SearchPicker from "@/components/common/SearchPicker.vue";
import { icons } from "@/utils/icons.ts";
import { type PropFormFields, propDetailsFrom } from "@/utils/props.ts";
import { castNames, searchRoles, sortRoles } from "@/utils/roles.ts";

// Adds a prop to an item (no prop given) or edits one, like the role form. error: why the
// last save failed, if it did. roles: the item's roles, which the prop can be linked to;
// cast: who plays them.
const props = defineProps<{
  saving: boolean;
  error: string;
  roles: Role[];
  cast: CastMember[];
  prop?: Prop | undefined;
}>();
const emit = defineEmits<{ save: [details: AddPropRequest]; cancel: [] }>();

const form = ref<PropFormFields>({
  name: props.prop?.name ?? "",
  quantity: String(props.prop?.quantity ?? 1),
  role: { query: "", id: null },
  // Only roles the item still has: a removed role's lingering id isn't carried into the save.
  roleIds: props.roles
    .filter((role) => props.prop?.roleIds.includes(role.id))
    .map((role) => role.id),
});
const errors = ref<Partial<Record<keyof PropFormFields, string>>>({});

const uid = useId();
const idFor = (field: keyof PropFormFields) => `${uid}-${field}`;
const errorFor = (field: keyof PropFormFields) => `${uid}-${field}-error`;
// Wires a field to its error message, if it has one.
const invalid = (field: keyof PropFormFields) =>
  errors.value[field] ? { "aria-invalid": true, "aria-describedby": errorFor(field) } : {};

// The roles are picked as an ensemble's members are: search, choose, and each picked role
// is listed with a button to drop it (production-props FR18).
const picked = computed(() =>
  sortRoles(props.roles.filter((role) => form.value.roleIds.includes(role.id))),
);
/** Each role can be picked once; the search offers the rest, with who plays them. */
const roleMatches = computed(() =>
  searchRoles(
    props.roles.filter((role) => !form.value.roleIds.includes(role.id)),
    form.value.role.query,
  ).map((role) => ({
    id: role.id,
    name: role.name,
    details: castNames(role, props.cast) || "Uncast",
  })),
);

/** Screen-reader announcement of the last role picked or dropped. */
const announcement = ref("");
const nameOf = (id: number) => props.roles.find((role) => role.id === id)?.name ?? "";

// Choosing a role in the search picks it, ready for the next.
watch(
  () => form.value.role.id,
  (id) => {
    if (id === null) return;
    form.value.roleIds = [...form.value.roleIds, id];
    form.value.role = { query: "", id: null };
    announcement.value = `Added ${nameOf(id)}.`;
  },
);

// The Remove button disappears with the role, so focus moves to the search.
async function dropRole(id: number) {
  form.value.roleIds = form.value.roleIds.filter((roleId) => roleId !== id);
  announcement.value = `Removed ${nameOf(id)}.`;
  await nextTick();
  document.getElementById(idFor("role"))?.focus();
}

const nameInput = ref<HTMLInputElement>();
onMounted(() => nameInput.value?.focus());

function submit() {
  const result = propDetailsFrom(form.value);
  errors.value = result.ok ? {} : result.errors;
  if (result.ok) emit("save", result.details);
}
</script>

<template>
  <form
    class="cast-member-form"
    :aria-label="prop ? `Edit ${prop.name}` : 'Add prop'"
    novalidate
    @submit.prevent="submit"
    @keydown.esc="emit('cancel')"
  >
    <div class="field">
      <label :for="idFor('name')">Prop name</label>
      <input
        :id="idFor('name')"
        ref="nameInput"
        v-model="form.name"
        name="name"
        autocomplete="off"
        v-bind="invalid('name')"
      />
      <p v-if="errors.name" :id="errorFor('name')" class="field-error">{{ errors.name }}</p>
    </div>
    <div class="field">
      <label :for="idFor('quantity')">Quantity</label>
      <input
        :id="idFor('quantity')"
        v-model="form.quantity"
        name="quantity"
        inputmode="numeric"
        autocomplete="off"
        v-bind="invalid('quantity')"
      />
      <p v-if="errors.quantity" :id="errorFor('quantity')" class="field-error">
        {{ errors.quantity }}
      </p>
    </div>
    <div class="field">
      <label :for="idFor('role')">Add a role</label>
      <SearchPicker
        v-model="form.role"
        :matches="roleMatches"
        noun="role"
        name="role"
        :input-id="idFor('role')"
        :described-by="errors.role ? errorFor('role') : undefined"
      />
      <p v-if="errors.role" :id="errorFor('role')" class="field-error">{{ errors.role }}</p>
      <div class="members-block">
        <p :id="idFor('roleIds')" class="field-label">Roles</p>
        <ul class="members row-icons" :aria-labelledby="idFor('roleIds')">
          <li v-for="role in picked" :key="role.id" data-test="picked-role">
            <button
              type="button"
              class="icon-button"
              :aria-label="`Remove ${role.name} from the prop`"
              data-tooltip="Remove from the prop"
              @click="dropRole(role.id)"
            >
              <FontAwesomeIcon :icon="icons.remove" />
            </button>
            <span class="member-name">{{ role.name }}</span>
          </li>
          <li v-if="picked.length === 0" class="uncast">None yet</li>
        </ul>
        <p class="visually-hidden" role="status">{{ announcement }}</p>
      </div>
    </div>
    <p v-if="error" class="field-error form-error" role="alert">{{ error }}</p>
    <div class="editor-actions">
      <button type="submit" class="primary" :disabled="saving">Save</button>
      <button type="button" data-test="cancel" :disabled="saving" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
