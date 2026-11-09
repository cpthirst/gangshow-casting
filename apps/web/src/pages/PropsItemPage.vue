<script setup lang="ts">
import {
  type AddPropRequest,
  CastList,
  type CastMember,
  Prop,
  PropList,
  type Role,
  RoleList,
  type RunningOrder,
} from "@app/shared";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ItemPageFrame from "@/components/common/ItemPageFrame.vue";
import PropCard from "@/components/production/PropCard.vue";
import PropForm from "@/components/production/PropForm.vue";
import { loadData } from "@/services/load-data.ts";
import { apiFetch, canChange } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { addPropPath, PROPS_PATH, propPath, sortProps } from "@/utils/props.ts";
import { ROLES_PATH, sortRoles } from "@/utils/roles.ts";
import { placeOf } from "@/utils/running-order.ts";

// One item's props (production-props FR16, FR17, FR19), in the frame every item page shares,
// with the item's Props notes under them.

const route = useRoute();
const order = ref<RunningOrder>();
const props = ref<Prop[]>([]);
// The casting, for each prop's roles and who plays them (production-props FR18).
const roles = ref<Role[]>([]);
const cast = ref<CastMember[]>([]);

const place = computed(() => {
  const itemId = route.params.itemId;
  return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
});

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
    loadData(PROPS_PATH, PropList),
    loadData(ROLES_PATH, RoleList),
    loadData(CAST_PATH, CastList),
  ]);
  return (loadedOrder: RunningOrder) => {
    order.value = loadedOrder;
    props.value = loadedProps?.props ?? [];
    roles.value = loadedRoles?.roles ?? [];
    cast.value = loadedCast?.members ?? [];
  };
}

const adding = ref(false);
/** The prop whose edit form is open, if any. One form at a time. */
const editing = ref<Prop | null>(null);
const saving = ref(false);
const formError = ref("");
const notice = ref("");
const addButton = ref<HTMLButtonElement>();
const busy = computed(() => adding.value || editing.value !== null || saving.value);

// A form opened on one item never carries over to the next (Previous and Next reuse the page).
watch(
  () => route.params.itemId,
  () => {
    adding.value = false;
    editing.value = null;
    formError.value = "";
    notice.value = "";
  },
);

function startAdding() {
  formError.value = "";
  notice.value = "";
  adding.value = true;
}

function startEditing(prop: Prop) {
  formError.value = "";
  notice.value = "";
  editing.value = prop;
}

async function stopEditing(id: number) {
  editing.value = null;
  await nextTick();
  document.querySelector<HTMLButtonElement>(`[data-prop-id="${id}"] [data-test=edit]`)?.focus();
}

// Saves straight away. On failure the form stays open with the edit in it.
async function saveEdit(details: AddPropRequest) {
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

async function putProp(id: number, details: AddPropRequest) {
  try {
    const res = await apiFetch(propPath(id), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(details),
    });
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
  const status = await sendRemove(prop.id);
  saving.value = false;
  if (status === 204) {
    props.value = props.value.filter((p) => p.id !== prop.id);
    // Its buttons are gone, so keep keyboard focus on the page.
    await nextTick();
    addButton.value?.focus();
  } else if (status === 404) {
    await showGone(prop);
  } else {
    notice.value = `Couldn't remove ${prop.name}. Try again.`;
  }
}

// The status code, or undefined if the request didn't get an answer.
async function sendRemove(id: number) {
  try {
    return (await apiFetch(propPath(id), { method: "DELETE" })).status;
  } catch {
    return undefined;
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
    props.value = (await loadData(PROPS_PATH, PropList))?.props ?? [];
    return true;
  } catch {
    return false;
  }
}

async function stopAdding() {
  adding.value = false;
  await nextTick();
  addButton.value?.focus();
}

// Saves straight away. On failure the form stays open with what was typed.
async function add(details: AddPropRequest) {
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

async function postProp(itemId: string, details: AddPropRequest) {
  try {
    const res = await apiFetch(addPropPath(itemId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(details),
    });
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
