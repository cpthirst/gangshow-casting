<script setup lang="ts">
import { CastList, type CastMember, RoleList, RunningOrder } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import ClashIcon from "../ClashIcon.vue";
import { CAST_PATH } from "../cast.ts";
import { type Clash, clashesOfPerson, describeEach, findClashes } from "../clashes.ts";
import {
  biggestParts,
  castBySection,
  itemIdsInOrder,
  type PartCounts,
  partsByMember,
  peopleCount,
  sizesHeld,
  spokenParts,
  timelineOf,
} from "../overview.ts";
import { ROLES_PATH, roleSizeLabel } from "../roles.ts";
import { RUNNING_ORDER_PATH } from "../running-order.ts";
import ShowTimeline from "../ShowTimeline.vue";

const state = ref<
  { status: "loading" } | { status: "error" } | { status: "loaded"; cast: CastMember[] }
>({
  status: "loading",
});

// Loaded separately from the cast: if the casting fails, the cast still shows, without
// counts, and nobody is wrongly marked "No parts yet" (casting-overview FR8).
const parts = ref<Map<number, PartCounts> | "error">();
// From the same roles and running order, so they fail together: no icons then
// (casting-rules FR9, FR13).
const clashes = ref<Clash[]>([]);
// The show and everyone's parts in it, for each person's timeline; none until both load.
const timeline = ref<{ order: RunningOrder; parts: ReturnType<typeof biggestParts> }>();

// Each person carries their part counts: undefined while loading or unavailable, or
// when they have no parts in the show.
const sections = computed(() => {
  if (state.value.status !== "loaded") return [];
  const counts = parts.value instanceof Map ? parts.value : undefined;
  return castBySection(state.value.cast, counts).map(({ key, label, members }) => ({
    key,
    label,
    people: members.map((member) => ({
      member,
      counts: counts?.get(member.id),
      clashLines: describeEach(clashesOfPerson(clashes.value, member.id)),
      halves: timeline.value
        ? timelineOf(timeline.value.order, timeline.value.parts.get(member.id))
        : undefined,
    })),
  }));
});

// Each loader catches its own errors and shows them, so neither rejects.
onMounted(() => Promise.all([loadCast(), loadParts()]));

async function loadParts() {
  try {
    const [rolesRes, orderRes] = await Promise.all([fetch(ROLES_PATH), fetch(RUNNING_ORDER_PATH)]);
    if (!rolesRes.ok) throw new Error(`HTTP ${rolesRes.status}`);
    const roles = RoleList.parse(await rolesRes.json()).roles;
    // No saved running order: no items, so no roles count yet.
    if (orderRes.status === 404) {
      parts.value = partsByMember(roles, new Set());
      return;
    }
    if (!orderRes.ok) throw new Error(`HTTP ${orderRes.status}`);
    const order = RunningOrder.parse(await orderRes.json());
    clashes.value = findClashes(order, roles);
    timeline.value = { order, parts: biggestParts(roles) };
    parts.value = partsByMember(roles, itemIdsInOrder(order));
  } catch {
    parts.value = "error";
    clashes.value = [];
    timeline.value = undefined;
  }
}

async function loadCast() {
  try {
    const res = await fetch(CAST_PATH);
    // No cast list yet: an empty cast, not an error.
    if (res.status === 404) {
      state.value = { status: "loaded", cast: [] };
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = { status: "loaded", cast: CastList.parse(await res.json()).members };
  } catch {
    // A failed load must never look like an empty cast (casting-overview FR8).
    state.value = { status: "error" };
  }
}
</script>

<template>
  <h1>Overview</h1>
  <p>Everyone in the cast, by section, and how much they're cast.</p>
  <p v-if="state.status === 'error'" role="alert">Couldn't load the cast.</p>
  <template v-else-if="state.status === 'loaded'">
    <p v-if="parts === 'error'" class="notice" role="alert">Couldn't load the casting.</p>
    <p v-if="sections.length === 0">No cast members yet.</p>
    <section v-for="section in sections" :key="section.key" class="overview-section">
      <h2 :id="`section-${section.key}`">
        <span class="section-name">{{ section.label }}</span>
        <!-- A real space, so a screen reader hears "Scouts 3 people", not one word. -->
        {{ " " }}
        <span class="section-count">{{ peopleCount(section.people.length) }}</span>
      </h2>
      <!-- Cards like an item's role cards (casting-overview UI consistency). An explicit
           list role: Safari drops list semantics once bullets are styled away. -->
      <ul class="role-cards" role="list" :aria-labelledby="`section-${section.key}`">
        <li v-for="{ member, counts, clashLines, halves } in section.people" :key="member.id" class="role-card" data-test="person">
          <!-- Name and clash icon together, so the icon stays beside the name, as on an
               item's page, with any written-out clashes beneath. -->
          <span class="person-who">
            <span class="person-name role-name">{{ member.firstName }} {{ member.lastName }}</span>
            <ClashIcon :lines="clashLines" />
          </span>
          <template v-if="counts">
            <!-- Seen as pills; heard as "1 lead, 3 ensemble". -->
            <span class="person-parts" aria-hidden="true">
              <span
                v-for="{ size, count } in sizesHeld(counts)"
                :key="size"
                :class="['pill', `pill-${size}`]"
                data-test="size">
                {{ roleSizeLabel(size) }} · {{ count }}
              </span>
            </span>
            <span class="visually-hidden">{{ spokenParts(counts) }}</span>
          </template>
          <span v-else-if="parts instanceof Map" class="uncast" data-test="no-parts">No parts yet</span>
          <ShowTimeline v-if="halves" :halves="halves" />
        </li>
      </ul>
    </section>
  </template>
</template>
