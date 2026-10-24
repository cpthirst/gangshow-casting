<script setup lang="ts">
import { AccountList, type UsageFeature, UsageSummary } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ACCOUNTS_PATH } from "../accounts.ts";
import { apiFetch } from "../sign-in.ts";
import { dayOf, featureName, USAGE_PATH, usageByAccount, usesOf } from "../usage.ts";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; accounts: AccountList; usage: UsageSummary };

const state = ref<State>({ status: "loading" });
const router = useRouter();
const nameOf = (feature: UsageFeature) =>
  featureName(feature, (page) => router.resolve({ name: page }).meta.title);
const rows = computed(() =>
  state.value.status === "loaded"
    ? usageByAccount(state.value.accounts.accounts, state.value.usage.people).map((row) => ({
        ...row,
        uses: usesOf(row.usage?.uses ?? {}, nameOf),
      }))
    : [],
);
const recordedSince = computed(() => {
  if (state.value.status !== "loaded") return "";
  const since = state.value.usage.recordedSince;
  return since
    ? `Usage has been recorded since ${dayOf(since)}.`
    : "Nothing has been recorded yet.";
});

// Every account comes from the account list, so people who've never signed in are listed too.
async function load() {
  try {
    const [accounts, usage] = await Promise.all([apiFetch(ACCOUNTS_PATH), apiFetch(USAGE_PATH)]);
    if (accounts.status === 403 || usage.status === 403) {
      state.value = { status: "error", message: "Only admins can see usage." };
      return;
    }
    if (!accounts.ok || !usage.ok) throw new Error(`HTTP ${accounts.status} ${usage.status}`);
    state.value = {
      status: "loaded",
      accounts: AccountList.parse(await accounts.json()),
      usage: UsageSummary.parse(await usage.json()),
    };
  } catch {
    state.value = { status: "error", message: "Couldn't load usage." };
  }
}

onMounted(load);
</script>

<template>
  <h1>Usage</h1>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'error'" role="alert">{{ state.message }}</p>
  <template v-else>
    <p data-test="recorded-since">{{ recordedSince }}</p>
    <p data-test="range">Last 30 days</p>
    <h2>By feature</h2>
    <div
      class="table-scroll cast-table"
      tabindex="0"
      role="region"
      aria-label="Usage by feature"
      data-test="by-feature">
      <table class="cast-list">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Uses</th>
            <th scope="col">People</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="total in state.usage.features" :key="total.feature">
            <td class="username" data-label="Feature">{{ nameOf(total.feature) }}</td>
            <td data-label="Uses">{{ total.uses }}</td>
            <td data-label="People">{{ total.people }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <h2>By person</h2>
    <div
      class="table-scroll cast-table"
      tabindex="0"
      role="region"
      aria-label="Usage by person"
      data-test="by-person">
      <!-- The Accounts page's look, so phones show each person as a card too. -->
      <table class="cast-list">
        <thead>
          <tr>
            <th scope="col">Username</th>
            <th scope="col">Sessions</th>
            <th scope="col">Last session</th>
            <th scope="col">Uses</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.username">
            <td class="username" data-label="Username">{{ row.username }}</td>
            <td data-label="Sessions">{{ row.usage?.sessions ?? 0 }}</td>
            <td data-label="Last session">
              {{ row.usage?.lastSession ? dayOf(row.usage.lastSession) : "No sessions" }}
            </td>
            <td data-label="Uses">
              <!-- One use a line: a long run of names and counts is hard to scan on a phone. -->
              <ul v-if="row.uses.length > 0" class="uses-list">
                <li v-for="use in row.uses" :key="use">{{ use }}</li>
              </ul>
              <template v-else>No uses</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
