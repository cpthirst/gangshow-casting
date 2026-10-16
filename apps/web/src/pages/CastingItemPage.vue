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
import { computed, nextTick, onMounted, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { CAST_PATH } from "../cast.ts";
import { addRolePath, nameTakenMessage, ROLES_PATH, roleSizeLabel, sortRoles } from "../roles.ts";
import { showPageTitle } from "../router.ts";
import { placeOf, RUNNING_ORDER_PATH } from "../running-order.ts";
import RoleForm from "./RoleForm.vue";

const route = useRoute();
const order = ref<RunningOrder>();
const roles = ref<Role[]>([]);
const cast = ref<CastMember[]>([]);

// Roles hold ids; names come from the cast list (ADR 0010). Someone no longer on it shows nothing.
const castNames = (role: Role) =>
  role.castMemberIds
    .map((id) => cast.value.find((member) => member.id === id))
    .flatMap((member) => (member ? [`${member.firstName} ${member.lastName}`] : []))
    .join(", ");
const status = ref<"loading" | "loaded" | "error">("loading");

const place = computed(() => {
  const itemId = route.params.itemId;
  return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
});

const itemRoles = computed(() =>
  sortRoles(roles.value.filter((role) => role.itemId === place.value?.item.id)),
);

// A new role can't repeat a name the item already has (PRD FR3).
const takenNames = computed(() => ({
  itemTitle: place.value?.item.title ?? "",
  names: itemRoles.value.map((role) => role.name),
}));

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

// Follows the item even if the page is reused for another one (back/forward between items).
watchEffect(() => {
  if (place.value) showPageTitle(place.value.item.title);
  else if (notFound.value) showPageTitle("Item not found");
});

onMounted(async () => {
  try {
    // Name and position come from the latest saved running order, like the Items list.
    const [orderRes, rolesRes, castRes] = await Promise.all([
      fetch(RUNNING_ORDER_PATH),
      fetch(ROLES_PATH),
      fetch(CAST_PATH),
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
const saving = ref(false);
const formError = ref("");
const addButton = ref<HTMLButtonElement>();

function startAdding() {
  formError.value = "";
  adding.value = true;
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
    const res = await fetch(addRolePath(itemId), {
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
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <RouterLink :to="{ name: 'casting-items' }" class="back-link">All items</RouterLink>
  </nav>
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <h1>{{ place.item.title }}</h1>
    <p class="item-position" data-test="position">{{ position }}</p>
    <div class="cast-actions">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-role"
        :disabled="adding || saving"
        @click="startAdding"
      >
        Add role
      </button>
    </div>
    <RoleForm
      v-if="adding"
      :saving="saving"
      :error="formError"
      :taken="takenNames"
      :cast="cast"
      @save="add"
      @cancel="stopAdding"
    />
    <!-- An explicit list role: Safari drops list semantics once bullets are styled away,
         and the count of roles should be announced (AC6). -->
    <ul v-if="itemRoles.length > 0" class="role-cards" role="list" aria-label="Roles">
      <li v-for="role in itemRoles" :key="role.id" class="role-card" data-test="role">
        <span class="role-name">{{ role.name }}</span>
        <!-- Real spaces, so a screen reader hears "Captain Hook Lead Uncast", not one word. -->
        {{ " " }}
        <span :class="['pill', `pill-${role.size}`]" data-test="size">{{
          roleSizeLabel(role.size)
        }}</span>
        <template v-if="castNames(role)">
          {{ " " }}
          <span class="role-cast" data-test="cast">{{ castNames(role) }}</span>
        </template>
        <template v-if="role.castMemberIds.length === 0">
          {{ " " }}
          <span class="uncast" data-test="uncast">Uncast</span>
        </template>
      </li>
    </ul>
    <p v-else>No roles have been added yet.</p>
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
