<script setup lang="ts">
import { AccountList, AccountSummary, CreatedAccount, TeamRole, Username } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, ref, useId } from "vue";
import {
  ACCOUNTS_PATH,
  accountPath,
  disableWarning,
  ROLE_NAMES,
  resetWarning,
  roleWarning,
  sortAccounts,
  withArticle,
} from "../accounts.ts";
import { icons } from "../icons.ts";
import { apiFetch, signedInUsername } from "../sign-in.ts";

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
// While the form is open or a change is saving, other changes wait.
const busy = computed(() => adding.value || saving.value);
/** A temporary password just issued, for a new account or a reset: shown once, until passed on. */
const issued = ref<{ result: CreatedAccount; isNew: boolean } | null>(null);
/** Visible message about a change that didn't go through. */
const notice = ref("");
/** Screen-reader announcement of the last change to the list. */
const announcement = ref("");
const addButton = ref<HTMLButtonElement>();
const usernameInput = ref<HTMLInputElement>();
const issuedNotice = ref<HTMLElement>();

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

/** Puts the account in the list, replacing the one with its username if there is one. */
function showAccount(account: AccountSummary) {
  if (state.value.status !== "loaded") return;
  const others = state.value.list.accounts.filter((a) => a.username !== account.username);
  state.value = { status: "loaded", list: { accounts: [...others, account] } };
}

async function startAdding() {
  issued.value = null;
  notice.value = "";
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
  else {
    adding.value = false;
    showAccount(result.account);
    await showIssued(result, true);
  }
}

// Focus moves to the password, the one thing to do next.
async function showIssued(result: CreatedAccount, isNew: boolean) {
  issued.value = { result, isNew };
  await nextTick();
  issuedNotice.value?.focus();
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

// The password goes from the screen once it's been passed on. Focus goes back where the
// admin was: Add account, or the reset row's button.
async function passedOn() {
  const reset = issued.value?.isNew === false ? issued.value.result.account.username : undefined;
  issued.value = null;
  if (reset) await focusRowButton(reset, "reset-password");
  else {
    await nextTick();
    addButton.value?.focus();
  }
}

/** Focuses one of a row's buttons; after a change redraws the row, the button is a new one. */
async function focusRowButton(name: string, action: RowAction) {
  await nextTick();
  document
    .querySelector<HTMLButtonElement>(`[data-username="${name}"] [data-test="${action}"]`)
    ?.focus();
}

/**
 * Sends a change to one account. Answers the reply's body, or undefined after saying why it
 * didn't go through; a vanished account also reloads the list.
 */
async function change(
  account: AccountSummary,
  url: string,
  init: RequestInit,
  { failed, conflict = failed }: { failed: string; conflict?: string },
): Promise<unknown> {
  issued.value = null;
  notice.value = "";
  saving.value = true;
  const res = await apiFetch(url, init).catch(() => undefined);
  saving.value = false;
  if (res?.ok) return res.json().catch(() => null);
  if (res?.status === 409) {
    // The API says why, such as keeping the only admin (FR14).
    notice.value = (await refusalOf(res)) ?? conflict;
    return undefined;
  }
  if (res?.status === 404) {
    notice.value = `${account.username} no longer has an account. Showing the latest list.`;
    await load();
  } else if (res?.status === 403) {
    notice.value = "Only admins can change accounts.";
  } else {
    notice.value = failed;
  }
  return undefined;
}

/** The message a refusal carries, if it has one. */
async function refusalOf(res: Response) {
  const body: unknown = await res.json().catch(() => undefined);
  if (typeof body !== "object" || body === null || !("message" in body)) return undefined;
  return typeof body.message === "string" ? body.message : undefined;
}

// Ends their sign-ins everywhere, so it's always confirmed first.
async function resetPassword(account: AccountSummary) {
  const { username: name } = account;
  if (busy.value || !window.confirm(resetWarning(name))) return;
  const failed = `Couldn't reset ${name}'s password. Try again.`;
  const reply = await change(
    account,
    `${accountPath(name)}/password`,
    { method: "POST" },
    { failed },
  );
  // Without the password the reset is no use to the admin, so an unreadable reply failed.
  const reset = CreatedAccount.safeParse(reply);
  if (reset.success) {
    announcement.value = `${name}'s password reset.`;
    await showIssued(reset.data, false);
    return;
  }
  if (reply !== undefined) notice.value = failed;
  await focusRowButton(name, "reset-password");
}

type RowAction = "reset-password" | "disable" | "enable" | "role";

interface AccessChange {
  /** The account's address after its own, and the change to send it. */
  field: "enabled" | "role";
  body: { enabled: boolean } | { role: TeamRole };
  failed: string;
  /** What to say if the API refuses it as locking someone out, and says nothing itself. */
  conflict: string;
  done: string;
  /** Where focus goes in the row: the button that undoes it, or this one again on failure. */
  focusWhenDone: RowAction;
  focusWhenFailed: RowAction;
}

/** Changes an account's access, keeping focus in its row. Answers whether it saved. */
async function putAccess(account: AccountSummary, put: AccessChange) {
  const { username: name } = account;
  const reply = await change(
    account,
    `${accountPath(name)}/${put.field}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(put.body),
    },
    put,
  );
  if (reply === undefined) {
    await focusRowButton(name, put.focusWhenFailed);
    return false;
  }
  // Saved, even if the reply can't be read: show what was asked for.
  const updated = AccountSummary.safeParse(reply);
  showAccount(updated.success ? updated.data : { ...account, ...put.body });
  announcement.value = put.done;
  await focusRowButton(name, put.focusWhenDone);
  return true;
}

// Disabling ends their access everywhere, so it's confirmed first (hosting FR12).
async function setEnabled(account: AccountSummary, enabled: boolean) {
  const { username: name } = account;
  if (busy.value || (!enabled && !window.confirm(disableWarning(name)))) return;
  await putAccess(account, {
    field: "enabled",
    body: { enabled },
    failed: `Couldn't ${enabled ? "enable" : "disable"} ${name}. Try again.`,
    conflict: "You can't disable your own account.",
    done: `${name} ${enabled ? "enabled" : "disabled"}.`,
    focusWhenDone: enabled ? "disable" : "enable",
    focusWhenFailed: enabled ? "enable" : "disable",
  });
}

