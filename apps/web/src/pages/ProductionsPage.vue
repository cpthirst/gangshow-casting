<script setup lang="ts">
import { mayStartProduction, newestFirst, ProductionList, startRefusal } from "@app/shared";
import { computed, nextTick, onMounted, ref, useId } from "vue";
import PageTitle from "@/components/common/PageTitle.vue";
import { useAddForm } from "@/composables/useAddForm.ts";
import { loadRequired, refusalMessage } from "@/services/load-data.ts";
import { openNewestOf, PRODUCTIONS_PATH } from "@/services/production.ts";
import { apiFetch, isAdmin } from "@/services/sign-in.ts";
import { startWarning } from "@/utils/production.ts";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; list: ProductionList };

const state = ref<State>({ status: "loading" });
const years = computed(() =>
  state.value.status === "loaded" ? newestFirst(state.value.list.productions) : [],
);

const uid = useId();
const { adding, addButton, stopAdding } = useAddForm();
const year = ref("");
const yearError = ref("");
const formError = ref("");
const saving = ref(false);
const yearInput = ref<HTMLInputElement>();
/** Screen-reader announcement of a production just started. */
const announcement = ref("");

async function load() {
  try {
    state.value = { status: "loaded", list: await loadRequired(PRODUCTIONS_PATH, ProductionList) };
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
    const res = await apiFetch(PRODUCTIONS_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ year: asked }),
    });
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
    <div class="table-scroll data-table-box" tabindex="0" role="region" aria-label="Productions">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Year</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="production in years" :key="production">
            <td data-label="Year">{{ production }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
