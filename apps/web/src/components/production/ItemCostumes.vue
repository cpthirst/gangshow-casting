<script setup lang="ts">
import {
  type CastMember,
  Costume,
  type CostumeFields,
  type Role,
  type SaveCostumeRequest,
} from "@app/shared";
import { computed, ref } from "vue";
import EditButton from "@/components/common/EditButton.vue";
import { useListEditing } from "@/composables/useListEditing.ts";
import { saveCostumePath } from "@/services/production.ts";
import { sendJson } from "@/services/sign-in.ts";
import {
  type CostumeRow,
  costumeFields,
  costumeOf,
  costumeRowsOf,
  rowName,
  withSaved,
} from "@/utils/costumes.ts";
import { fullName } from "@/utils/roles.ts";
import CostumeForm from "./CostumeForm.vue";
import RoleCast from "./RoleCast.vue";

// Who wears what in one item, on its Wardrobe page (production-costume-sheets FR2–FR6): a
// row per cast member per role, read from the casting as it is now, each with its three
// fields. Those who can change costumes edit one row at a time, in the row.
// roles, cast and costumes: the production's. The page gives each item a fresh instance, so
// an open form never carries over to the next.
const props = defineProps<{
  itemId: string;
  roles: Role[];
  cast: CastMember[];
  canChange: boolean;
}>();
const costumes = defineModel<Costume[]>("costumes", { required: true });

const rows = computed(() => costumeRowsOf(props.roles, props.cast, props.itemId));

/** A cast row: someone in a role, never an uncast role's row. */
type CastRow = CostumeRow & { member: CastMember };
/** Each cast row's id, for putting focus back on its pencil when its form closes. */
const rowId = ({ role, member }: CastRow) => `${role.id}-${member.id}`;

const { editing, saving, formError, startEditing, stopEditing } =
  useListEditing<CastRow>("data-costume");

/** Whether the row is the one whose form is open. */
const isEditing = (row: CastRow) => editing.value !== null && rowId(editing.value) === rowId(row);
/** "Costume saved." once a save lands, for screen readers. */
const announcement = ref("");

/** The row's fields with any text, in order, with their labels: an empty one shows nothing. */
function filledIn({ role, member }: CastRow) {
  const costume = costumeOf(costumes.value, role, member);
  return costumeFields.flatMap(({ key, label }) =>
    costume[key] ? [{ key, label, text: costume[key] }] : [],
  );
}

function edit(row: CastRow) {
  announcement.value = "";
  startEditing(row);
}

// Saves straight away. On failure the form stays open with what was typed. If someone else
// saved the row first, the form shows their text instead, to edit from there (FR7).
async function save(row: CastRow, fields: CostumeFields) {
  if (saving.value) return;
  saving.value = true;
  formError.value = "";
  const { revision } = costumeOf(costumes.value, row.role, row.member);
  const result = await putCostume({
    roleId: row.role.id,
    castMemberId: row.member.id,
    ...fields,
    revision,
  });
  saving.value = false;
  if (!result) {
    formError.value = "Couldn't save the costume. Try again.";
    return;
  }
  costumes.value = withSaved(costumes.value, result.costume);
  if (result.stale) {
    formError.value =
      "Someone else saved this costume first. Here it is now; your changes weren't saved.";
    return;
  }
  announcement.value = "Costume saved.";
  await stopEditing(rowId(row));
}

/** The row as saved, or as someone else saved it first (stale); undefined if it failed. */
async function putCostume(body: SaveCostumeRequest) {
  try {
    const res = await sendJson(saveCostumePath(props.itemId), "PUT", body);
    if (!res.ok && res.status !== 409) return undefined;
    return { costume: Costume.parse(await res.json()), stale: res.status === 409 };
  } catch {
    return undefined;
  }
}
</script>

<template>
  <section class="item-section" aria-labelledby="costumes-heading">
    <h2 id="costumes-heading">Costumes</h2>
    <!-- One card per row, as the role and prop cards. An explicit list role: Safari drops list
         semantics once bullets are styled away. -->
    <ul v-if="rows.length > 0" class="card-list" role="list" aria-labelledby="costumes-heading">
      <template v-for="{ role, member } in rows" :key="`${role.id}-${member?.id ?? 'uncast'}`">
        <!-- While editing, the card holds the form instead. -->
        <li
          v-if="member && isEditing({ role, member })"
          class="card editing"
          data-test="costume"
        >
          <!-- Keyed by revision, so a refused save shows the row as someone else saved it. -->
          <CostumeForm
            :key="costumeOf(costumes, role, member).revision"
            :name="rowName(role, member)"
            :costume="costumeOf(costumes, role, member)"
            :saving="saving"
            :error="formError"
            @save="save({ role, member }, $event)"
            @cancel="stopEditing(rowId({ role, member }))"
          />
        </li>
        <li
          v-else
          class="card"
          :data-costume="member ? rowId({ role, member }) : undefined"
          data-test="costume"
        >
          <!-- The pencil first, as on the prop cards; above the row on phones. Usable while
               another row's form is open, on purpose: it moves the edit here (FR5). -->
          <span v-if="member && canChange" class="card-icons row-icons">
            <EditButton
              :label="`Edit ${rowName(role, member)}`"
              tooltip="Edit costume"
              :disabled="saving"
              @click="edit({ role, member })"
            />
          </span>
          <RoleCast :name="role.name" :cast="member ? fullName(member) : ''" none="Uncast" />
          <dl v-if="member" class="costume-fields">
            <div
              v-for="{ key, label, text } in filledIn({ role, member })"
              :key="key"
              data-test="costume-field"
            >
              <dt>{{ label }}</dt>
              <dd>{{ text }}</dd>
            </div>
          </dl>
        </li>
      </template>
    </ul>
    <p v-else data-test="no-costumes">Nobody is cast in this item yet.</p>
    <p class="visually-hidden" role="status">{{ announcement }}</p>
  </section>
</template>
