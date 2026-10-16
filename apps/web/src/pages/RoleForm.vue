<script setup lang="ts">
import { type AddRoleRequest, type CastMember, type Role, RoleSize } from "@app/shared";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, nextTick, onMounted, ref, useId, watch } from "vue";
import { sortCast } from "../cast.ts";
import { icons } from "../icons.ts";
import {
  type RoleForm,
  remainingCast,
  roleDetailsFrom,
  roleSizeLabel,
  type TakenNames,
} from "../roles.ts";
import CastMemberPicker from "./CastMemberPicker.vue";

// Adds a role (no role given) or edits one (role given, with who's cast in it named).
// taken: the item's other role names, which this one can't repeat.
// cast: the production's cast, to choose who plays the part.
// inOtherRoles: who's in the item's other roles, whom Add All Cast leaves out (FR11).
const props = defineProps<{
  saving: boolean;
  error: string;
  taken: TakenNames;
  cast: CastMember[];
  inOtherRoles: number[];
  role?: Role | undefined;
  castName?: string | undefined;
}>();
const emit = defineEmits<{ save: [details: AddRoleRequest]; cancel: [] }>();

// An ensemble lists its members, each removable, and searches for one more (casting-roles
// FR5). Otherwise the field holds the one person cast, if any. Choosing Ensemble switches
// to the members list; choosing another size switches back while it holds one person at
// most. With more, the list stays, and saving explains that it must be narrowed first (FR6).
const editsEnsemble = props.role?.size === "ensemble";
const castMemberId = props.role?.castMemberIds[0];
const form = ref<RoleForm>({
  name: props.role?.name ?? "",
  size: props.role?.size ?? "",
  castMember: editsEnsemble
    ? { query: "", id: null }
    : { query: props.castName ?? "", id: castMemberId ?? null },
  ...(editsEnsemble && props.role ? { members: [...props.role.castMemberIds] } : {}),
});

const fullName = (member: CastMember) => `${member.firstName} ${member.lastName}`;
const showsMembers = computed(() => form.value.members !== undefined);

watch(
  () => form.value.size,
  (size) => {
    const { members, castMember } = form.value;
    if (size === "ensemble" && !members) {
      form.value.members = castMember.id === null ? [] : [castMember.id];
      form.value.castMember = { query: "", id: null };
    } else if (size !== "ensemble" && members && members.length <= 1) {
      const [only] = members;
      // Rebuilt without members, so the form holds one cast member again.
      form.value = {
        name: form.value.name,
        size,
        castMember:
          only === undefined ? { query: "", id: null } : { query: nameOf(only), id: only },
      };
    }
  },
);

/** Who Add All Cast would add: everyone not in another role in this item (FR11). */
const remaining = computed(() =>
  remainingCast(props.cast, props.inOtherRoles, form.value.members ?? []),
);

// Fills the ensemble without saving: people can still be removed, and Cancel undoes it.
function addAllCast() {
  form.value.members = [...(form.value.members ?? []), ...remaining.value];
  announcement.value = "Added everyone not already in a role in this item.";
}

/** The ensemble's members, by last name; anyone no longer on the cast isn't shown. */
const memberList = computed(() =>
  sortCast(props.cast.filter((member) => form.value.members?.includes(member.id))),
);
/** Only people not already in the ensemble can be added (each is in it once). */
const addable = computed(() =>
  props.cast.filter((member) => !form.value.members?.includes(member.id)),
);

/** Screen-reader announcement of the last member added or removed. */
const announcement = ref("");
const nameOf = (id: number) => {
  const member = props.cast.find((m) => m.id === id);
  return member ? fullName(member) : "";
};

// Choosing someone in the search adds them, ready for the next.
watch(
  () => form.value.castMember.id,
  (id) => {
    if (id === null || !form.value.members) return;
    form.value.members = [...form.value.members, id];
    form.value.castMember = { query: "", id: null };
    announcement.value = `Added ${nameOf(id)}.`;
  },
);

// The Remove button disappears with the member, so focus moves to the search.
async function removeMember(id: number) {
  const { members } = form.value;
  if (!members) return;
  form.value.members = members.filter((member) => member !== id);
  announcement.value = `Removed ${nameOf(id)}.`;
  await nextTick();
  document.getElementById(idFor("castMember"))?.focus();
}
const errors = ref<Partial<Record<keyof RoleForm, string>>>({});

