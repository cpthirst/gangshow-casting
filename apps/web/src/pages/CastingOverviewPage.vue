<script setup lang="ts">
import { CastList, type CastMember } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import { CAST_PATH } from "../cast.ts";
import { castBySection, peopleCount } from "../overview.ts";

const state = ref<
  { status: "loading" } | { status: "error" } | { status: "loaded"; cast: CastMember[] }
>({ status: "loading" });

const sections = computed(() =>
  state.value.status === "loaded" ? castBySection(state.value.cast) : [],
);

onMounted(async () => {
  try {
    const res = await fetch(CAST_PATH);
    // No cast list yet: an empty cast, not an error.
    if (res.status === 404) {
      state.value = { status: "loaded", cast: [] };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", cast: CastList.parse(await res.json()).members };
  } catch {
    // A failed load must never look like an empty cast (casting-overview FR8).
    state.value = { status: "error" };
  }
});
</script>

<template>
  <h1>Overview</h1>
  <p>Everyone in the cast, by section, and how much they're cast.</p>
  <p v-if="state.status === 'error'" role="alert">Couldn't load the cast.</p>
  <template v-else-if="state.status === 'loaded'">
    <p v-if="sections.length === 0">No cast members yet.</p>
    <section v-for="section in sections" :key="section.key" class="overview-section">
      <h2 :id="`section-${section.key}`">
        <span class="section-name">{{ section.label }}</span>
        <!-- A real space, so a screen reader hears "Scouts 3 people", not one word. -->
        {{ " " }}
        <span class="section-count">{{ peopleCount(section.members.length) }}</span>
      </h2>
      <!-- Cards like an item's role cards (casting-overview UI consistency). An explicit
           list role: Safari drops list semantics once bullets are styled away. -->
      <ul class="role-cards" role="list" :aria-labelledby="`section-${section.key}`">
        <li v-for="member in section.members" :key="member.id" class="role-card" data-test="person">
          <span class="person-name role-name">{{ member.firstName }} {{ member.lastName }}</span>
        </li>
      </ul>
    </section>
  </template>
</template>
