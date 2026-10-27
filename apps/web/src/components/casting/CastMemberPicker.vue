<script setup lang="ts">
import type { CastMember } from "@app/shared";
import { computed } from "vue";
import SearchPicker from "@/components/common/SearchPicker.vue";
import { searchCast, sectionLabel } from "@/utils/cast.ts";
import type { CastMemberChoice } from "@/utils/roles.ts";

// A cast member field, searched by first or last name. The text alone never casts anyone.
const props = withDefaults(
  defineProps<{
    cast: CastMember[];
    inputId: string;
    describedBy?: string | undefined;
    hintId?: string | undefined;
    disabled?: boolean;
    name?: string;
  }>(),
  { name: "castMember" },
);
const choice = defineModel<CastMemberChoice>({ required: true });

/** "Scouts · 1st Somewhere": what tells two people with the same name apart. */
const detailsOf = (member: CastMember) =>
  [member.section && sectionLabel(member.section), member.group].filter(Boolean).join(" · ");

const matches = computed(() =>
  searchCast(props.cast, choice.value.query).map((member) => ({
    id: member.id,
    name: `${member.firstName} ${member.lastName}`,
    details: detailsOf(member),
  })),
);
</script>

<template>
  <SearchPicker
    v-model="choice"
    :matches="matches"
    noun="cast member"
    :name="name"
    :input-id="inputId"
    :described-by="describedBy"
    :hint-id="hintId"
    :disabled="disabled"
  />
</template>
