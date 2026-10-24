<script setup lang="ts">
import {
  AddRoleRefusal,
  type AddRoleRequest,
  CastList,
  type CastMember,
  Role,
  RoleList,
  RunningOrder,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, ref, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
import ClashIcon from "../ClashIcon.vue";
import { CAST_PATH, sortCast } from "../cast.ts";
import { clashesOf, describeEach, findClashes } from "../clashes.ts";
import HelpButton from "../HelpButton.vue";
import { icons } from "../icons.ts";
import ReadOnlyNotice from "../ReadOnlyNotice.vue";
import {
  addRolePath,
  nameTakenMessage,
  ROLES_PATH,
  removeRolePath,
  roleSizeLabel,
  sortRoles,
  updateRolePath,
} from "../roles.ts";
import { showPageTitle } from "../router.ts";
import { neighboursOf, placeOf, RUNNING_ORDER_PATH } from "../running-order.ts";
import { apiFetch, isReadOnly } from "../sign-in.ts";
import { recordItemUse } from "../usage.ts";
import ItemNotes from "./ItemNotes.vue";
import RoleForm from "./RoleForm.vue";

const route = useRoute();
const order = ref<RunningOrder>();
const roles = ref<Role[]>([]);
const cast = ref<CastMember[]>([]);

// Roles hold ids; names come from the cast list (ADR 0010), by last name (an ensemble's
// members, casting-roles FR5). Someone no longer on the cast shows nothing.
const castOf = (role: Role) =>
  sortCast(cast.value.filter((member) => role.castMemberIds.includes(member.id)));
const fullName = (member: CastMember) => `${member.firstName} ${member.lastName}`;
const castNames = (role: Role) => castOf(role).map(fullName).join(", ");
const status = ref<"loading" | "loaded" | "error">("loading");

const place = computed(() => {
  const itemId = route.params.itemId;
  return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
});

// Worked out from the saved running order and every role, so other items count too
// (casting-rules FR1).
const clashes = computed(() => (order.value ? findClashes(order.value, roles.value) : []));

/** Who's in this item's roles other than one, for Add All Cast (casting-roles FR11). */
const inOtherRoles = (roleId?: number) =>
  itemRoles.value.filter((role) => role.id !== roleId).flatMap((role) => role.castMemberIds);

const clashesHere = (member: CastMember, itemId: string) =>
  describeEach(clashesOf(clashes.value, member.id, itemId));

const itemRoles = computed(() =>
  sortRoles(roles.value.filter((role) => role.itemId === place.value?.item.id)),
);

// A role can't repeat a name another role in the item has (PRD FR3); the role being edited
// keeps its own.
const takenNames = computed(() => ({
  itemTitle: place.value?.item.title ?? "",
  names: itemRoles.value.filter((role) => role.id !== editing.value?.id).map((role) => role.name),
}));

// Step through the items in show order without going back to the list.
const neighbours = computed(() =>
  order.value && place.value ? neighboursOf(order.value, place.value.item.id) : {},
);

// Loaded, but the item isn't in the latest saved running order (PRD FR6).
const notFound = computed(() => status.value === "loaded" && !place.value);

// "Item 2 · First half", or just the half for an item without a programme number.
const position = computed(() => {
  if (!place.value) return "";
  const { half, number } = place.value;
  return number === null
    ? `${half.name} · Not in printed programme`
    : `Item ${number} · ${half.name}`;
});

// Each item opened is a use, once it's found in the running order (usage-tracking FR2).
watch(
  () => place.value?.item.id,
  (itemId) => {
    if (order.value && itemId) recordItemUse(order.value.productionId, itemId);
  },
);

// Follows the item even if the page is reused for another one (back/forward between items).
watchEffect(() => {
  if (place.value) showPageTitle(place.value.item.title);
  else if (notFound.value) showPageTitle("Item not found");
});

onMounted(async () => {
  try {
    // Name and position come from the latest saved running order, like the Items list.
    const [orderRes, rolesRes, castRes] = await Promise.all([
      apiFetch(RUNNING_ORDER_PATH),
      apiFetch(ROLES_PATH),
      apiFetch(CAST_PATH),
    ]);
    // No saved running order at all: no item can be in it.
    if (orderRes.status !== 404) {
      if (!orderRes.ok) throw new Error(`HTTP ${orderRes.status}`);
      order.value = RunningOrder.parse(await orderRes.json());
    }
    if (!rolesRes.ok) throw new Error(`HTTP ${rolesRes.status}`);
    roles.value = RoleList.parse(await rolesRes.json()).roles;
    // No cast list yet just means nobody can be cast.
    if (castRes.status !== 404) {
      if (!castRes.ok) throw new Error(`HTTP ${castRes.status}`);
      cast.value = CastList.parse(await castRes.json()).members;
    }
    status.value = "loaded";
  } catch {
    // A failed load must never look like "not found".
    status.value = "error";
  }
});

const adding = ref(false);
/** The role whose edit form is open, if any. One form at a time. */
const editing = ref<Role | null>(null);
const saving = ref(false);
const formError = ref("");
const notice = ref("");
const addButton = ref<HTMLButtonElement>();
const busy = computed(() => adding.value || editing.value !== null || saving.value);

function startAdding() {
  formError.value = "";
  notice.value = "";
  adding.value = true;
}

function startEditing(role: Role) {
  formError.value = "";
  notice.value = "";
  editing.value = role;
}

async function stopEditing(id: number) {
  editing.value = null;
  await nextTick();
  document.querySelector<HTMLButtonElement>(`[data-role-id="${id}"] [data-test=edit]`)?.focus();
}

// Saves straight away (PRD FR8), unless someone else changed or removed the role first.
async function saveEdit(details: AddRoleRequest) {
  const role = editing.value;
  if (!role || !place.value || saving.value) return;
  saving.value = true;
  formError.value = "";
  const result = await putRole(role, details);
  saving.value = false;
  if (result === "name-taken") {
    formError.value = nameTakenMessage(place.value.item.title, details.name);
    return;
  }
  if (result === "conflict") {
    editing.value = null;
    await showConflict();
    return;
  }
  if (!result) {
    formError.value = "Couldn't save the role. Try again.";
    return;
  }
  roles.value = roles.value.map((r) => (r.id === result.id ? result : r));
  await stopEditing(result.id);
}

async function putRole(role: Role, details: AddRoleRequest) {
  try {
    const res = await apiFetch(updateRolePath(role.id), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...details, revision: role.revision }),
    });
    if (res.ok) return Role.parse(await res.json());
    if (res.status === 409 || res.status === 404) return "conflict";
    if (res.status === 400 && AddRoleRefusal.safeParse(await res.json()).success) {
      return "name-taken";
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Someone else changed or removed the role first: say so and show what's current.
async function showConflict() {
  await loadRoles();
  notice.value = "Someone else changed this role. Showing the latest roles.";
}

// Permanent (no history: roles link children to parts, ADR 0010), so confirm first.
async function removeRole(role: Role) {
  if (busy.value || !place.value) return;
  const question = `Remove the role ${role.name} from ${place.value.item.title}? Anyone cast in it will be uncast.`;
  if (!window.confirm(question)) return;
  saving.value = true;
  notice.value = "";
  const status = await sendRemove(role);
  saving.value = false;
  if (status === 204) {
    roles.value = roles.value.filter((r) => r.id !== role.id);
    // Its buttons are gone, so keep keyboard focus on the page.
    await nextTick();
    addButton.value?.focus();
  } else if (status === 409 || status === 404) {
    await showConflict();
  } else {
    notice.value = `Couldn't remove ${role.name}. Try again.`;
  }
}

// The status code, or undefined if the request didn't get an answer.
async function sendRemove(role: Role) {
  try {
    return (await apiFetch(removeRolePath(role), { method: "DELETE" })).status;
  } catch {
    return undefined;
  }
}

async function loadRoles() {
  try {
    const res = await apiFetch(ROLES_PATH);
    if (res.ok) roles.value = RoleList.parse(await res.json()).roles;
  } catch {
    // Keep what's shown; the notice still says it may be out of date.
  }
}

async function stopAdding() {
  adding.value = false;
  await nextTick();
  addButton.value?.focus();
}

// Saves straight away (PRD FR8). On failure the form stays open with what was typed.
async function add(details: AddRoleRequest) {
  if (!place.value || saving.value) return;
  saving.value = true;
  formError.value = "";
  const role = await postRole(place.value.item.id, details);
  saving.value = false;
  if (role === "name-taken") {
    // Someone else added a role with this name since the page loaded.
    formError.value = nameTakenMessage(place.value.item.title, details.name);
    return;
  }
  if (!role) {
    formError.value = "Couldn't add the role. Try again.";
    return;
  }
  roles.value = [...roles.value, role];
  await stopAdding();
}

async function postRole(itemId: string, details: AddRoleRequest) {
  try {
    const res = await apiFetch(addRolePath(itemId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(details),
    });
    if (res.status === 201) return Role.parse(await res.json());
    if (res.status === 400 && AddRoleRefusal.safeParse(await res.json()).success) {
      return "name-taken";
    }
    return undefined;
  } catch {
    return undefined;
  }
}
</script>

<template>
  <nav class="step-nav" aria-label="Item navigation">
    <RouterLink :to="{ name: 'casting-items' }" class="back-link">
      <span class="step-label"><FontAwesomeIcon :icon="icons.allItems" /> All items</span>
    </RouterLink>
    <RouterLink
      v-if="neighbours.previous"
      :to="{ name: 'casting-item', params: { itemId: neighbours.previous.id } }"
      rel="prev"
      :data-tooltip="neighbours.previous.title"
      class="step-link step-previous"
    >
      <span class="step-label"><FontAwesomeIcon :icon="icons.back" /> Previous</span>
      <!-- A real space, so the link reads "Previous Pirate Sketch", not one word. -->
      {{ " " }}
      <span class="step-title">{{ neighbours.previous.title }}</span>
    </RouterLink>
    <RouterLink
      v-if="neighbours.next"
      :to="{ name: 'casting-item', params: { itemId: neighbours.next.id } }"
      rel="next"
      :data-tooltip="neighbours.next.title"
      class="step-link step-next"
    >
      <span class="step-label">Next <FontAwesomeIcon :icon="icons.forward" /></span>
      {{ " " }}
      <span class="step-title">{{ neighbours.next.title }}</span>
    </RouterLink>
  </nav>
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <div class="page-title-row">
      <h1>{{ place.item.title }}</h1>
      <HelpButton page="casting-item" label="Help for this item" title="Item help" />
    </div>
    <p class="item-position" data-test="position">{{ position }}</p>
    <!-- Read-only members see the roles and notes with nothing to change them (team-roles FR6). -->
    <ReadOnlyNotice />
    <div v-if="!isReadOnly" class="cast-actions">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-role"
        :disabled="busy"
        @click="startAdding"
      >
        Add role
      </button>
    </div>
    <p v-if="notice" class="notice" role="alert">{{ notice }}</p>
    <RoleForm
      v-if="adding"
      :saving="saving"
      :error="formError"
      :taken="takenNames"
      :cast="cast"
      :in-other-roles="inOtherRoles()"
      @save="add"
      @cancel="stopAdding"
    />
    <!-- An explicit list role: Safari drops list semantics once bullets are styled away,
         and the count of roles should be announced (AC6). -->
    <ul v-if="itemRoles.length > 0" class="role-cards" role="list" aria-label="Roles">
      <li
        v-for="role in itemRoles"
        :key="role.id"
        :class="['role-card', { editing: editing?.id === role.id }]"
        :data-role-id="role.id"
        data-test="role"
      >
        <!-- While editing, the card holds the form instead. -->
        <RoleForm
          v-if="editing?.id === role.id"
          :role="role"
          :cast-name="castNames(role)"
          :saving="saving"
          :error="formError"
          :taken="takenNames"
          :cast="cast"
          :in-other-roles="inOtherRoles(role.id)"
          @save="saveEdit"
          @cancel="stopEditing(role.id)"
        />
        <template v-else>
          <!-- Icons first, as on the Running order and Items pages; above the role on phones. -->
          <span v-if="!isReadOnly" class="role-actions row-icons">
            <button
              type="button"
              class="icon-button"
              data-test="edit"
              :aria-label="`Edit ${role.name}`"
              data-tooltip="Edit role"
              :disabled="busy"
              @click="startEditing(role)"
            >
              <FontAwesomeIcon :icon="icons.edit" />
            </button>
            <button
              type="button"
              class="icon-button"
              data-test="remove"
              :aria-label="`Remove ${role.name}`"
              data-tooltip="Remove role"
              :disabled="busy"
              @click="removeRole(role)"
            >
              <FontAwesomeIcon :icon="icons.remove" />
            </button>
          </span>
          <span class="role-name">{{ role.name }}</span>
          <!-- Real spaces, so a screen reader hears "Captain Hook Lead Uncast", not one word. -->
          {{ " " }}
          <span :class="['pill', `pill-${role.size}`]" data-test="size">{{
            roleSizeLabel(role.size)
          }}</span>
          <template v-if="castOf(role).length > 0">
            {{ " " }}
            <span class="role-cast" data-test="cast">
              <template v-for="(member, i) in castOf(role)" :key="member.id"
                ><template v-if="i > 0">, </template
                ><span class="cast-name" data-test="cast-name"
                  >{{ fullName(member)
                  }}<ClashIcon
                    :lines="clashesHere(member, place.item.id)" /></span
              ></template>
            </span>
          </template>
          <template v-if="role.castMemberIds.length === 0">
            {{ " " }}
            <span class="uncast" data-test="uncast">Uncast</span>
          </template>
        </template>
      </li>
    </ul>
    <p v-else>No roles have been added yet.</p>
    <!-- A fresh instance per item, so stepping to another never mixes their notes. -->
    <ItemNotes :key="place.item.id" :item-id="place.item.id" />
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
