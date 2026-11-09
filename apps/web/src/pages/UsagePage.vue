<script setup lang="ts">
import {
  AccountList,
  type MenuPageName,
  RunningOrder,
  USAGE_RANGES,
  type UsageFeature,
  UsageSummary,
} from "@app/shared";
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from "vue";
import { useRouter } from "vue-router";
import { AccessRefused, loadData, loadRequired } from "@/services/load-data.ts";
import { USAGE_PATH } from "@/services/usage.ts";
import { ACCOUNTS_PATH } from "@/utils/accounts.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import {
  dayOf,
  featureName,
  usageByAccount,
  usesOf,
  whatHappened,
  whenOf,
} from "@/utils/usage-report.ts";

/** Each item's title by production and id; null when the running order couldn't be loaded. */
type ItemTitles = Map<string, string> | null;

type State =
  | { status: "loading" }
  | { status: "error"; message: string; forbidden?: true }
  | { status: "loaded"; accounts: AccountList; usage: UsageSummary; itemTitles: ItemTitles };

const state = ref<State>({ status: "loading" });
const router = useRouter();
// Item uses hold only the item's id (ADR 0023): its title comes from the running order.
const titles = {
  page: (page: MenuPageName) => {
    const { meta } = router.resolve({ name: page });
    return meta.usageTitle ?? meta.title;
  },
  item: (productionId: string, itemId: string) => {
    if (state.value.status !== "loaded" || state.value.itemTitles === null) return null;
    return state.value.itemTitles.get(`${productionId}/${itemId}`);
  },
};
const nameOf = (feature: UsageFeature) => featureName(feature, titles.page);
const rows = computed(() =>
  state.value.status === "loaded"
    ? usageByAccount(state.value.accounts.accounts, state.value.usage.people).map((row) => ({
        ...row,
        uses: usesOf(row.usage?.uses ?? {}, nameOf),
      }))
    : [],
);

const ACTIVITY_PAGE = 50;
const activityShown = ref(ACTIVITY_PAGE);
const activityBody = useTemplateRef<HTMLTableSectionElement>("activityBody");

// The button goes once everything shows, so focus moves to the first row just shown.
async function showMoreActivity() {
  const firstNew = activityShown.value;
  activityShown.value += ACTIVITY_PAGE;
  await nextTick();
  const row = activityBody.value?.children[firstNew];
  if (row instanceof HTMLElement) row.focus();
}
const activity = computed(() =>
  state.value.status === "loaded" ? state.value.usage.activity : [],
);

const recordedSince = computed(() => {
  if (state.value.status !== "loaded") return "";
  const since = state.value.usage.recordedSince;
  const recorded = since
    ? `Usage has been recorded since ${dayOf(since)}.`
    : "Nothing has been recorded yet.";
  // The start date isn't the period: say which the figures below cover.
  return `Showing the last ${days.value} days. ${recorded}`;
});

// The page opens on 30 days each time; it needn't remember a choice (usage-tracking FR8).
const days = ref<(typeof USAGE_RANGES)[number]>("30");
const rangeChoices = USAGE_RANGES.map((choice) => ({ days: choice, label: `Last ${choice} days` }));
const rangeId = useId();
watch(days, load);

// Every account comes from the account list, so people who've never signed in are listed too.
// The running order loads alongside, so items never show before their titles are known.
async function load() {
  const asked = days.value;
  state.value = { status: "loading" };
  activityShown.value = ACTIVITY_PAGE;
  const loaded = await usageFor(asked);
  // A range chosen since has its own load on the way: this answer is out of date.
  if (asked === days.value) state.value = loaded;
}

