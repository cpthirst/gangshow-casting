<script setup lang="ts">
import { AccountList, CreatedAccount, Username } from "@app/shared";
import { computed, nextTick, onMounted, ref, useId } from "vue";
import { ACCOUNTS_PATH, sortAccounts } from "../accounts.ts";
import { apiFetch } from "../sign-in.ts";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; list: AccountList };

const state = ref<State>({ status: "loading" });
const accounts = computed(() =>
  state.value.status === "loaded" ? sortAccounts(state.value.list.accounts) : [],
);

const uid = useId();
const adding = ref(false);
const username = ref("");
const usernameError = ref("");
const formError = ref("");
const saving = ref(false);
/** The account just added, with its temporary password: shown once, until passed on. */
const created = ref<CreatedAccount | null>(null);
const addButton = ref<HTMLButtonElement>();
const usernameInput = ref<HTMLInputElement>();
const createdNotice = ref<HTMLElement>();

async function load() {
  try {
    const res = await apiFetch(ACCOUNTS_PATH);
    if (res.status === 403) {
      state.value = { status: "error", message: "Only admins can see accounts." };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", list: AccountList.parse(await res.json()) };
  } catch {
    state.value = { status: "error", message: "Couldn't load the accounts." };
  }
}

async function startAdding() {
  created.value = null;
  username.value = "";
  usernameError.value = "";
  formError.value = "";
  adding.value = true;
  await nextTick();
  usernameInput.value?.focus();
}

async function stopAdding() {
  adding.value = false;
  await nextTick();
  addButton.value?.focus();
}

async function create() {
  if (saving.value) return;
  formError.value = "";
  const checked = Username.safeParse(username.value);
  usernameError.value = checked.success ? "" : (checked.error.issues[0]?.message ?? "");
  if (!checked.success) return;

  saving.value = true;
  const result = await postAccount(checked.data);
  saving.value = false;
  if ("usernameError" in result) usernameError.value = result.usernameError;
  else if ("formError" in result) formError.value = result.formError;
  else await showCreated(result);
}

// The form closes and focus moves to the password, the one thing to do next.
async function showCreated(result: CreatedAccount) {
  adding.value = false;
  created.value = result;
  if (state.value.status === "loaded") {
    const { accounts } = state.value.list;
    state.value = { status: "loaded", list: { accounts: [...accounts, result.account] } };
  }
  await nextTick();
  createdNotice.value?.focus();
}

const FAILED = { formError: "Couldn't add the account. Try again." };

// 201 → the new account and its password; otherwise what to tell the admin. A 201 whose
// reply can't be read is a failure: without the password the account is no use.
async function postAccount(
  name: string,
): Promise<CreatedAccount | { usernameError: string } | { formError: string }> {
  try {
    const res = await apiFetch(ACCOUNTS_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: name }),
    });
    if (res.status === 409) return { usernameError: "That username is already taken." };
    if (res.status === 403) return { formError: "Only admins can add accounts." };
    if (res.status !== 201) return FAILED;
    const account = CreatedAccount.safeParse(await res.json().catch(() => undefined));
    return account.success ? account.data : FAILED;
  } catch {
    return FAILED;
  }
}

// The password goes from the screen once it's been passed on.
async function passedOn() {
  created.value = null;
  await nextTick();
  addButton.value?.focus();
}

onMounted(load);
</script>

<template>
  <h1>Accounts</h1>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'error'" role="alert">{{ state.message }}</p>
  <template v-else>
    <div class="cast-actions">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-account"
        :disabled="adding || saving"
        @click="startAdding"
      >
        Add account
      </button>
    </div>
    <!-- The Cast page's form look: one field, Save and Cancel. -->
    <form
      v-if="adding"
      data-test="create-account"
      class="cast-member-form"
      aria-label="Add an account"
      novalidate
      @submit.prevent="create"
      @keydown.esc="stopAdding"
    >
      <div class="field">
        <label :for="`${uid}-username`">Username</label>
        <input
          :id="`${uid}-username`"
          ref="usernameInput"
          v-model="username"
          name="username"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          v-bind="
            usernameError
              ? { 'aria-invalid': true, 'aria-describedby': `${uid}-username-error` }
              : {}
          "
        />
        <p v-if="usernameError" :id="`${uid}-username-error`" class="field-error">
          {{ usernameError }}
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
    <div
      v-if="created"
      ref="createdNotice"
      class="notice created-account"
      data-test="created-account"
      role="alert"
      tabindex="-1"
    >
      <p>
        Pass this temporary password to {{ created.account.username }}. It won't be shown again.
      </p>
      <p>
        <code class="temporary-password" data-test="temporary-password">{{
          created.temporaryPassword
        }}</code>
      </p>
      <p>{{ created.account.username }} chooses a new password when they first sign in.</p>
      <div class="editor-actions">
        <button type="button" data-test="password-passed-on" @click="passedOn">
          I've passed it on
        </button>
      </div>
    </div>
    <p v-if="accounts.length === 0">No accounts yet.</p>
    <div
      v-else
      class="table-scroll cast-table"
      tabindex="0"
      role="region"
      aria-label="Accounts"
    >
      <!-- The Cast list's look, so phones show each account as a card too. -->
      <table class="cast-list">
        <thead>
          <tr>
            <th scope="col">Username</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in accounts" :key="account.username">
            <td class="username" data-label="Username">{{ account.username }}</td>
            <!-- Badges only on the states a volunteer needs to notice. -->
            <td data-label="Role">
              <span v-if="account.admin" class="badge">Admin</span>
              <template v-else>Team member</template>
            </td>
            <td data-label="Status">
              <span v-if="!account.enabled" class="badge">Disabled</span>
              <template v-else>Enabled</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
