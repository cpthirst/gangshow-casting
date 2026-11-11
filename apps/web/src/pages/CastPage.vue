<script setup lang="ts">
import {
  CastList,
  CastMember,
  type CastMemberDetails,
  Gang,
  gangLabels,
  gangOf,
  RoleList,
  RunningOrder,
  Section,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, onMounted, ref, useId } from "vue";
import PageTitle from "@/components/common/PageTitle.vue";
import RefusalNotice from "@/components/common/RefusalNotice.vue";
import CastMemberForm from "@/components/show/CastMemberForm.vue";
import { controlOf, useConfirm } from "@/composables/useConfirm.ts";
import { useListEditing } from "@/composables/useListEditing.ts";
import { loadData } from "@/services/load-data.ts";
import { castPath, rolesPath, runningOrderPath } from "@/services/production.ts";
import { canChange, deleteStatus, sendJson } from "@/services/sign-in.ts";
import {
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
import { sectionChangeWarning } from "@/utils/running-order.ts";

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; list: CastList };

const state = ref<State>({ status: "loading" });
const askToConfirm = useConfirm();

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
const {
  adding,
  addButton,
  editing,
  saving,
  formError,
  notice,
  busy,
  startAdding,
  stopAdding,
  startEditing,
  stopEditing,
  focusAddButton,
} = useListEditing<CastMember>("data-member-id");

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

const fullName = (member: CastMember) => `${member.firstName} ${member.lastName}`;

// Someone else changed or removed the member first: say so and show what's current.
async function showConflict() {
  notice.value = "Someone else changed this cast member. Showing the latest list.";
  await load();
  await focusAddButton();
}

const saveEdit = (details: CastMemberDetails, saveButton: HTMLElement | undefined) =>
  editing.value && update(editing.value, details, saveButton);
const cancelEdit = () => editing.value && stopEditing(editing.value.id);

// Saves straight away (PRD FR7); refused if someone else changed the member first.
async function update(
  member: CastMember,
  details: CastMemberDetails,
  saveButton: HTMLElement | undefined,
) {
  if (saving.value) return;
  formError.value = "";
  // Going back saves nothing and keeps the form as it is.
  if (!(await confirmSectionChange(member, details, saveButton))) return;
  saving.value = true;
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

/** Whether to go ahead with a save that moves them to another gang, taking them out of the
 *  roles of items not for it (junior-cast FR12). Nothing to ask unless they leave a role. */
async function confirmSectionChange(
  member: CastMember,
  details: CastMemberDetails,
  saveButton: HTMLElement | undefined,
) {
  if (gangOf(member.section) === gangOf(details.section)) return true;
  // Saving while the roles are counted, so a second Save waits, but not while asking:
  // the dialog gives focus back to Save, which saving disables.
  saving.value = true;
  const casting = await roleCastingNow();
  saving.value = false;
  const warning = sectionChangeWarning(member, details.section, casting);
  return warning === undefined || askToConfirm(warning, "Save", saveButton);
}

/** The running order and roles now, or undefined if they can't be loaded. */
async function roleCastingNow() {
  try {
    const [order, roles] = await Promise.all([
      loadData(runningOrderPath(), RunningOrder),
      loadData(rolesPath(), RoleList),
    ]);
    return { order, roles: roles?.roles ?? [] };
  } catch {
    return undefined;
  }
}

// 200 → the updated member (or "saved" if its reply can't be read); 409/404 → someone
// else changed or removed them; anything else failed.
async function putMember(
  member: CastMember,
  details: CastMemberDetails,
): Promise<CastMember | "saved" | "conflict" | "failed"> {
  try {
    const res = await sendJson(`${castPath()}/${member.id}`, "PUT", {
      ...details,
      revision: member.revision,
    });
    if (res.status === 409 || res.status === 404) return "conflict";
    if (res.status !== 200) return "failed";
    const updated = CastMember.safeParse(await res.json().catch(() => undefined));
    return updated.success ? updated.data : "saved";
  } catch {
    return "failed";
  }
}

// Permanent by design (PRD FR5, ADR 0010), so always confirm first, naming the person and
// how many roles they'll leave (casting-roles FR9).
async function deleteMember(member: CastMember, event: MouseEvent) {
  if (busy.value) return;
  const deleteButton = controlOf(event);
  // Busy while the roles are counted, so a second click can't open a second confirmation,
  // but not while asking: the dialog gives focus back to this button, which busy disables.
  saving.value = true;
  const warning = deleteWarning(fullName(member), await rolesOf(member));
  saving.value = false;
  if (!(await askToConfirm(warning, "Delete cast member", deleteButton))) return;
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
    await focusAddButton();
  } else if (status === 409 || status === 404) {
    await showConflict();
  } else if (status === 403) {
    // Only admins see Delete, so their admin role was removed after they signed in.
    notice.value = "Only admins can delete cast members.";
  } else {
    notice.value = `Couldn't delete ${fullName(member)}. Try again.`;
  }
}

