<script setup lang="ts">
import { type AddRoleRequest, RoleSize } from "@app/shared";
import { onMounted, ref, useId } from "vue";
import { type RoleForm, roleDetailsFrom, roleSizeLabel } from "../roles.ts";

defineProps<{ saving: boolean; error: string }>();
const emit = defineEmits<{ save: [details: AddRoleRequest]; cancel: [] }>();

const form = ref<RoleForm>({ name: "", size: "" });
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
  const result = roleDetailsFrom(form.value);
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
    <p v-if="error" class="field-error form-error" role="alert">{{ error }}</p>
    <div class="editor-actions">
      <button type="submit" class="primary" :disabled="saving">Save</button>
      <button type="button" data-test="cancel" :disabled="saving" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
