<script setup lang="ts">
import type { CastMember } from "@app/shared";
import { computed, ref, useId, watch } from "vue";
import { searchCast, sectionLabel } from "@/utils/cast.ts";
import type { CastMemberChoice } from "@/utils/roles.ts";

// A text-filterable cast member field: the WAI-ARIA combobox pattern (an input that
// controls a listbox). The text alone never casts anyone; a choice must be made.
const props = defineProps<{
  cast: CastMember[];
  inputId: string;
  describedBy?: string | undefined;
}>();
const choice = defineModel<CastMemberChoice>({ required: true });

const uid = useId();
const listId = `${uid}-list`;
const optionId = (index: number) => `${uid}-option-${index}`;

const fullName = (member: CastMember) => `${member.firstName} ${member.lastName}`;

/** "Scouts · 1st Somewhere": what tells two people with the same name apart. */
const detailsOf = (member: CastMember) =>
  [member.section && sectionLabel(member.section), member.group].filter(Boolean).join(" · ");

const matches = computed(() => searchCast(props.cast, choice.value.query));
// Open while someone is typing and hasn't chosen yet; the list shows only if anyone matches.
const open = ref(false);
const listVisible = computed(() => open.value && matches.value.length > 0);
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

function choose(member: CastMember) {
  choice.value = { query: fullName(member), id: member.id };
  open.value = false;
  active.value = -1;
}

function move(step: 1 | -1) {
  // The arrows reopen a list closed by Escape, as the combobox pattern expects.
  open.value = choice.value.id === null && choice.value.query.trim() !== "";
  if (!listVisible.value) return;
  const last = matches.value.length - 1;
  active.value =
    active.value < 0 && step === -1 ? last : Math.min(Math.max(active.value + step, 0), last);
}

// Enter on a highlighted choice picks it, rather than saving the form.
function onEnter(event: KeyboardEvent) {
  const member = matches.value[active.value];
  if (!listVisible.value || !member) return;
  event.preventDefault();
  choose(member);
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
      name="castMember"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="listVisible"
      :aria-controls="listId"
      :aria-activedescendant="activeId"
      :aria-describedby="describedBy"
      :aria-invalid="describedBy ? true : undefined"
      :value="choice.query"
      @input="onInput"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
      @blur="open = false"
    />
    <ul v-show="listVisible" :id="listId" role="listbox" aria-label="Cast members">
      <!-- mousedown, not click: it fires before the input's blur closes the list. -->
      <li
        v-for="(member, index) in matches"
        :id="optionId(index)"
        :key="member.id"
        role="option"
        :aria-selected="index === active"
        :class="{ active: index === active }"
        @mousedown.prevent="choose(member)"
      >
        <span class="choice-name">{{ fullName(member) }}</span>
        {{ " " }}
        <span v-if="detailsOf(member)" class="choice-details">{{ detailsOf(member) }}</span>
      </li>
    </ul>
    <!-- One live region: "No cast members match" is seen and heard once; a count is heard. -->
    <p class="combobox-status" role="status">
      <span v-if="open && matches.length === 0" class="combobox-empty">No cast members match</span>
      <span v-else-if="open" class="visually-hidden">
        {{ matches.length }} cast member{{ matches.length === 1 ? "" : "s" }} match
      </span>
    </p>
  </div>
</template>
