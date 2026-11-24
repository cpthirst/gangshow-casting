<script setup lang="ts">
import type { CostumeFields } from "@app/shared";
import { onMounted, ref } from "vue";
import FormActions from "@/components/common/FormActions.vue";
import { controlOf } from "@/composables/useConfirm.ts";
import { useFieldIds } from "@/composables/useFieldIds.ts";
import { charactersLeft } from "@/utils/characters-left.ts";
import { COSTUME_RULE, type CostumeCopy, costumeErrors, costumeFields } from "@/utils/costumes.ts";

// One costume row's three fields, edited together in the row, as a prop card holds its form
// (production-costume-sheets FR5, FR6). name: whose row it is, "Alex Morgan as Captain Hook";
// error: why the last save failed, if it did; copies: the ways it can be copied to the item's
// other rows (FR16). While a save or copy is on its way, Escape waits, as Cancel does.
const props = defineProps<{
  name: string;
  costume: CostumeFields;
  saving: boolean;
  error: string;
  copies: CostumeCopy[];
}>();
const emit = defineEmits<{
  save: [fields: CostumeFields];
  copy: [copy: CostumeCopy, fields: CostumeFields, from: HTMLElement | undefined];
  cancel: [];
}>();

const form = ref<CostumeFields>({
  fromWardrobe: props.costume.fromWardrobe,
  fromCastMember: props.costume.fromCastMember,
  notes: props.costume.notes,
});
const errors = ref<Partial<Record<keyof CostumeFields, string>>>({});
const { idFor, errorFor } = useFieldIds(errors);
const countFor = (field: keyof CostumeFields) => `${idFor(field)}-count`;
/** A field's description: how many characters are left, near the limit, and its error. */
const describedBy = (field: keyof CostumeFields) =>
  [charactersLeft(form.value[field]) && countFor(field), errors.value[field] && errorFor(field)]
    .filter(Boolean)
    .join(" ") || undefined;

// By id rather than a template ref: the fields come from one v-for, so the first is found by
// the id its label points to.
onMounted(() => document.getElementById(idFor(costumeFields[0].key))?.focus());

/** Whether the fields can be saved, saying under each one that can't why not. */
function valid() {
  errors.value = costumeErrors(form.value);
  return Object.keys(errors.value).length === 0;
}

function submit() {
  if (valid()) emit("save", form.value);
}

function copy(chosen: CostumeCopy, event: Event) {
  const from = controlOf(event);
  if (valid()) emit("copy", chosen, form.value, from);
}
</script>

<template>
  <form
    class="form"
    :aria-label="`Edit ${name}`"
    :aria-busy="saving"
    novalidate
    @submit.prevent="submit"
    @keydown.esc="saving || emit('cancel')"
  >
    <div v-for="{ key, label } in costumeFields" :key="key" class="field">
      <label :for="idFor(key)">{{ label }}</label>
      <textarea
        :id="idFor(key)"
        v-model="form[key]"
        :name="key"
        rows="2"
        :aria-invalid="errors[key] ? true : undefined"
        :aria-describedby="describedBy(key)"
      />
      <p v-if="charactersLeft(form[key])" :id="countFor(key)" class="characters-left">
        {{ charactersLeft(form[key]) }}
      </p>
      <p v-if="errors[key]" :id="errorFor(key)" class="field-error">{{ errors[key] }}</p>
    </div>
    <p class="form-rule" data-test="costume-rule">{{ COSTUME_RULE }}</p>
    <FormActions :saving="saving" :error="error" @cancel="emit('cancel')">
      <button
        v-for="chosen in copies"
        :key="chosen.label"
        type="button"
        :disabled="saving"
        @click="copy(chosen, $event)"
      >
        {{ chosen.label }}
      </button>
    </FormActions>
  </form>
</template>
