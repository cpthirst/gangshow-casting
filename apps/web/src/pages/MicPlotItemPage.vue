<script setup lang="ts">
import {
  CastList,
  type CastMember,
  channelsHeldBefore,
  channelsKeptAgainstTheRule,
  ItemMicPlot,
  MicPlotList,
  type Role,
  RoleList,
  type RunningOrder,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref, useId, watch } from "vue";
import { useRoute } from "vue-router";
import CastMemberPicker from "@/components/casting/CastMemberPicker.vue";
import ClashIcon from "@/components/common/ClashIcon.vue";
import ItemPageFrame from "@/components/common/ItemPageFrame.vue";
import { loadData } from "@/services/load-data.ts";
import { apiFetch, canChange } from "@/services/sign-in.ts";
import { castPath } from "@/utils/cast.ts";
import { icons } from "@/utils/icons.ts";
import {
  allocateMicPath,
  castInItem,
  channelsOf,
  choicesFor,
  keptMicError,
  micPlotPath,
  micRolesText,
} from "@/utils/mic-plot.ts";
import { type CastMemberChoice, fullName, rolesPath } from "@/utils/roles.ts";
import { neighboursOf, placeOf } from "@/utils/running-order.ts";

// One item's mic plot: Mic 1 to Mic 24, each given to a cast member in the item or free, with
// the roles they play there (production-mics FR2, FR3, FR4), a channel someone had in the item
// before held for them (FR5, FR6), one kept against that rule after a reorder shown as an
// error until it's cleared (FR10), in the frame every item page shares, with the item's Mic
// plot notes under them (FR8).

const route = useRoute();
const order = ref<RunningOrder>();
const plots = ref<ItemMicPlot[]>([]);
// The casting, for who can be given a mic (FR3), and everyone's names.
const roles = ref<Role[]>([]);
const cast = ref<CastMember[]>([]);
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

const plot = computed(() => plots.value.find((p) => p.itemId === place.value?.item.id));
const channels = computed(() =>
  channelsOf(plot.value).map((mic) =>
    saving.value?.channel === mic.channel
      ? { ...mic, castMemberId: saving.value.castMemberId }
      : mic,
  ),
);
/** Who had each channel in the item before: no one else can have it here. */
const heldBefore = computed(() =>
  order.value && place.value
    ? channelsHeldBefore(order.value, plots.value, place.value.item.id)
    : new Map<number, number>(),
);
/** Channels given out before a reorder put this item straight after one where someone else
 *  has them: kept, as an error, and they can only be cleared (FR10). */
const kept = computed(() =>
  order.value && place.value
    ? channelsKeptAgainstTheRule(order.value, plots.value, place.value.item.id)
    : [],
);
/** The channel, if it's kept; not while it's being cleared. */
const keptOn = (mic: { channel: number; castMemberId: number | null }) =>
  mic.castMemberId === null ? undefined : kept.value.find((k) => k.channel === mic.channel);
/** A kept channel: it can only be cleared. */
const isKept = (mic: { channel: number; castMemberId: number | null }) => keptOn(mic) !== undefined;
/** The error on a kept channel; none on any other. */
function keptErrorOn(mic: { channel: number; castMemberId: number | null }) {
  const keptMic = keptOn(mic);
  const before = neighbours.value.previous?.title;
  if (!keptMic || !before || !place.value) return [];
  return [keptMicError(keptMic, { before, current: place.value.item.title }, nameOf)];
}
const itemCast = computed(() =>
  place.value ? castInItem(place.value.item.id, roles.value, cast.value) : [],
);
/** Who can be given the channel here. */
const choicesOn = (channel: number) =>
  choicesFor(channel, itemCast.value, plot.value, heldBefore.value.get(channel));
/** A free channel no one can have, as someone else had it in the item before: greyed out.
 *  Those who can't change the plot see any held channel this way, even one its holder could
 *  keep: there's nothing for them to choose. */
const isHeld = (mic: { channel: number; castMemberId: number | null }) =>
  mic.castMemberId === null &&
  heldBefore.value.has(mic.channel) &&
  (!canChange("mic-plot") || choicesOn(mic.channel).length === 0);
const nameOf = (castMemberId: number | null) => {
  const member = cast.value.find((m) => m.id === castMemberId);
  return member ? fullName(member) : "";
};

