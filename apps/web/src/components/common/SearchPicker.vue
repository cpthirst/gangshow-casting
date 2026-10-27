<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";

/** One thing that can be chosen: its name, and what tells it apart from others like it. */
interface PickerOption {
  id: number;
  name: string;
  details: string;
  /** Already chosen, so choosing it again takes it off, as in a prop's carriers. */
  chosen?: boolean;
}

// A text-filterable field: the WAI-ARIA combobox pattern (an input that controls a listbox).
// The text alone never chooses anything; a choice must be made.
// matches: the options the text typed so far matches, in the order to offer them.
// noun: what's being chosen, e.g. "cast member", for the list's name and its status.
// describedBy: the field's error, if it has one. hintId: a hint that describes it, not an
// error. disabled: nothing can be chosen for now.
const props = defineProps<{
  matches: PickerOption[];
  noun: string;
  name: string;
  inputId: string;
  describedBy?: string | undefined;
  hintId?: string | undefined;
  disabled?: boolean;
}>();
const choice = defineModel<{ query: string; id: number | null }>({ required: true });

const uid = useId();
const listId = `${uid}-list`;
const optionId = (index: number) => `${uid}-option-${index}`;

const plural = (count: number) => `${props.noun}${count === 1 ? "" : "s"}`;
const listLabel = computed(() => `${props.noun.charAt(0).toUpperCase()}${props.noun.slice(1)}s`);

// Open while someone is typing and hasn't chosen yet; the list shows only if anything matches.
const open = ref(false);
const listVisible = computed(() => open.value && props.matches.length > 0);
const active = ref(-1);
const activeId = computed(() =>
  listVisible.value && active.value >= 0 ? optionId(active.value) : undefined,
);

// Keyboard users see the highlighted choice even in a long, scrolling list.
watch(active, (index) => {
  document.getElementById(optionId(index))?.scrollIntoView?.({ block: "nearest" });
});

function onInput(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  // Changing the text undoes any earlier choice.
  choice.value = { query: event.target.value, id: null };
  open.value = event.target.value.trim() !== "";
  active.value = -1;
}

function choose(option: PickerOption) {
  choice.value = { query: option.name, id: option.id };
  open.value = false;
  active.value = -1;
}

function move(step: 1 | -1) {
  // The arrows reopen a list closed by Escape, as the combobox pattern expects.
  open.value = choice.value.id === null && choice.value.query.trim() !== "";
  if (!listVisible.value) return;
  const last = props.matches.length - 1;
  active.value =
    active.value < 0 && step === -1 ? last : Math.min(Math.max(active.value + step, 0), last);
}

// Enter on a highlighted choice picks it, rather than saving the form.
function onEnter(event: KeyboardEvent) {
  const option = props.matches[active.value];
  if (!listVisible.value || !option) return;
  event.preventDefault();
  choose(option);
}

// Escape closes an open list without cancelling the whole form.
function onEscape(event: KeyboardEvent) {
  if (!open.value) return;
  event.stopPropagation();
  open.value = false;
}
</script>

<template>
  <div class="combobox">
    <input
      :id="inputId"
      :name="name"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="listVisible"
      :aria-controls="listId"
      :aria-activedescendant="activeId"
      :aria-describedby="[describedBy, hintId].filter(Boolean).join(' ') || undefined"
      :aria-invalid="describedBy ? true : undefined"
      :value="choice.query"
      :disabled="disabled"
      @input="onInput"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
      @blur="open = false"
    />
    <ul v-show="listVisible" :id="listId" role="listbox" :aria-label="listLabel">
      <!-- mousedown, not click: it fires before the input's blur closes the list. -->
      <li
        v-for="(option, index) in matches"
        :id="optionId(index)"
        :key="option.id"
        role="option"
        :aria-selected="index === active"
        :class="{ active: index === active }"
        @mousedown.prevent="choose(option)"
      >
        <span v-if="option.chosen" class="choice-chosen"
          ><span aria-hidden="true">✓</span><span class="visually-hidden">Chosen:</span></span
        >
        <span class="choice-name">{{ option.name }}</span>
        {{ " " }}
        <span v-if="option.details" class="choice-details">{{ option.details }}</span>
      </li>
    </ul>
    <!-- One live region: "No {noun}s match" is seen and heard once; a count is heard. -->
    <p class="combobox-status" role="status">
      <span v-if="open && matches.length === 0" class="combobox-empty"
        >No {{ plural(0) }} match</span
      >
      <span v-else-if="open" class="visually-hidden">
        {{ matches.length }} {{ plural(matches.length) }} match
      </span>
    </p>
  </div>
</template>