const uid = useId();
const idFor = (field: keyof RoleForm) => `${uid}-${field}`;
const addAllHintId = `${uid}-add-all-hint`;
const errorFor = (field: keyof RoleForm) => `${uid}-${field}-error`;
// Wires a field to its error message, if it has one.
const invalid = (field: keyof RoleForm) =>
  errors.value[field] ? { "aria-invalid": true, "aria-describedby": errorFor(field) } : {};

const nameInput = ref<HTMLInputElement>();
onMounted(() => nameInput.value?.focus());

// Escape cancels, except when it's closing the size list.
function onEscape(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLSelectElement)) emit("cancel");
}

function submit() {
  const result = roleDetailsFrom(form.value, props.taken);
  errors.value = result.ok ? {} : result.errors;
  if (result.ok) emit("save", result.details);
}
</script>

<template>
  <form
    class="cast-member-form"
    :aria-label="role ? `Edit ${role.name}` : 'Add role'"
    novalidate
    @submit.prevent="submit"
    @keydown.esc="onEscape"
  >
    <div class="field">
      <label :for="idFor('name')">Role name</label>
      <input
        :id="idFor('name')"
        ref="nameInput"
        v-model="form.name"
        name="name"
        autocomplete="off"
        v-bind="invalid('name')"
      />
      <p v-if="errors.name" :id="errorFor('name')" class="field-error">{{ errors.name }}</p>
    </div>
    <div class="field">
      <label :for="idFor('size')">Role size</label>
      <select :id="idFor('size')" v-model="form.size" name="size" v-bind="invalid('size')">
        <option value="">Choose…</option>
        <option v-for="size in RoleSize.options" :key="size" :value="size">
          {{ roleSizeLabel(size) }}
        </option>
      </select>
      <p v-if="errors.size" :id="errorFor('size')" class="field-error">{{ errors.size }}</p>
    </div>
    <div class="field">
      <div v-if="showsMembers" class="members-block" data-test="members">
        <p :id="idFor('members')" class="field-label">Members</p>
        <ul class="members row-icons" :aria-labelledby="idFor('members')">
          <li v-for="member in memberList" :key="member.id" data-test="member">
            <button
              type="button"
              class="icon-button"
              :aria-label="`Remove ${fullName(member)} from ${role?.name ?? 'the ensemble'}`"
              data-tooltip="Remove from the ensemble"
              @click="removeMember(member.id)"
            >
              <FontAwesomeIcon :icon="icons.remove" />
            </button>
            <span class="member-name">{{ fullName(member) }}</span>
          </li>
          <li v-if="memberList.length === 0" class="uncast">Nobody yet</li>
        </ul>
        <p class="visually-hidden" role="status">{{ announcement }}</p>
        <div class="add-all-cast">
          <button
            type="button"
            data-test="add-all-cast"
            :disabled="saving || remaining.length === 0"
            :aria-describedby="remaining.length === 0 ? addAllHintId : undefined"
            @click="addAllCast"
          >
            Add all cast
          </button>
          <p
            v-if="remaining.length === 0"
            :id="addAllHintId"
            class="hint"
            data-test="add-all-cast-hint"
          >
            Everyone is already in a role in this item
          </p>
        </div>
      </div>
      <label :for="idFor('castMember')">
        <template v-if="showsMembers">Add a member</template>
        <template v-else>Cast member <span class="optional">(optional)</span></template>
      </label>
      <CastMemberPicker
        v-model="form.castMember"
        :cast="showsMembers ? addable : cast"
        :input-id="idFor('castMember')"
        :described-by="errors.castMember ? errorFor('castMember') : undefined"
      />
      <p v-if="errors.castMember" :id="errorFor('castMember')" class="field-error">
        {{ errors.castMember }}
      </p>
    </div>
    <p v-if="error" class="field-error form-error" role="alert">{{ error }}</p>
    <div class="editor-actions">
      <button type="submit" class="primary" :disabled="saving">Save</button>
      <button type="button" data-test="cancel" :disabled="saving" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
