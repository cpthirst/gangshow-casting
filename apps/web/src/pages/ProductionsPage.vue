<script setup lang="ts">
import {
  mayDeleteProduction,
  mayStartProduction,
  newestFirst,
  ProductionList,
  startRefusal,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, ref, useId } from "vue";
import PageTitle from "@/components/common/PageTitle.vue";
import { useAddForm } from "@/composables/useAddForm.ts";
import { loadRequired, refusalMessage } from "@/services/load-data.ts";
import { listProductions, openNewestOf, PRODUCTIONS_PATH } from "@/services/production.ts";
import { apiFetch, isAdmin, sendJson } from "@/services/sign-in.ts";
import { icons } from "@/utils/icons.ts";
import { deleteWarning, startWarning } from "@/utils/production.ts";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; list: ProductionList };

const state = ref<State>({ status: "loading" });
const unfinished = computed(() =>
  state.value.status === "loaded" ? (state.value.list.deleting ?? []) : [],
);
const years = computed(() =>
  state.value.status === "loaded"
    ? newestFirst([...state.value.list.productions, ...unfinished.value])
    : [],
);
const hasActions = computed(() => isAdmin.value && years.value.length > 1);
const isUnfinished = (production: string) => unfinished.value.includes(production);
const mayDelete = (production: string) =>
  state.value.status === "loaded" && mayDeleteProduction(production, state.value.list.productions);

const uid = useId();
const { adding, addButton, stopAdding } = useAddForm();
const year = ref("");
const yearError = ref("");
const formError = ref("");
const saving = ref(false);
const yearInput = ref<HTMLInputElement>();
const deleteError = ref("");
const isDeleting = ref(false);
/** Screen-reader announcement of a production just started or deleted. */
const announcement = ref("");

/** Shows the list, and tells the rest of the app, which opens the newest if it had this one. */
function show(list: ProductionList) {
  state.value = { status: "loaded", list };
  listProductions(list.productions);
}

async function load() {
  try {
    show(await loadRequired(PRODUCTIONS_PATH, ProductionList));
  } catch {
    state.value = { status: "error" };
  }
}

async function startAdding() {
  year.value = "";
  yearError.value = "";
  formError.value = "";
  adding.value = true;
  await nextTick();
  yearInput.value?.focus();
}

const FAILED = "Couldn't start the production. Try again.";

type Posted =
  | { status: "started"; list: ProductionList }
  | { status: "refused"; message: string }
  | { status: "failed"; message: string };

const failed: Posted = { status: "failed", message: FAILED };

async function postYear(asked: string): Promise<Posted> {
  try {
    const res = await sendJson(PRODUCTIONS_PATH, "POST", { year: asked });
    if (res.status === 201) {
      const list = ProductionList.safeParse(await res.json().catch(() => undefined));
      return list.success ? { status: "started", list: list.data } : failed;
    }
    const message = await refusalMessage(res);
    if (res.status === 400 && message) return { status: "refused", message };
    return { status: "failed", message: message ?? FAILED };
  } catch {
    return failed;
  }
}

// The admin who starts it moves to it now; everyone else does at their next page load.
async function start() {
  if (saving.value || state.value.status !== "loaded") return;
  const asked = year.value.trim();
  const held = state.value.list.productions;
  formError.value = "";
  yearError.value = mayStartProduction(asked, held) ? "" : startRefusal(held);
  if (yearError.value || !window.confirm(startWarning(asked))) return;

  saving.value = true;
  const result = await postYear(asked);
  saving.value = false;
  if (result.status === "refused") yearError.value = result.message;
  else if (result.status === "failed") formError.value = result.message;
  else {
    state.value = { status: "loaded", list: result.list };
    openNewestOf(result.list.productions);
    announcement.value = `Production ${asked} started.`;
    await stopAdding();
  }
}

type Deleted =
  | { status: "deleted"; list: ProductionList }
  | { status: "not-deleted"; message: string };

