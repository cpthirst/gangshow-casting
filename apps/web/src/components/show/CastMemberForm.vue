<script setup lang="ts">
import { type CastMember, type CastMemberDetails, Section } from "@app/shared";
import { onMounted, ref } from "vue";
import FormActions from "@/components/common/FormActions.vue";
import { controlOf } from "@/composables/useConfirm.ts";
import { useFieldIds } from "@/composables/useFieldIds.ts";
import { type CastForm, castFormFor, detailsFrom, sectionLabel } from "@/utils/cast.ts";

// Adds a cast member (no member given) or edits one (member given; its ID is fixed).
const props = defineProps<{ member?: CastMember; saving: boolean; error: string }>();
// Save comes with the button it was submitted with, for a confirmation to give focus back to.
const emit = defineEmits<{
  save: [details: CastMemberDetails, saveButton: HTMLElement | undefined];
  cancel: [];
}>();

const form = ref<CastForm>(castFormFor(props.member));
const errors = ref<Partial<Record<keyof CastForm, string>>>({});

const { idFor, errorFor, invalid } = useFieldIds(errors);

const firstNameInput = ref<HTMLInputElement>();
onMounted(() => firstNameInput.value?.focus());

// Escape cancels, except when it's closing the section list.
function onEscape(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLSelectElement)) emit("cancel");
}

function submit(event: Event) {
  const result = detailsFrom(form.value);
  errors.value = result.ok ? {} : result.errors;
  if (result.ok) emit("save", result.details, controlOf(event));
}
</script>

<template>
  <form
    data-test="cast-member-form"
    class="form"
    :aria-label="member ? `Edit ${member.firstName} ${member.lastName}` : 'Add cast member'"
    novalidate
    @submit.prevent="submit"
    @keydown.esc="onEscape"
  >
    <p v-if="member" class="member-id" data-test="member-id">ID {{ member.id }}</p>
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
        <option v-for="choice in Section.options" :key="choice" :value="choice">
          {{ sectionLabel(choice) }}
        </option>
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
    <div class="field">
      <label :for="idFor('singing')">Singing</label>
      <input
        :id="idFor('singing')"
        v-model="form.singing"
        name="singing"
        autocomplete="off"
        v-bind="invalid('singing')"
      />
      <p v-if="errors.singing" :id="errorFor('singing')" class="field-error">{{ errors.singing }}</p>
    </div>
    <div class="field">
      <label :for="idFor('acting')">Acting</label>
      <input
        :id="idFor('acting')"
        v-model="form.acting"
        name="acting"
        autocomplete="off"
        v-bind="invalid('acting')"
      />
      <p v-if="errors.acting" :id="errorFor('acting')" class="field-error">{{ errors.acting }}</p>
    </div>
    <FormActions :saving="saving" :error="error" @cancel="emit('cancel')" />
  </form>
</template>
