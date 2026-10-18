<script setup lang="ts">
import type { RunningOrderItem } from "@app/shared";
import { onMounted, ref, useId } from "vue";
import { formFor, type ItemForm, itemFrom, STAGE_CHOICES } from "../running-order.ts";

// addingTo names the half (e.g. "second half") when the item is new rather than edited.
const props = defineProps<{ item: RunningOrderItem; addingTo?: string }>();
const emit = defineEmits<{ apply: [item: RunningOrderItem]; cancel: [] }>();

const form = ref<ItemForm>(formFor(props.item));
const errors = ref<Partial<Record<keyof ItemForm, string>>>({});
// Always offer the item's current stage, even if it's an unusual sequence.
const stageChoices = STAGE_CHOICES.includes(form.value.stage)
  ? STAGE_CHOICES
  : [form.value.stage, ...STAGE_CHOICES];

const uid = useId();
const idFor = (field: keyof ItemForm) => `${uid}-${field}`;
const errorFor = (field: keyof ItemForm) => `${uid}-${field}-error`;
// Wires a field to its error message, if it has one.
const invalid = (field: keyof ItemForm) =>
  errors.value[field] ? { "aria-invalid": true, "aria-describedby": errorFor(field) } : {};

const titleInput = ref<HTMLInputElement>();
onMounted(() => titleInput.value?.focus());

// Escape cancels the edit, except when it's closing the stage list.
function onEscape(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLSelectElement)) emit("cancel");
}

function submit() {
  const result = itemFrom(form.value, props.item.id);
  if (result.ok) emit("apply", result.item);
  else errors.value = result.errors;
}
</script>

<template>
  <form
    data-test="item-editor"
    class="item-editor"
    :aria-label="addingTo ? `Add an item to the ${addingTo}` : `Edit ${item.title}`"
    novalidate
    @submit.prevent="submit"
    @keydown.esc="onEscape"
  >
    <div class="field wide">
      <label :for="idFor('title')">Title</label>
      <input
        :id="idFor('title')"
        ref="titleInput"
        v-model="form.title"
        name="title"
        v-bind="invalid('title')"
      />
      <p v-if="errors.title" :id="errorFor('title')" class="field-error">{{ errors.title }}</p>
    </div>
    <div class="field wide">
      <label :for="idFor('cast')">Cast</label>
      <textarea :id="idFor('cast')" v-model="form.cast" name="cast" rows="2" v-bind="invalid('cast')" />
      <p v-if="errors.cast" :id="errorFor('cast')" class="field-error">{{ errors.cast }}</p>
    </div>
    <div class="field">
      <label :for="idFor('stage')">Stage</label>
      <select :id="idFor('stage')" v-model="form.stage" name="stage" v-bind="invalid('stage')">
        <option v-for="choice in stageChoices" :key="choice" :value="choice">
          {{ choice || "Not set" }}
        </option>
      </select>
      <p v-if="errors.stage" :id="errorFor('stage')" class="field-error">{{ errors.stage }}</p>
    </div>
    <div class="field">
      <label :for="idFor('leads')">Leads</label>
      <input :id="idFor('leads')" v-model="form.leads" name="leads" v-bind="invalid('leads')" />
      <p v-if="errors.leads" :id="errorFor('leads')" class="field-error">{{ errors.leads }}</p>
    </div>
    <div class="field">
      <label :for="idFor('minutes')">Minutes</label>
      <input
        :id="idFor('minutes')"
        v-model="form.minutes"
        name="minutes"
        inputmode="numeric"
        placeholder="Untimed"
        v-bind="invalid('minutes')"
      />
      <p v-if="errors.minutes" :id="errorFor('minutes')" class="field-error">
        {{ errors.minutes }}
      </p>
    </div>
    <div class="field wide">
      <label :for="idFor('comments')">Comments</label>
      <textarea
        :id="idFor('comments')"
        v-model="form.comments"
        name="comments"
        rows="2"
        v-bind="invalid('comments')"
      />
      <p v-if="errors.comments" :id="errorFor('comments')" class="field-error">
        {{ errors.comments }}
      </p>
    </div>
    <div class="field checkbox">
      <input :id="idFor('printed')" v-model="form.printed" type="checkbox" name="printed" />
      <label :for="idFor('printed')">In the printed programme</label>
    </div>
    <div class="editor-actions">
      <button type="submit" class="primary">{{ addingTo ? "Add" : "Apply" }}</button>
      <button type="button" data-test="cancel" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
