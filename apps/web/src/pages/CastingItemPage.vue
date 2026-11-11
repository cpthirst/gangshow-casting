<script setup lang="ts">
import {
  AddRoleRefusal,
  type AddRoleRequest,
  CastList,
  type CastMember,
  Role,
  RoleList,
  type RunningOrder,
} from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref } from "vue";
import RoleForm from "@/components/casting/RoleForm.vue";
import ClashIcon from "@/components/common/ClashIcon.vue";
import ItemPageFrame from "@/components/common/ItemPageFrame.vue";
import { controlOf, useConfirm } from "@/composables/useConfirm.ts";
import { useItemPlace } from "@/composables/useItemPlace.ts";
import { useListEditing } from "@/composables/useListEditing.ts";
import { loadData } from "@/services/load-data.ts";
import {
  addRolePath,
  castPath,
  removeRolePath,
  rolesPath,
  updateRolePath,
} from "@/services/production.ts";
import { canChange, deleteStatus, sendJson } from "@/services/sign-in.ts";
import { clashesOf, describeEach, findClashes } from "@/utils/clashes.ts";
import { icons } from "@/utils/icons.ts";
import {
  castNames,
  castOf,
  fullName,
  nameTakenMessage,
  roleSizeLabel,
  sortRoles,
} from "@/utils/roles.ts";

// One item's roles and who plays them, in the frame every item page shares, with the item's
// Casting notes under them.

const order = ref<RunningOrder>();
const roles = ref<Role[]>([]);
const cast = ref<CastMember[]>([]);

const place = useItemPlace(order);
const askToConfirm = useConfirm();

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

// Every role and the cast, loaded with the running order the frame shows; no roles or cast
// list yet just means there are none.
async function loadCasting() {
  const [loadedRoles, loadedCast] = await Promise.all([
    loadData(rolesPath(), RoleList),
    loadData(castPath(), CastList),
  ]);
  return (loadedOrder: RunningOrder) => {
    order.value = loadedOrder;
    roles.value = loadedRoles?.roles ?? [];
    cast.value = loadedCast?.members ?? [];
  };
}

const {
  adding,
  addButton,
  editing,
  saving,
  formError,
  notice,
  busy,
  startAdding,
  stopAdding,
  startEditing,
  stopEditing,
  focusAddButton,
} = useListEditing<Role>("data-role-id");

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
    const res = await sendJson(updateRolePath(role.id), "PUT", {
      ...details,
      revision: role.revision,
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
async function removeRole(role: Role, event: MouseEvent) {
  if (busy.value || !place.value) return;
  const question = `Remove the role ${role.name} from ${place.value.item.title}? Anyone cast in it will be uncast.`;
  if (!(await askToConfirm(question, "Remove role", controlOf(event)))) return;
  saving.value = true;
  notice.value = "";
  const status = await deleteStatus(removeRolePath(role));
  saving.value = false;
  if (status === 204) {
    roles.value = roles.value.filter((r) => r.id !== role.id);
    // Its buttons are gone, so keep keyboard focus on the page.
    await focusAddButton();
  } else if (status === 409 || status === 404) {
    await showConflict();
  } else {
    notice.value = `Couldn't remove ${role.name}. Try again.`;
  }
}

async function loadRoles() {
  try {
    const list = await loadData(rolesPath(), RoleList);
    if (list) roles.value = list.roles;
  } catch {
    // Keep what's shown; the notice still says it may be out of date.
  }
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
    const res = await sendJson(addRolePath(itemId), "POST", details);
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
  <ItemPageFrame
    v-slot="{ item }"
    department="casting"
    :list="{ name: 'casting-items' }"
    :load="loadCasting"
  >
    <div v-if="canChange('casting')" class="button-row">
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
      :gang="item.gang"
      @save="add"
      @cancel="stopAdding"
    />
    <!-- An explicit list role: Safari drops list semantics once bullets are styled away,
         and the count of roles should be announced (AC6). -->
    <ul v-if="itemRoles.length > 0" class="card-list" role="list" aria-label="Roles">
      <li
        v-for="role in itemRoles"
        :key="role.id"
        :class="['card', { editing: editing?.id === role.id }]"
        :data-role-id="role.id"
        data-test="role"
      >
        <!-- While editing, the card holds the form instead. -->
        <RoleForm
          v-if="editing?.id === role.id"
          :role="role"
          :cast-name="castNames(role, cast)"
          :saving="saving"
          :error="formError"
          :taken="takenNames"
          :cast="cast"
          :in-other-roles="inOtherRoles(role.id)"
          :gang="item.gang"
          @save="saveEdit"
          @cancel="stopEditing(role.id)"
        />
        <template v-else>
          <!-- Icons first, as on the Running order and Items pages; above the role on phones. -->
          <span v-if="canChange('casting')" class="card-icons row-icons">
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
              @click="removeRole(role, $event)"
            >
              <FontAwesomeIcon :icon="icons.remove" />
            </button>
          </span>
          <span class="card-name">{{ role.name }}</span>
          <!-- Real spaces, so a screen reader hears "Captain Hook Lead Uncast", not one word. -->
          {{ " " }}
          <span :class="['pill', `pill-${role.size}`]" data-test="size">{{
            roleSizeLabel(role.size)
          }}</span>
          <template v-if="castOf(role, cast).length > 0">
            {{ " " }}
            <span class="role-cast" data-test="cast">
              <template v-for="(member, i) in castOf(role, cast)" :key="member.id"
                ><template v-if="i > 0">, </template
                ><span class="cast-name" data-test="cast-name"
                  >{{ fullName(member)
                  }}<ClashIcon
                    :lines="clashesHere(member, item.id)" /></span
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
  </ItemPageFrame>
</template>
