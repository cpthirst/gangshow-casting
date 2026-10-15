<script setup lang="ts">
import { CastList, CastMember, type CastMemberDetails } from "@app/shared";
import { computed, nextTick, onMounted, ref, useId } from "vue";
import {
  type CastFilters,
  filterCast,
  hasFilters,
  matchesLabel,
  NO_FILTERS,
  sectionLabel,
  sortCast,
} from "../cast.ts";
import CastMemberForm from "./CastMemberForm.vue";

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

/** Screen-reader announcement of the last change to the list. */
const announcement = ref("");
const adding = ref(false);
const saving = ref(false);
const formError = ref("");
const addButton = ref<HTMLButtonElement>();

function startAdding() {
  formError.value = "";
  notice.value = "";
  adding.value = true;
}

async function stopAdding() {
  adding.value = false;
  await nextTick();
  addButton.value?.focus();
}

async function add(details: CastMemberDetails) {
  if (state.value.status !== "loaded" || saving.value) return;
  saving.value = true;
  formError.value = "";
  const result = await postMember(details);
  saving.value = false;
  if (result === "failed") {
    formError.value = "Couldn't add the cast member. Try again.";
    return;
  }
  const name = `${details.firstName} ${details.lastName}`;
  if (result === "saved") {
    // Saved, but the reply couldn't be read: reload rather than invite a duplicate retry.
    await load();
  } else if (state.value.status === "loaded") {
    // Re-checked after the await: the list could have changed while saving.
    const { list } = state.value;
    state.value = { status: "loaded", list: { ...list, members: [...list.members, result] } };
  }
  announcement.value = `${name} added.`;
  await stopAdding();
}

/** Visible message about a conflict or a failed change. */
const notice = ref("");

const fullName = (member: CastMember) => `${member.firstName} ${member.lastName}`;

// Permanent by design (PRD FR5, ADR 0010), so always confirm first, naming the person.
async function deleteMember(member: CastMember) {
  if (saving.value) return;
  if (!window.confirm(`Delete ${fullName(member)} from the cast? This can't be undone.`)) return;
  saving.value = true;
  notice.value = "";
  const status = await sendDelete(member);
  saving.value = false;

  if (status === 204) {
    if (state.value.status === "loaded") {
      const { list } = state.value;
      const members = list.members.filter((m) => m.id !== member.id);
      state.value = { status: "loaded", list: { ...list, members } };
    }
    announcement.value = `${fullName(member)} deleted.`;
    // The row (and its button) is gone, so keep keyboard focus on the page.
    await nextTick();
    addButton.value?.focus();
  } else if (status === 409 || status === 404) {
    notice.value = "Someone else changed this cast member. Showing the latest list.";
    await load();
  } else {
    notice.value = `Couldn't delete ${fullName(member)}. Try again.`;
  }
}

// The status code, or undefined if the request didn't get an answer.
async function sendDelete(member: CastMember) {
  try {
    const url = `${API_PATH}/${member.id}?revision=${member.revision}`;
    return (await fetch(url, { method: "DELETE" })).status;
  } catch {
    return undefined;
  }
}

// 201 → the saved member (or "saved" if its reply can't be read); anything else failed.
async function postMember(details: CastMemberDetails): Promise<CastMember | "saved" | "failed"> {
  try {
    const res = await fetch(API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(details),
    });
    if (res.status !== 201) return "failed";
    const member = CastMember.safeParse(await res.json().catch(() => undefined));
    return member.success ? member.data : "saved";
  } catch {
    return "failed";
  }
}

async function load() {
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
}

onMounted(load);
</script>

<template>
  <h1>Cast</h1>
  <!-- Outside the state switch: a conflict can leave the list empty, and it still needs explaining. -->
  <p v-if="notice" class="notice" role="alert">{{ notice }}</p>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'empty'">No cast members yet.</p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the cast list.</p>
  <template v-else>
    <p class="visually-hidden" role="status" data-test="announcement">{{ announcement }}</p>
    <div class="cast-actions">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-member"
        :disabled="adding"
        @click="startAdding"
      >
        Add cast member
      </button>
    </div>
    <CastMemberForm
      v-if="adding"
      :saving="saving"
      :error="formError"
      @save="add"
      @cancel="stopAdding"
    />
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
            <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
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
            <td class="actions">
              <button
                type="button"
                class="row-action"
                :aria-label="`Delete ${fullName(member)}`"
                :disabled="saving"
                @click="deleteMember(member)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
