<script setup lang="ts">
import type { CastMember, CastMemberDetails } from "@app/shared";
import { onMounted, ref, useId } from "vue";
import { type CastForm, castFormFor, detailsFrom } from "../cast.ts";

// Used to add (no member) and, later, to edit (a member) a cast member.
const props = defineProps<{ member?: CastMember; saving: boolean; error: string }>();
const emit = defineEmits<{ save: [details: CastMemberDetails]; cancel: [] }>();

const form = ref<CastForm>(castFormFor(props.member));
const errors = ref<Partial<Record<keyof CastForm, string>>>({});

const uid = useId();
const idFor = (field: keyof CastForm) => `${uid}-${field}`;
const errorFor = (field: keyof CastForm) => `${uid}-${field}-error`;
// Wires a field to its error message, if it has one.
const invalid = (field: keyof CastForm) =>
  errors.value[field] ? { "aria-invalid": true, "aria-describedby": errorFor(field) } : {};

const firstNameInput = ref<HTMLInputElement>();
onMounted(() => firstNameInput.value?.focus());

// Escape cancels, except when it's closing the section list.
function onEscape(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLSelectElement)) emit("cancel");
}

function submit() {
  const result = detailsFrom(form.value);
  errors.value = result.ok ? {} : result.errors;
  if (result.ok) emit("save", result.details);
}
</script>

<template>
  <form
    data-test="cast-member-form"
    class="cast-member-form"
    :aria-label="member ? `Edit ${member.firstName} ${member.lastName}` : 'Add cast member'"
    novalidate
    @submit.prevent="submit"
    @keydown.esc="onEscape"
  >
    <div class="field">
      <label :for="idFor('firstName')">First name</label>
      <input
        :id="idFor('firstName')"
        ref="firstNameInput"
        v-model="form.firstName"
        name="firstName"
        autocomplete="off"
        v-bind="invalid('firstName')"
      />
      <p v-if="errors.firstName" :id="errorFor('firstName')" class="field-error">
        {{ errors.firstName }}
      </p>
    </div>
    <div class="field">
      <label :for="idFor('lastName')">Last name</label>
      <input
        :id="idFor('lastName')"
        v-model="form.lastName"
        name="lastName"
        autocomplete="off"
        v-bind="invalid('lastName')"
      />
      <p v-if="errors.lastName" :id="errorFor('lastName')" class="field-error">
        {{ errors.lastName }}
      </p>
    </div>
    <div class="field">
      <label :for="idFor('section')">Section</label>
      <select :id="idFor('section')" v-model="form.section" name="section">
        <option value="">Not set</option>
        <option value="scouts">Scouts</option>
        <option value="explorers">Explorers</option>
        <option value="network">Network</option>
      </select>
    </div>
    <div class="field">
      <label :for="idFor('group')">Group</label>
      <input
        :id="idFor('group')"
        v-model="form.group"
        name="group"
        autocomplete="off"
        v-bind="invalid('group')"
      />
      <p v-if="errors.group" :id="errorFor('group')" class="field-error">{{ errors.group }}</p>
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