async function sendDelete(production: string): Promise<Deleted> {
  const notDeleted: Deleted = {
    status: "not-deleted",
    message: `Couldn't finish deleting ${production}. Try again.`,
  };
  try {
    const res = await apiFetch(`${PRODUCTIONS_PATH}/${production}`, { method: "DELETE" });
    if (res.status === 200) {
      const list = ProductionList.safeParse(await res.json().catch(() => undefined));
      return list.success ? { status: "deleted", list: list.data } : notDeleted;
    }
    const message = await refusalMessage(res);
    return message ? { status: "not-deleted", message } : notDeleted;
  } catch {
    return notDeleted;
  }
}

async function deleteProduction(production: string) {
  if (isDeleting.value || !window.confirm(deleteWarning(production))) return;
  isDeleting.value = true;
  deleteError.value = "";
  const result = await sendDelete(production);
  isDeleting.value = false;
  if (result.status === "not-deleted") {
    deleteError.value = result.message;
    // It may be marked now, part deleted, which the row then shows.
    await load();
    return;
  }
  show(result.list);
  announcement.value = `Production ${production} deleted.`;
  // The row (and its button) is gone, so keep keyboard focus on the page.
  await nextTick();
  addButton.value?.focus();
}

onMounted(load);
</script>

<template>
  <PageTitle title="Productions" help="productions" />
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the productions.</p>
  <template v-else>
    <p class="visually-hidden" role="status" data-test="announcement">{{ announcement }}</p>
    <div v-if="isAdmin" class="button-row">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-production"
        :disabled="adding || saving"
        @click="startAdding"
      >
        Add production
      </button>
    </div>
    <form
      v-if="adding"
      data-test="start-production"
      class="form"
      aria-label="Add a production"
      novalidate
      @submit.prevent="start"
      @keydown.esc="stopAdding"
    >
      <div class="field">
        <label :for="`${uid}-year`">Year</label>
        <input
          :id="`${uid}-year`"
          ref="yearInput"
          v-model="year"
          name="year"
          inputmode="numeric"
          autocomplete="off"
          v-bind="
            yearError ? { 'aria-invalid': true, 'aria-describedby': `${uid}-year-error` } : {}
          "
        />
        <p v-if="yearError" :id="`${uid}-year-error`" class="field-error" role="alert">
          {{ yearError }}
        </p>
      </div>
      <p v-if="formError" class="field-error form-error" role="alert">{{ formError }}</p>
      <div class="editor-actions">
        <button type="submit" class="primary" :disabled="saving">Save</button>
        <button type="button" data-test="cancel" :disabled="saving" @click="stopAdding">
          Cancel
        </button>
      </div>
    </form>
    <p v-if="deleteError" class="field-error form-error" role="alert">{{ deleteError }}</p>
    <div class="table-scroll data-table-box" tabindex="0" role="region" aria-label="Productions">
      <table class="data-table">
        <thead>
          <tr>
            <th v-if="hasActions" scope="col" class="actions">Actions</th>
            <th scope="col">Year</th>
            <th v-if="unfinished.length > 0" scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="production in years" :key="production" :data-year="production">
            <td v-if="hasActions" class="actions row-icons" data-label="Actions">
              <button
                v-if="mayDelete(production)"
                type="button"
                class="icon-button"
                data-test="delete-production"
                :aria-label="`Delete production ${production}${isUnfinished(production) ? ' again' : ''}`"
                :data-tooltip="isUnfinished(production) ? 'Delete again' : 'Delete production'"
                :disabled="isDeleting"
                @click="deleteProduction(production)"
              >
                <FontAwesomeIcon :icon="icons.remove" />
              </button>
            </td>
            <td data-label="Year">{{ production }}</td>
            <td
              v-if="unfinished.length > 0"
              :data-label="isUnfinished(production) ? 'Status' : undefined"
            >
              {{ isUnfinished(production) ? "Not finished" : "" }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
