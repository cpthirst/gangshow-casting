<script setup lang="ts">
import type { AddPropRequest } from "@app/shared";
import { onMounted, ref, useId } from "vue";
import { type PropFormFields, propDetailsFrom } from "@/utils/props.ts";

// Adds a prop to an item, like the Add role form. error: why the last save failed, if it did.
defineProps<{ saving: boolean; error: string }>();
const emit = defineEmits<{ save: [details: AddPropRequest]; cancel: [] }>();

const form = ref<PropFormFields>({ name: "" });
const errors = ref<Partial<Record<keyof PropFormFields, string>>>({});

const uid = useId();
const idFor = (field: keyof PropFormFields) => `${uid}-${field}`;
const errorFor = (field: keyof PropFormFields) => `${uid}-${field}-error`;
// Wires a field to its error message, if it has one.
const invalid = (field: keyof PropFormFields) =>
  errors.value[field] ? { "aria-invalid": true, "aria-describedby": errorFor(field) } : {};

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
    aria-label="Add prop"
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
    <p v-if="error" class="field-error form-error" role="alert">{{ error }}</p>
    <div class="editor-actions">
      <button type="submit" class="primary" :disabled="saving">Save</button>
      <button type="button" data-test="cancel" :disabled="saving" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
