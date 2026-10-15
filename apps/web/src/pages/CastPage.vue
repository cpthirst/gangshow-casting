<script setup lang="ts">
import { CastList } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import { countLabel, sectionLabel, sortCast } from "../cast.ts";

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
    <p class="cast-count" data-test="count">{{ countLabel(members.length) }}</p>
    <div class="table-scroll" tabindex="0" role="region" aria-label="Cast members">
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
          <tr v-for="member in members" :key="member.id">
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
