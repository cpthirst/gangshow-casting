<script setup lang="ts">
import {
  CastList,
  type CastMember,
  ItemMicPlot,
  MicPlotList,
  type Role,
  RoleList,
  RunningOrder,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, onMounted, ref, useId, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
import CastMemberPicker from "@/components/casting/CastMemberPicker.vue";
import ItemStepNav from "@/components/common/ItemStepNav.vue";
import ReadOnlyNotice from "@/components/common/ReadOnlyNotice.vue";
import { showPageTitle } from "@/router/index.ts";
import { apiFetch, canChangeMicPlot } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { icons } from "@/utils/icons.ts";
import {
  allocateMicPath,
  castInItem,
  channelsOf,
  choicesFor,
  MIC_PLOT_PATH,
  micRolesText,
} from "@/utils/mic-plot.ts";
import { type CastMemberChoice, fullName, ROLES_PATH } from "@/utils/roles.ts";
import { neighboursOf, placeOf, positionOf, RUNNING_ORDER_PATH } from "@/utils/running-order.ts";

// One item's mic plot: Mic 1 to Mic 24, each given to a cast member in the item or free, with
// the roles they play there (production-mics FR2, FR3, FR4), laid out as the other department
// item pages.

const route = useRoute();
const order = ref<RunningOrder>();
const plots = ref<ItemMicPlot[]>([]);
// The casting, for who can be given a mic (FR3), and everyone's names.
const roles = ref<Role[]>([]);
const cast = ref<CastMember[]>([]);
const status = ref<"loading" | "loaded" | "error">("loading");
/** The channel being saved, which shows the choice made until the API answers. */
const saving = ref<{ channel: number; castMemberId: number | null }>();
/** What's typed in a channel's picker before anyone is chosen from it, by channel. */
const typed = ref(new Map<number, CastMemberChoice>());
const uid = useId();
const pickerId = (channel: number) => `${uid}-mic-${channel}`;
/** What the last change did ("Mic 3 given to Alex Morgan."), announced. */
const announcement = ref("");
/** Why the last change wasn't saved, if it wasn't. */
const problem = ref("");

const place = computed(() => {
  const itemId = route.params.itemId;
  return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
});
const neighbours = computed(() =>
  order.value && place.value ? neighboursOf(order.value, place.value.item.id) : {},
);
// Loaded, but the item isn't in the latest saved running order.
const notFound = computed(() => status.value === "loaded" && !place.value);
const title = computed(() => (place.value ? `Mic plot: ${place.value.item.title}` : ""));

const plot = computed(() => plots.value.find((p) => p.itemId === place.value?.item.id));
const channels = computed(() =>
  channelsOf(plot.value).map((mic) =>
    saving.value?.channel === mic.channel
      ? { ...mic, castMemberId: saving.value.castMemberId }
      : mic,
  ),
);
const itemCast = computed(() =>
  place.value ? castInItem(place.value.item.id, roles.value, cast.value) : [],
);
const nameOf = (castMemberId: number | null) => {
  const member = cast.value.find((m) => m.id === castMemberId);
  return member ? fullName(member) : "";
};

// Follows the item even if the page is reused for another one (Previous and Next).
watchEffect(() => {
  if (place.value) showPageTitle(title.value);
  else if (notFound.value) showPageTitle("Item not found");
});

// A message or half-typed name on one item's mics never carries over to the next.
watch(
  () => route.params.itemId,
  () => {
    typed.value = new Map();
    announcement.value = "";
    problem.value = "";
  },
);

async function okJson(res: Response): Promise<unknown> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

onMounted(async () => {
  try {
    const [orderRes, plotsRes, rolesRes, castRes] = await Promise.all([
      apiFetch(RUNNING_ORDER_PATH),
      apiFetch(MIC_PLOT_PATH),
      apiFetch(ROLES_PATH),
      apiFetch(CAST_PATH),
    ]);
    // No saved running order at all: no item can be in it.
    if (orderRes.status !== 404) order.value = RunningOrder.parse(await okJson(orderRes));
    plots.value = MicPlotList.parse(await okJson(plotsRes)).items;
    roles.value = RoleList.parse(await okJson(rolesRes)).roles;
    // No cast list yet just means nobody is cast.
    if (castRes.status !== 404) cast.value = CastList.parse(await okJson(castRes)).members;
    status.value = "loaded";
  } catch {
    // A failed load must never look like "not found".
    status.value = "error";
  }
});

/** What a channel's picker shows: what's being typed, otherwise who is on it. */
const choiceFor = (channel: number, castMemberId: number | null): CastMemberChoice =>
  typed.value.get(channel) ?? { query: nameOf(castMemberId), id: castMemberId };

// Typing only searches; choosing someone from the list gives them the mic.
function pick(channel: number, choice: CastMemberChoice) {
  if (choice.id === null) typed.value.set(channel, choice);
  else allocate(channel, choice.id);
}

// Text typed but never chosen from is dropped on leaving the channel, so the picker shows
// who is really on it.
function leave(channel: number) {
  if (typed.value.get(channel)?.id === null) typed.value.delete(channel);
}

function show(saved: ItemMicPlot) {
  plots.value = [...plots.value.filter((p) => p.itemId !== saved.itemId), saved];
}

// Saved as soon as it's chosen, quick to change at a rehearsal. On failure the channel goes
// back to who was on it.
async function allocate(channel: number, castMemberId: number | null) {
  const item = place.value?.item;
  if (!item || saving.value) return;
  typed.value.delete(channel);
  announcement.value = "";
  problem.value = "";
  saving.value = { channel, castMemberId };
  try {
    const res = await apiFetch(allocateMicPath(item.id), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, castMemberId }),
    });
    if (res.status === 409) {
      // Someone else gave them another of the item's mics first.
      show(ItemMicPlot.parse(await res.json()));
      problem.value = `${nameOf(castMemberId)} is already on another mic in this item. Here are the mics as they are now.`;
      return;
    }
    show(ItemMicPlot.parse(await okJson(res)));
    announcement.value =
      castMemberId === null
        ? `Mic ${channel} is free.`
        : `Mic ${channel} given to ${nameOf(castMemberId)}.`;
  } catch {
    problem.value = `Couldn't save Mic ${channel}. Try again.`;
  } finally {
    saving.value = undefined;
  }
}
</script>