async function usageFor(range: string): Promise<State> {
  const accountsLoad = loadRequired(ACCOUNTS_PATH, AccountList);
  const usageLoad = loadRequired(`${USAGE_PATH}?days=${range}`, UsageSummary);
  try {
    const [accounts, usage, itemTitles] = await Promise.all([
      accountsLoad,
      usageLoad,
      loadItemTitles(),
    ]);
    return { status: "loaded", accounts, usage, itemTitles };
  } catch {
    // A refusal decides the message, whichever answer arrived first.
    const answers = await Promise.allSettled([accountsLoad, usageLoad]);
    const refused = answers.some(
      (answer) => answer.status === "rejected" && answer.reason instanceof AccessRefused,
    );
    return refused
      ? { status: "error", message: "Only admins can see usage.", forbidden: true }
      : { status: "error", message: "Couldn't load usage." };
  }
}

/** Never fails: without the running order, the rest of the page still shows. */
async function loadItemTitles(): Promise<ItemTitles> {
  try {
    const order = await loadData(RUNNING_ORDER_PATH, RunningOrder);
    // No saved running order: no item is in it.
    if (!order) return new Map();
    return new Map(
      order.halves.flatMap((half) =>
        half.items.map((item) => [`${order.productionId}/${item.id}`, item.title] as const),
      ),
    );
  } catch {
    return null;
  }
}

onMounted(load);
</script>

<template>
  <h1>Usage</h1>
  <!-- Outside the loading switch, so it keeps focus while the page loads the new range, and
       stays when a range fails so another can be tried. -->
  <!-- The Cast page's filter look, so it matches the app's other dropdowns. -->
  <div v-if="!(state.status === 'error' && state.forbidden)" class="filter-bar">
    <div class="field">
      <label :for="rangeId">Period</label>
      <select :id="rangeId" v-model="days" data-test="range">
        <option v-for="choice in rangeChoices" :key="choice.days" :value="choice.days">
          {{ choice.label }}
        </option>
      </select>
    </div>
  </div>
  <p v-if="state.status === 'loading'">Loading…</p>
  <p v-else-if="state.status === 'error'" role="alert">{{ state.message }}</p>
  <template v-else>
    <p data-test="recorded-since">{{ recordedSince }}</p>
    <h2>By feature</h2>
    <div
      class="table-scroll data-table-box"
      tabindex="0"
      role="region"
      aria-label="Usage by feature"
      data-test="by-feature">
      <table class="data-table">
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
    <!-- A session is one sign-in (usage-tracking FR1, ADR 0024): say so, or a recent user
         whose sign-in began days ago looks as if they've stopped. -->
    <p data-test="sign-in-note">
      A sign-in lasts the day, so reopening the app within it isn't counted again.
    </p>
    <div
      class="table-scroll data-table-box"
      tabindex="0"
      role="region"
      aria-label="Usage by person"
      data-test="by-person">
      <!-- The Accounts page's look, so phones show each person as a card too. -->
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Username</th>
            <th scope="col">Sign-ins</th>
            <th scope="col">Last sign-in</th>
            <th scope="col">Uses</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.username">
            <td class="username" data-label="Username">{{ row.username }}</td>
            <td data-label="Sign-ins">{{ row.usage?.sessions ?? 0 }}</td>
            <td data-label="Last sign-in">
              {{ row.usage?.lastSession ? dayOf(row.usage.lastSession) : "No sign-ins" }}
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
    <h2>Recent activity</h2>
    <p v-if="activity.length === 0" data-test="no-activity">No activity in this period.</p>
    <template v-else>
      <div
        class="table-scroll data-table-box"
        tabindex="0"
        role="region"
        aria-label="Usage activity"
        data-test="activity">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Username</th>
              <th scope="col">What</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody ref="activityBody">
            <tr
              v-for="(entry, index) in activity.slice(0, activityShown)"
              :key="index"
              tabindex="-1">
              <td class="username" data-label="Username">{{ entry.username }}</td>
              <td data-label="What">{{ whatHappened(entry, titles) }}</td>
              <td data-label="When">{{ whenOf(entry.at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="activity.length > activityShown" class="button-row">
        <button type="button" data-test="more-activity" @click="showMoreActivity">
          Show the next {{ Math.min(ACTIVITY_PAGE, activity.length - activityShown) }}
        </button>
      </div>
    </template>
  </template>
</template>
