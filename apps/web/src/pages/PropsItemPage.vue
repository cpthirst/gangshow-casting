<script setup lang="ts">
import {
  type AddPropRequest,
  CastList,
  type CastMember,
  Prop,
  PropList,
  type Role,
  RoleList,
  RunningOrder,
} from "@app/shared";
import { computed, nextTick, onMounted, ref, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
import HelpButton from "@/components/common/HelpButton.vue";
import ItemNotes from "@/components/common/ItemNotes.vue";
import ItemStepNav from "@/components/common/ItemStepNav.vue";
import ReadOnlyNotice from "@/components/common/ReadOnlyNotice.vue";
import PropCard from "@/components/production/PropCard.vue";
import PropForm from "@/components/production/PropForm.vue";
import { showPageTitle } from "@/router/index.ts";
import { apiFetch, canChangeProps } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { addPropPath, PROPS_PATH, propPath, sortProps } from "@/utils/props.ts";
import { PROPS_NOTES_PATH, savePropsNotesPath } from "@/utils/props-notes.ts";
import { ROLES_PATH, sortRoles } from "@/utils/roles.ts";
import { neighboursOf, placeOf, positionOf, RUNNING_ORDER_PATH } from "@/utils/running-order.ts";

// One item's props (production-props FR16, FR17, FR19), laid out as the item's casting page.

const route = useRoute();
const order = ref<RunningOrder>();
const props = ref<Prop[]>([]);
// The casting, for each prop's roles and who plays them (production-props FR18).
const roles = ref<Role[]>([]);
const cast = ref<CastMember[]>([]);
const status = ref<"loading" | "loaded" | "error">("loading");

const place = computed(() => {
  const itemId = route.params.itemId;
  return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
});
const position = computed(() => (place.value ? positionOf(place.value) : ""));

// Step through the items in show order without going back to the list.
const neighbours = computed(() =>
  order.value && place.value ? neighboursOf(order.value, place.value.item.id) : {},
);

// Loaded, but the item isn't in the latest saved running order.
const notFound = computed(() => status.value === "loaded" && !place.value);

const itemProps = computed(() =>
  sortProps(props.value.filter((prop) => prop.itemId === place.value?.item.id)),
);

const itemRoles = computed(() =>
  sortRoles(roles.value.filter((role) => role.itemId === place.value?.item.id)),
);

// Named for the department too, as every Production overview button's page is.
const title = computed(() => (place.value ? `Props: ${place.value.item.title}` : ""));

// Follows the item even if the page is reused for another one (Previous and Next).
watchEffect(() => {
  if (place.value) showPageTitle(title.value);
  else if (notFound.value) showPageTitle("Item not found");
});

onMounted(async () => {
  try {
    const [orderRes, allProps, rolesRes, castRes] = await Promise.all([
      apiFetch(RUNNING_ORDER_PATH),
      fetchProps(),
      apiFetch(ROLES_PATH),
      apiFetch(CAST_PATH),
    ]);
    // No saved running order at all: no item can be in it.
    if (orderRes.status !== 404) {
      if (!orderRes.ok) throw new Error(`HTTP ${orderRes.status}`);
      order.value = RunningOrder.parse(await orderRes.json());
    }
    props.value = allProps;
    if (!rolesRes.ok) throw new Error(`HTTP ${rolesRes.status}`);
    roles.value = RoleList.parse(await rolesRes.json()).roles;
    // No cast list yet just means nobody is cast.
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
  const latest = (await loadProps()) ? "Showing the latest props." : "Reload to see the latest.";
  notice.value = `${prop.name} is no longer there: someone else removed it. ${latest}`;
}

/** Every prop in the production; throws if they can't be loaded. */
async function fetchProps() {
  const res = await apiFetch(PROPS_PATH);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return PropList.parse(await res.json()).props;
}

/** Shows the latest props, or keeps what's shown if they can't be loaded. True if loaded. */
async function loadProps() {
  try {
    props.value = await fetchProps();
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
  <ItemStepNav
    :list="{ name: 'production-overview' }"
    item-route="props-item"
    :previous="neighbours.previous"
    :next="neighbours.next"
  />
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <div class="page-title-row">
      <h1>{{ title }}</h1>
      <HelpButton page="props-item" label="Help for this item" title="Item help" />
    </div>
    <p class="item-position" data-test="position">{{ position }}</p>
    <!-- Those without Stage or Director see the props with nothing to change them. -->
    <ReadOnlyNotice about="props" />
    <div v-if="canChangeProps" class="cast-actions">
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
    <ul v-if="itemProps.length > 0" class="role-cards" role="list" aria-label="Props">
      <template v-for="prop in itemProps" :key="prop.id">
        <!-- While editing, the card holds the form instead. -->
        <li v-if="editing?.id === prop.id" class="role-card editing" :data-prop-id="prop.id">
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
          :can-change="canChangeProps"
          :busy="busy"
          @edit="startEditing(prop)"
          @remove="removeProp(prop)"
        />
      </template>
    </ul>
    <p v-else>No props have been added yet.</p>
    <!-- Apart from the casting notes. A fresh instance per item, so stepping to another never
         mixes their notes. -->
    <ItemNotes
      :key="place.item.id"
      :item-id="place.item.id"
      heading="Props notes"
      :list-path="PROPS_NOTES_PATH"
      :save-path="savePropsNotesPath(place.item.id)"
      :can-change="canChangeProps"
    />
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