<template>
  <ItemStepNav
    :list="{ name: 'production-overview' }"
    item-route="mic-plot-item"
    :previous="neighbours.previous"
    :next="neighbours.next"
  />
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <h1>{{ title }}</h1>
    <p class="item-position" data-test="position">{{ positionOf(place) }}</p>
    <!-- Those who can't change it see every channel and who is on it, nothing to change. -->
    <ReadOnlyNotice about="mic-plot" />
    <p v-if="problem" class="notice" role="alert" data-test="mic-problem">{{ problem }}</p>
    <!-- An explicit list role: Safari drops list semantics once bullets are styled away. -->
    <ol class="mic-channels" role="list" aria-label="Mics">
      <!-- A card per channel, as the role, prop and file cards: its clear icon first, as
           theirs. -->
      <li
        v-for="mic in channels"
        :key="mic.channel"
        class="role-card mic-channel"
        data-test="mic"
        @focusout="leave(mic.channel)"
      >
        <template v-if="canChangeMicPlot">
          <!-- role-actions: on phones the icon gets its own line, as on role and prop cards. -->
          <span class="role-actions row-icons">
            <button
              type="button"
              class="icon-button"
              :aria-label="`Clear Mic ${mic.channel}`"
              data-tooltip="Clear mic"
              :disabled="mic.castMemberId === null || saving !== undefined"
              @click="allocate(mic.channel, null)"
            >
              <FontAwesomeIcon :icon="icons.remove" />
            </button>
          </span>
        </template>
        <!-- The channel's name, then who is on it and their roles under them, in one column,
             so the roles start where the cast member picker does. -->
        <div class="mic-body">
          <template v-if="canChangeMicPlot">
          <label :for="pickerId(mic.channel)" class="mic-name"
            ><span data-test="channel">Mic {{ mic.channel }}</span
            ><span class="visually-hidden"> cast member</span></label
          >
          <CastMemberPicker
            :model-value="choiceFor(mic.channel, mic.castMemberId)"
            :cast="choicesFor(mic.channel, itemCast, plot)"
            :name="`mic-${mic.channel}`"
            :input-id="pickerId(mic.channel)"
            :disabled="saving !== undefined"
            no-match="No one in this item matches"
            @update:model-value="pick(mic.channel, $event)"
          />
          </template>
          <template v-else>
            <span class="mic-name" data-test="channel">Mic {{ mic.channel }}</span>
            <span data-test="on-mic">{{ nameOf(mic.castMemberId) || "No one" }}</span>
          </template>
          <!-- Their roles in the item, from the casting: shown, never chosen (FR3). -->
          <span class="mic-roles" data-test="mic-roles">{{
            micRolesText(place.item.id, mic.castMemberId, roles)
          }}</span>
        </div>
      </li>
    </ol>
    <p class="visually-hidden" role="status" data-test="mic-status">{{ announcement }}</p>
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
