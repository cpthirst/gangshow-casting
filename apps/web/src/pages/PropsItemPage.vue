<script setup lang="ts">
import {
  CastList,
  type CastMember,
  Prop,
  type PropDetails,
  PropList,
  type Role,
  RoleList,
  type RunningOrder,
} from "@app/shared";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ItemPageFrame from "@/components/common/ItemPageFrame.vue";
import PropCard from "@/components/production/PropCard.vue";
import PropForm from "@/components/production/PropForm.vue";
import { useItemPlace } from "@/composables/useItemPlace.ts";
import { useListEditing } from "@/composables/useListEditing.ts";
import { loadData } from "@/services/load-data.ts";
import { addPropPath, castPath, propPath, propsPath, rolesPath } from "@/services/production.ts";
import { canChange, deleteStatus, sendJson } from "@/services/sign-in.ts";
import { sortProps } from "@/utils/props.ts";
import { sortRoles } from "@/utils/roles.ts";

// One item's props (production-props FR16, FR17, FR19), in the frame every item page shares,
// with the item's Props notes under them.

const route = useRoute();
const order = ref<RunningOrder>();
const props = ref<Prop[]>([]);
// The casting, for each prop's roles and who plays them (production-props FR18).
const roles = ref<Role[]>([]);
const cast = ref<CastMember[]>([]);

const place = useItemPlace(order);

const itemProps = computed(() =>
  sortProps(props.value.filter((prop) => prop.itemId === place.value?.item.id)),
);

const itemRoles = computed(() =>
  sortRoles(roles.value.filter((role) => role.itemId === place.value?.item.id)),
);

// Every prop and the casting, loaded with the running order the frame shows; no props,
// casting or cast list yet just means there are none.
async function loadProps() {
  const [loadedProps, loadedRoles, loadedCast] = await Promise.all([
    loadData(propsPath(), PropList),
    loadData(rolesPath(), RoleList),
    loadData(castPath(), CastList),
  ]);
  return (loadedOrder: RunningOrder) => {
    order.value = loadedOrder;
    props.value = loadedProps?.props ?? [];
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
  clearMessages,
} = useListEditing<Prop>("data-prop-id");

// A form opened on one item never carries over to the next (Previous and Next reuse the page).
watch(
  () => route.params.itemId,
  () => {
    adding.value = false;
    editing.value = null;
    clearMessages();
  },
);

// Saves straight away. On failure the form stays open with the edit in it.
async function saveEdit(details: PropDetails) {
  const prop = editing.value;
  if (!prop || saving.value) return;
  saving.value = true;
  formError.value = "";
  const result = await putProp(prop.id, details);
  saving.value = false;
  if (result === "gone") {
    editing.value = null;
    await showGone(prop);
    return;
  }
  if (!result) {
    formError.value = "Couldn't save the prop. Try again.";
    return;
  }
  props.value = props.value.map((p) => (p.id === result.id ? result : p));
  await stopEditing(result.id);
}

async function putProp(id: number, details: PropDetails) {
  try {
    const res = await sendJson(propPath(id), "PUT", details);
    if (res.ok) return Prop.parse(await res.json());
    return res.status === 404 ? "gone" : undefined;
  } catch {
    return undefined;
  }
}

// Permanent (production-props FR19), so confirm first.
async function removeProp(prop: Prop) {
  if (busy.value || !place.value) return;
  if (!window.confirm(`Remove the prop ${prop.name} from ${place.value.item.title}?`)) return;
  saving.value = true;
  notice.value = "";
  const status = await deleteStatus(propPath(prop.id));
  saving.value = false;
  if (status === 204) {
    props.value = props.value.filter((p) => p.id !== prop.id);
    // Its buttons are gone, so keep keyboard focus on the page.
    await focusAddButton();
  } else if (status === 404) {
    await showGone(prop);
  } else {
    notice.value = `Couldn't remove ${prop.name}. Try again.`;
  }
}

// Someone else removed the prop first: say so and show what's current, if it can be loaded.
async function showGone(prop: Prop) {
  const latest = (await reloadProps()) ? "Showing the latest props." : "Reload to see the latest.";
  notice.value = `${prop.name} is no longer there: someone else removed it. ${latest}`;
}

/** Shows the latest props, or keeps what's shown if they can't be loaded. True if loaded. */
async function reloadProps() {
  try {
    props.value = (await loadData(propsPath(), PropList))?.props ?? [];
    return true;
  } catch {
    return false;
  }
}

// Saves straight away. On failure the form stays open with what was typed.
async function add(details: PropDetails) {
  if (!place.value || saving.value) return;
  saving.value = true;
  formError.value = "";
  const prop = await postProp(place.value.item.id, details);
  saving.value = false;
  if (!prop) {
    formError.value = "Couldn't add the prop. Try again.";
    return;
  }
  props.value = [...props.value, prop];
  await stopAdding();
}

async function postProp(itemId: string, details: PropDetails) {
  try {
    const res = await sendJson(addPropPath(itemId), "POST", details);
    return res.status === 201 ? Prop.parse(await res.json()) : undefined;
  } catch {
    return undefined;
  }
}
</script>

<template>
  <ItemPageFrame department="props" :load="loadProps">
    <div v-if="canChange('props')" class="button-row">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-prop"
        :disabled="busy"
        @click="startAdding"
      >
        Add prop
      </button>
    </div>
    <p v-if="notice" class="notice" role="alert">{{ notice }}</p>
    <PropForm
      v-if="adding"
      :saving="saving"
      :error="formError"
      :roles="itemRoles"
      :cast="cast"
      @save="add"
      @cancel="stopAdding"
    />
    <!-- An explicit list role: Safari drops list semantics once bullets are styled away. -->
    <ul v-if="itemProps.length > 0" class="card-list" role="list" aria-label="Props">
      <template v-for="prop in itemProps" :key="prop.id">
        <!-- While editing, the card holds the form instead. -->
        <li v-if="editing?.id === prop.id" class="card editing" :data-prop-id="prop.id">
          <PropForm
            :prop="prop"
            :saving="saving"
            :error="formError"
            :roles="itemRoles"
            :cast="cast"
            @save="saveEdit"
            @cancel="stopEditing(prop.id)"
          />
        </li>
        <PropCard
          v-else
          :prop="prop"
          :roles="itemRoles"
          :cast="cast"
          :can-change="canChange('props')"
          :busy="busy"
          @edit="startEditing(prop)"
          @remove="removeProp(prop)"
        />
      </template>
    </ul>
    <p v-else>No props have been added yet.</p>
  </ItemPageFrame>
</template>