// It changes what they can do and signs them out, so it's confirmed first (team-roles FR10).
async function setRole(account: AccountSummary, event: Event) {
  const choice = event.currentTarget;
  if (!(choice instanceof HTMLSelectElement)) return;
  const role = TeamRole.safeParse(choice.value);
  const { username: name } = account;
  // Cancelled or refused: the choice goes back to the role they still have.
  if (!role.success || busy.value || !window.confirm(roleWarning(name, role.data))) {
    choice.value = account.role;
    return;
  }
  const saved = await putAccess(account, {
    field: "role",
    body: { role: role.data },
    failed: `Couldn't change ${name}'s role. Try again.`,
    conflict: "You can't change your own role.",
    done: `${name} is now ${withArticle(role.data)}.`,
    focusWhenDone: "role",
    focusWhenFailed: "role",
  });
  if (!saved) choice.value = account.role;
}

/** The signed-in admin's own account, which they can't disable or change the role of (FR14). */
const isOwn = (account: AccountSummary) =>
  account.username.toLowerCase() === signedInUsername.value?.toLowerCase();

onMounted(load);
</script>

<template>
  <h1>Accounts</h1>
  <!-- Outside the state switch: a vanished account reloads the list, and still needs explaining. -->
  <p v-if="notice" class="notice" role="alert">{{ notice }}</p>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'error'" role="alert">{{ state.message }}</p>
  <template v-else>
    <p class="visually-hidden" role="status" data-test="announcement">{{ announcement }}</p>
    <div class="cast-actions">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-account"
        :disabled="busy"
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
      v-if="issued"
      ref="issuedNotice"
      class="notice created-account"
      data-test="created-account"
      role="alert"
      tabindex="-1"
    >
      <p>
        Pass this temporary password to {{ issued.result.account.username }}. It won't be shown
        again.
      </p>
      <p>
        <code class="temporary-password" data-test="temporary-password">{{
          issued.result.temporaryPassword
        }}</code>
      </p>
      <p>
        {{ issued.result.account.username }} chooses a new password when they
        {{ issued.isNew ? "first" : "next" }} sign in.
      </p>
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
            <th scope="col" class="actions">Actions</th>
            <th scope="col">Username</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in accounts" :key="account.username" :data-username="account.username">
            <td class="actions row-icons" data-label="Actions">
              <button
                type="button"
                class="icon-button"
                :aria-label="`Reset ${account.username}'s password`"
                data-test="reset-password"
                data-tooltip="Reset password"
                :disabled="busy"
                @click="resetPassword(account)"
              >
                <FontAwesomeIcon :icon="icons.resetPassword" />
              </button>
              <button
                v-if="account.enabled"
                type="button"
                class="icon-button"
                :aria-label="`Disable ${account.username}`"
                data-test="disable"
                :data-tooltip="isOwn(account) ? 'You can\'t disable your own account' : 'Disable account'"
                :aria-describedby="isOwn(account) ? `${uid}-own-disable` : undefined"
                :disabled="busy || isOwn(account)"
                @click="setEnabled(account, false)"
              >
                <FontAwesomeIcon :icon="icons.disable" />
              </button>
              <button
                v-else
                type="button"
                class="icon-button"
                :aria-label="`Enable ${account.username}`"
                data-test="enable"
                data-tooltip="Enable account"
                :disabled="busy"
                @click="setEnabled(account, true)"
              >
                <FontAwesomeIcon :icon="icons.enable" />
              </button>
            </td>
            <td class="username" data-label="Username">{{ account.username }}</td>
            <td class="role-choice" data-label="Role">
              <!-- The column header (or the card's label on phones) is the visible label. -->
              <select
                :aria-label="`Role for ${account.username}`"
                :value="account.role"
                data-test="role"
                :disabled="busy || isOwn(account)"
                :aria-describedby="isOwn(account) ? `${uid}-own-role` : undefined"
                @change="setRole(account, $event)"
              >
                <option v-for="(label, role) in ROLE_NAMES" :key="role" :value="role">
                  {{ label }}
                </option>
              </select>
              <!-- Admins can do the most, so they stand out at a glance. -->
              <span v-if="account.role === 'admin'" class="badge">Admin</span>
              <p v-if="isOwn(account)" :id="`${uid}-own-role`" class="hint">
                You can't change your own role
              </p>
            </td>
            <!-- Badges only on the states a volunteer needs to notice. -->
            <td class="status" data-label="Status">
              <span v-if="!account.enabled" class="badge">Disabled</span>
              <template v-else>Enabled</template>
              <!-- Phones show no tooltips, so the reason is on the page too. -->
              <p v-if="isOwn(account) && account.enabled" :id="`${uid}-own-disable`" class="hint">
                You can't disable your own account
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
