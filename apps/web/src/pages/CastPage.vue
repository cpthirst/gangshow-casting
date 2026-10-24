<script setup lang="ts">
import { CastList, CastMember, type CastMemberDetails, RoleList } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, ref, useId } from "vue";
import HelpButton from "@/components/common/HelpButton.vue";
import ReadOnlyNotice from "@/components/common/ReadOnlyNotice.vue";
import CastMemberForm from "@/components/show/CastMemberForm.vue";
import { apiFetch, isAdmin, isReadOnly } from "@/services/sign-in.ts";
import {
  CAST_PATH,
  type CastFilters,
  deleteWarning,
  filterCast,
  hasFilters,
  matchesLabel,
  NO_FILTERS,
  sectionLabel,
  sortCast,
} from "@/utils/cast.ts";
import { icons } from "@/utils/icons.ts";
import { ROLES_PATH } from "@/utils/roles.ts";

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
/** The member whose edit form is open, if any. One form at a time. */
const editing = ref<CastMember | null>(null);
const saving = ref(false);
// While a form is open or a change is saving, other changes wait.
const busy = computed(() => saving.value || adding.value || editing.value !== null);
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

function startEditing(member: CastMember) {
  formError.value = "";
  notice.value = "";
  editing.value = member;
}

async function stopEditing(id: number) {
  editing.value = null;
  await nextTick();
  // The row may be filtered out of view after a rename; then focus simply stays put.
  document.querySelector<HTMLButtonElement>(`[data-member-id="${id}"] [data-test="edit"]`)?.focus();
}

// Someone else changed or removed the member first: say so and show what's current.
async function showConflict() {
  notice.value = "Someone else changed this cast member. Showing the latest list.";
  await load();
  await nextTick();
  addButton.value?.focus();
}

const saveEdit = (details: CastMemberDetails) => editing.value && update(editing.value, details);
const cancelEdit = () => editing.value && stopEditing(editing.value.id);

// Saves straight away (PRD FR7); refused if someone else changed the member first.
async function update(member: CastMember, details: CastMemberDetails) {
  if (saving.value) return;
  saving.value = true;
  formError.value = "";
  const result = await putMember(member, details);
  saving.value = false;

  if (result === "failed") {
    formError.value = "Couldn't save the changes. Try again.";
    return;
  }
  if (result === "conflict") {
    editing.value = null;
    await showConflict();
    return;
  }
  if (result === "saved") {
    // Saved, but the reply couldn't be read: reload to show what was stored.
    await load();
  } else if (state.value.status === "loaded") {
    const { list } = state.value;
    const members = list.members.map((m) => (m.id === result.id ? result : m));
    state.value = { status: "loaded", list: { ...list, members } };
  }
  announcement.value = `${details.firstName} ${details.lastName} updated.`;
  await stopEditing(member.id);
}

