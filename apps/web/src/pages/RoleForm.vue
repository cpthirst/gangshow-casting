<script setup lang="ts">
import { type AddRoleRequest, type CastMember, RoleSize } from "@app/shared";
import { onMounted, ref, useId } from "vue";
import { type RoleForm, roleDetailsFrom, roleSizeLabel, type TakenNames } from "../roles.ts";
import CastMemberPicker from "./CastMemberPicker.vue";

// taken: the item's existing role names, which a new role can't repeat.
// cast: the production's cast, to choose who plays the part.
const props = defineProps<{
  saving: boolean;
  error: string;
  taken: TakenNames;
  cast: CastMember[];
}>();
const emit = defineEmits<{ save: [details: AddRoleRequest]; cancel: [] }>();

const form = ref<RoleForm>({ name: "", size: "", castMember: { query: "", id: null } });
const errors = ref<Partial<Record<keyof RoleForm, string>>>({});

const uid = useId();
const idFor = (field: keyof RoleForm) => `${uid}-${field}`;
const errorFor = (field: keyof RoleForm) => `${uid}-${field}-error`;
// Wires a field to its error message, if it has one.
const invalid = (field: keyof RoleForm) =>
  errors.value[field] ? { "aria-invalid": true, "aria-describedby": errorFor(field) } : {};

const nameInput = ref<HTMLInputElement>();
onMounted(() => nameInput.value?.focus());

// Escape cancels, except when it's closing the size list.
function onEscape(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLSelectElement)) emit("cancel");
}

function submit() {
  const result = roleDetailsFrom(form.value, props.taken);
  errors.value = result.ok ? {} : result.errors;
  if (result.ok) emit("save", result.details);
}
</script>

<template>
  <form
    class="cast-member-form"
    aria-label="Add role"
    novalidate
    @submit.prevent="submit"
    @keydown.esc="onEscape"
  >
    <div class="field">
      <label :for="idFor('name')">Role name</label>
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
      <label :for="idFor('size')">Role size</label>
      <select :id="idFor('size')" v-model="form.size" name="size" v-bind="invalid('size')">
        <option value="">Choose…</option>
        <option v-for="size in RoleSize.options" :key="size" :value="size">
          {{ roleSizeLabel(size) }}
        </option>
      </select>
      <p v-if="errors.size" :id="errorFor('size')" class="field-error">{{ errors.size }}</p>
    </div>
    <div class="field">
      <label :for="idFor('castMember')">Cast member <span class="optional">(optional)</span></label>
      <CastMemberPicker
        v-model="form.castMember"
        :cast="cast"
        :input-id="idFor('castMember')"
        :described-by="errors.castMember ? errorFor('castMember') : undefined"
      />
      <p v-if="errors.castMember" :id="errorFor('castMember')" class="field-error">
        {{ errors.castMember }}
      </p>
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
