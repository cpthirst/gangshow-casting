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
import { apiFetch, canChangeStage } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { addPropPath, PROPS_PATH, sortProps } from "@/utils/props.ts";
import { PROPS_NOTES_PATH, savePropsNotesPath } from "@/utils/props-notes.ts";
import { ROLES_PATH, sortRoles } from "@/utils/roles.ts";
import { neighboursOf, placeOf, positionOf, RUNNING_ORDER_PATH } from "@/utils/running-order.ts";

// One item's props (stage-props FR16, FR17), laid out as the item's casting page.

const route = useRoute();
const order = ref<RunningOrder>();
const props = ref<Prop[]>([]);
// The casting, for each prop's roles and who plays them (stage-props FR18).
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

// Follows the item even if the page is reused for another one (Previous and Next).
watchEffect(() => {
  if (place.value) showPageTitle(place.value.item.title);
  else if (notFound.value) showPageTitle("Item not found");
});

onMounted(async () => {
  try {
    const [orderRes, propsRes, rolesRes, castRes] = await Promise.all([
      apiFetch(RUNNING_ORDER_PATH),
      apiFetch(PROPS_PATH),
      apiFetch(ROLES_PATH),
      apiFetch(CAST_PATH),
    ]);
    // No saved running order at all: no item can be in it.
    if (orderRes.status !== 404) {
      if (!orderRes.ok) throw new Error(`HTTP ${orderRes.status}`);
      order.value = RunningOrder.parse(await orderRes.json());
    }
    if (!propsRes.ok) throw new Error(`HTTP ${propsRes.status}`);
    props.value = PropList.parse(await propsRes.json()).props;
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
const saving = ref(false);
const formError = ref("");
const addButton = ref<HTMLButtonElement>();

// A form opened on one item never carries over to the next (Previous and Next reuse the page).
watch(
  () => route.params.itemId,
  () => {
    adding.value = false;
    formError.value = "";
  },
);

function startAdding() {
  formError.value = "";
  adding.value = true;
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
    :list="{ name: 'stage', query: { view: 'props' } }"
    item-route="props-item"
    :previous="neighbours.previous"
    :next="neighbours.next"
  />
  <p v-if="status === 'error'" role="alert">Couldn't load the item.</p>
  <template v-else-if="place">
    <div class="page-title-row">
      <h1>{{ place.item.title }}</h1>
      <HelpButton page="props-item" label="Help for this item" title="Item help" />
    </div>
    <p class="item-position" data-test="position">{{ position }}</p>
    <!-- Those without Stage see the props with nothing to change them. -->
    <ReadOnlyNotice about="props" />
    <div v-if="canChangeStage" class="cast-actions">
      <button
        ref="addButton"
        type="button"
        class="primary"
        data-test="add-prop"
        :disabled="adding || saving"
        @click="startAdding"
      >
        Add prop
      </button>
    </div>
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
      <PropCard
        v-for="prop in itemProps"
        :key="prop.id"
        :prop="prop"
        :roles="itemRoles"
        :cast="cast"
      />
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
      :can-change="canChangeStage"
    />
  </template>
  <template v-else-if="notFound">
    <h1>Item not found</h1>
    <p>It isn't in the latest saved running order. Choose an item from All items.</p>
  </template>
</template>