// 200 → the updated member (or "saved" if its reply can't be read); 409/404 → someone
// else changed or removed them; anything else failed.
async function putMember(
  member: CastMember,
  details: CastMemberDetails,
): Promise<CastMember | "saved" | "conflict" | "failed"> {
  try {
    const res = await apiFetch(`${CAST_PATH}/${member.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...details, revision: member.revision }),
    });
    if (res.status === 409 || res.status === 404) return "conflict";
    if (res.status !== 200) return "failed";
    const updated = CastMember.safeParse(await res.json().catch(() => undefined));
    return updated.success ? updated.data : "saved";
  } catch {
    return "failed";
  }
}

// The API refuses non-admins too: this only shows it up front. A refusal anyway means their
// admin role was removed after they signed in.
const ONLY_ADMINS_DELETE = "Only admins can delete cast members";

// Permanent by design (PRD FR5, ADR 0010), so always confirm first, naming the person and
// how many roles they'll leave (casting-roles FR9).
async function deleteMember(member: CastMember) {
  if (busy.value) return;
  // Busy while the roles are counted, so a second click can't open a second confirmation.
  saving.value = true;
  const warning = deleteWarning(fullName(member), await rolesOf(member));
  if (!window.confirm(warning)) {
    saving.value = false;
    return;
  }
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
    await showConflict();
  } else if (status === 403) {
    notice.value = `${ONLY_ADMINS_DELETE}.`;
  } else {
    notice.value = `Couldn't delete ${fullName(member)}. Try again.`;
  }
}

/** How many roles the member is cast in now, or undefined if the roles can't be loaded. */
async function rolesOf(member: CastMember) {
  try {
    const res = await apiFetch(ROLES_PATH);
    if (!res.ok) return undefined;
    const list = RoleList.safeParse(await res.json());
    if (!list.success) return undefined;
    return list.data.roles.filter((role) => role.castMemberIds.includes(member.id)).length;
  } catch {
    return undefined;
  }
}

// The status code, or undefined if the request didn't get an answer.
async function sendDelete(member: CastMember) {
  try {
    const url = `${CAST_PATH}/${member.id}?revision=${member.revision}`;
    return (await apiFetch(url, { method: "DELETE" })).status;
  } catch {
    return undefined;
  }
}

// 201 → the saved member (or "saved" if its reply can't be read); anything else failed.
async function postMember(details: CastMemberDetails): Promise<CastMember | "saved" | "failed"> {
  try {
    const res = await apiFetch(CAST_PATH, {
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
    const res = await apiFetch(CAST_PATH);
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
  <div class="page-title-row">
    <h1>Cast</h1>
    <HelpButton page="cast" />
  </div>
  <!-- Outside the state switch: a conflict can leave the list empty, and it still needs explaining. -->
  <p v-if="notice" class="notice" role="alert">{{ notice }}</p>
  <!-- Above the states, so it explains an empty cast too. -->
  <ReadOnlyNotice />
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'empty'">No cast members yet.</p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the cast list.</p>
  <template v-else>
    <p class="visually-hidden" role="status" data-test="announcement">{{ announcement }}</p>
    <div v-if="!isReadOnly" class="cast-actions">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-member"
        :disabled="busy"
        @click="startAdding"
      >
        Add cast member
      </button>
      <!-- Delete's tooltip says so too, but phones don't show tooltips. -->
      <p v-if="!isAdmin" class="access-note" data-test="admin-only">{{ ONLY_ADMINS_DELETE }}</p>
    </div>
    <CastMemberForm
      v-if="adding"
      :saving="saving"
      :error="formError"
      @save="add"
      @cancel="stopAdding"
    />
    <CastMemberForm
      v-else-if="editing"
      :key="editing.id"
      :member="editing"
      :saving="saving"
      :error="formError"
      @save="saveEdit"
      @cancel="cancelEdit"
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
    <div
      v-else
      class="table-scroll cast-table"
      tabindex="0"
      role="region"
      aria-label="Cast members"
    >
      <table class="cast-list">
        <thead>
          <tr>
            <!-- Icons first, as on the Running order and Items pages. -->
            <th v-if="!isReadOnly" scope="col" class="actions">Actions</th>
            <th scope="col">First name</th>
            <th scope="col">Last name</th>
            <th scope="col">Section</th>
            <th scope="col">Group</th>
            <th scope="col">Singing</th>
            <th scope="col">Acting</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in shown" :key="member.id" :data-member-id="member.id">
            <!-- data-label names each cell when small screens show rows as cards. -->
            <td v-if="!isReadOnly" class="actions row-icons" data-label="Actions">
              <button
                type="button"
                class="icon-button"
                data-test="edit"
                :aria-label="`Edit ${fullName(member)}`"
                data-tooltip="Edit details"
                :disabled="busy"
                @click="startEditing(member)"
              >
                <FontAwesomeIcon :icon="icons.edit" />
              </button>
              <button
                type="button"
                class="icon-button"
                :aria-label="`Delete ${fullName(member)}`"
                :data-tooltip="isAdmin ? 'Delete from the cast' : ONLY_ADMINS_DELETE"
                :disabled="busy || !isAdmin"
                @click="deleteMember(member)"
              >
                <FontAwesomeIcon :icon="icons.remove" />
              </button>
            </td>
            <td class="first-name" data-label="First name">{{ member.firstName }}</td>
            <td class="last-name" data-label="Last name">{{ member.lastName }}</td>
            <td data-label="Section" :class="{ 'not-set': member.section === null }">
              {{ sectionLabel(member.section) }}
            </td>
            <td data-label="Group">{{ member.group }}</td>
            <td data-label="Singing">{{ member.singing }}</td>
            <td data-label="Acting">{{ member.acting }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