/** How many roles the member is cast in now, or undefined if the roles can't be loaded. */
async function rolesOf(member: CastMember) {
  try {
    const list = await loadData(rolesPath(), RoleList);
    return list?.roles.filter((role) => role.castMemberIds.includes(member.id)).length;
  } catch {
    return undefined;
  }
}

// The status code, or undefined if the request didn't get an answer.
const sendDelete = (member: CastMember) =>
  deleteStatus(`${castPath()}/${member.id}?revision=${member.revision}`);

// 201 → the saved member (or "saved" if its reply can't be read); anything else failed.
async function postMember(details: CastMemberDetails): Promise<CastMember | "saved" | "failed"> {
  try {
    const res = await sendJson(castPath(), "POST", details);
    if (res.status !== 201) return "failed";
    const member = CastMember.safeParse(await res.json().catch(() => undefined));
    return member.success ? member.data : "saved";
  } catch {
    return "failed";
  }
}

async function load() {
  try {
    const list = await loadData(castPath(), CastList);
    state.value = list ? { status: "loaded", list } : { status: "empty" };
  } catch {
    state.value = { status: "error" };
  }
}

onMounted(load);
</script>

<template>
  <PageTitle title="Cast" help="cast" />
  <!-- Outside the state switch: a conflict can leave the list empty, and it still needs explaining. -->
  <p v-if="notice" class="notice" role="alert">{{ notice }}</p>
  <RefusalNotice />
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'empty'">No cast members yet.</p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the cast list.</p>
  <template v-else>
    <p class="visually-hidden" role="status" data-test="announcement">{{ announcement }}</p>
    <div v-if="canChange('casting')" class="button-row">
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
    <form class="filter-bar" role="search" aria-label="Filter the cast" @submit.prevent>
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
          <option v-for="choice in Section.options" :key="choice" :value="choice">
            {{ sectionLabel(choice) }}
          </option>
          <option value="not-set">Not set</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${uid}-gang`">Gang</label>
        <select :id="`${uid}-gang`" v-model="filters.gang" name="gang">
          <option value="all">All</option>
          <option v-for="choice in Gang.options" :key="choice" :value="choice">
            {{ gangLabels[choice] }}
          </option>
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
      class="table-scroll data-table-box"
      tabindex="0"
      role="region"
      aria-label="Cast members"
    >
      <table class="data-table">
        <thead>
          <tr>
            <!-- Icons first, as on the Running order and Items pages. -->
            <th v-if="canChange('casting')" scope="col" class="actions">Actions</th>
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
            <td v-if="canChange('casting')" class="actions row-icons" data-label="Actions">
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
                v-if="canChange('admins')"
                type="button"
                class="icon-button"
                :aria-label="`Delete ${fullName(member)}`"
                data-tooltip="Delete from the cast"
                :disabled="busy"
                @click="deleteMember(member, $event)"
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