// A message or half-typed name on one item's mics never carries over to the next.
watch(
  () => route.params.itemId,
  () => {
    typed.value = new Map();
    announcement.value = "";
    problem.value = "";
  },
);

// Every item's mics and the casting, loaded with the running order the frame shows; no mic
// plot, casting or cast list yet just means nobody is on a mic or cast.
async function loadMics() {
  const [loadedPlots, loadedRoles, loadedCast] = await Promise.all([
    loadData(micPlotPath(), MicPlotList),
    loadData(rolesPath(), RoleList),
    loadData(castPath(), CastList),
  ]);
  return (loadedOrder: RunningOrder) => {
    order.value = loadedOrder;
    plots.value = loadedPlots?.items ?? [];
    roles.value = loadedRoles?.roles ?? [];
    cast.value = loadedCast?.members ?? [];
  };
}

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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    show(ItemMicPlot.parse(await res.json()));
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
  <ItemPageFrame v-slot="{ item }" department="mic-plot" :load="loadMics">
    <p v-if="problem" class="notice" role="alert" data-test="mic-problem">{{ problem }}</p>
    <!-- An explicit list role: Safari drops list semantics once bullets are styled away. -->
    <ol class="mic-channels" role="list" aria-label="Mics">
      <!-- A card per channel, as the role, prop and file cards: its clear icon first, as
           theirs. -->
      <li
        v-for="mic in channels"
        :key="mic.channel"
        class="card mic-channel"
        :class="{ 'mic-held': isHeld(mic), 'mic-kept': isKept(mic) }"
        data-test="mic"
        @focusout="leave(mic.channel)"
      >
        <template v-if="canChange('mic-plot')">
          <!-- card-icons: on phones the icon gets its own line, as on role and prop cards. -->
          <span class="card-icons row-icons">
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
          <template v-if="canChange('mic-plot')">
          <!-- Why a held channel is disabled is in its name, as well as shown under it. -->
          <label :for="pickerId(mic.channel)" class="mic-name"
            ><span data-test="channel">Mic {{ mic.channel }}</span
            ><span class="visually-hidden"
              > cast member{{ isHeld(mic) ? ", used in previous item" : ""
              }}{{ isKept(mic) ? ", can only be cleared" : "" }}</span
            ></label
          >
          <!-- A kept channel's Error icon beside who is on it, as casting puts a clash's by
               the name (FR10). -->
          <span class="mic-who" data-test="mic-who">
            <CastMemberPicker
              :model-value="choiceFor(mic.channel, mic.castMemberId)"
              :cast="choicesOn(mic.channel)"
              :name="`mic-${mic.channel}`"
              :input-id="pickerId(mic.channel)"
              :disabled="saving !== undefined || isHeld(mic) || isKept(mic)"
              no-match="No one in this item matches"
              @update:model-value="pick(mic.channel, $event)"
            />
            <ClashIcon :lines="keptErrorOn(mic)" />
          </span>
          <span v-if="isHeld(mic)" class="mic-held-reason" aria-hidden="true" data-test="mic-held"
            >Used in previous item</span
          >
          </template>
          <template v-else>
            <span class="mic-name" data-test="channel">Mic {{ mic.channel }}</span>
            <span class="mic-who" data-test="mic-who"
              ><span data-test="on-mic">{{
                isHeld(mic) ? "Used in previous item" : nameOf(mic.castMemberId) || "No one"
              }}</span
              ><ClashIcon :lines="keptErrorOn(mic)"
            /></span>
          </template>
          <!-- Why a kept channel is an error, in words for everyone, as a held one says why;
               the icon reads it out in full. -->
          <span v-if="keptOn(mic)" class="mic-held-reason" aria-hidden="true" data-test="mic-kept"
            >Used by {{ nameOf(keptOn(mic)?.heldBy ?? null) }} in previous item</span
          >
          <!-- Their roles in the item, from the casting: shown, never chosen (FR3). -->
          <span class="mic-roles" data-test="mic-roles">{{
            micRolesText(item.id, mic.castMemberId, roles)
          }}</span>
        </div>
      </li>
    </ol>
    <p class="visually-hidden" role="status" data-test="mic-status">{{ announcement }}</p>
  </ItemPageFrame>
</template>
