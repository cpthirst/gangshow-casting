<script setup lang="ts">
import { CastList } from "@app/shared";
import { computed, onMounted, ref, useId } from "vue";
import {
  type CastFilters,
  filterCast,
  hasFilters,
  matchesLabel,
  NO_FILTERS,
  sectionLabel,
  sortCast,
} from "../cast.ts";

// Only one production for now (see docs/product/cast-management/prd.md).
const PRODUCTION_ID = "2027";
const API_PATH = `/api/productions/${PRODUCTION_ID}/cast`;

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; list: CastList };

const state = ref<State>({ status: "loading" });

const members = computed(() =>
  state.value.status === "loaded" ? sortCast(state.value.list.members) : [],
);

// Filtering happens here, in the browser, on the loaded list (PRD FR2).
const filters = ref<CastFilters>({ ...NO_FILTERS });
const filtered = computed(() => hasFilters(filters.value));
const shown = computed(() => filterCast(members.value, filters.value));
const firstNameInput = ref<HTMLInputElement>();
// The Clear button disables itself once nothing is filtered, so hand focus to the first
// filter rather than losing it.
const clearFilters = () => {
  filters.value = { ...NO_FILTERS };
  firstNameInput.value?.focus();
};

const uid = useId();

onMounted(async () => {
  try {
    const res = await fetch(API_PATH);
    if (res.status === 404) {
      state.value = { status: "empty" };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", list: CastList.parse(await res.json()) };
  } catch {
    state.value = { status: "error" };
  }
});
</script>

<template>
  <h1>Cast</h1>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'empty'">No cast members yet.</p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the cast list.</p>
  <template v-else>
    <form class="cast-filters" role="search" aria-label="Filter the cast" @submit.prevent>
      <div class="field">
        <label :for="`${uid}-first`">First name</label>
        <input
          :id="`${uid}-first`"
          ref="firstNameInput"
          v-model="filters.firstName"
          name="firstName"
          type="search"
        />
      </div>
      <div class="field">
        <label :for="`${uid}-last`">Last name</label>
        <input :id="`${uid}-last`" v-model="filters.lastName" name="lastName" type="search" />
      </div>
      <div class="field">
        <label :for="`${uid}-section`">Section</label>
        <select :id="`${uid}-section`" v-model="filters.section" name="section">
          <option value="all">All</option>
          <option value="scouts">Scouts</option>
          <option value="explorers">Explorers</option>
          <option value="network">Network</option>
          <option value="not-set">Not set</option>
        </select>
      </div>
      <button type="button" data-test="clear-filters" :disabled="!filtered" @click="clearFilters">
        Clear filters
      </button>
    </form>
    <!-- A live region, so screen readers hear the new count as the filters change. -->
    <p class="cast-count" data-test="count" role="status">
      {{ matchesLabel(shown.length, members.length, filtered) }}
    </p>
    <p v-if="shown.length === 0">No cast members match these filters.</p>
    <div v-else class="table-scroll" tabindex="0" role="region" aria-label="Cast members">
      <table class="cast-list">
        <thead>
          <tr>
            <th scope="col">First name</th>
            <th scope="col">Last name</th>
            <th scope="col">Section</th>
            <th scope="col">Group</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in shown" :key="member.id">
            <td>{{ member.firstName }}</td>
            <td>{{ member.lastName }}</td>
            <td :class="{ 'not-set': member.section === null }">
              {{ sectionLabel(member.section) }}
            </td>
            <td>{{ member.group }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
