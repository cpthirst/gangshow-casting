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
import { useConfirm } from "@/composables/useConfirm.ts";
import { useListEditing } from "@/composables/useListEditing.ts";
import { saveCostumePath } from "@/services/production.ts";
import { sendJson } from "@/services/sign-in.ts";
import {
  type CastCostumeRow,
  type CostumeCopy,
  costumeCopiesOf,
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
// fields. Those who can change costumes edit one row at a time, in the row, and can copy a
// row's costume to others in the item (FR16).
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

/** Each cast row's id, for putting focus back on its pencil when its form closes. */
const rowId = ({ role, member }: CastCostumeRow) => `${role.id}-${member.id}`;

const { editing, saving, formError, startEditing, stopEditing } =
  useListEditing<CastCostumeRow>("data-costume");

/** Whether the row is the one whose form is open. */
const isEditing = (row: CastCostumeRow) =>
  editing.value !== null && rowId(editing.value) === rowId(row);
const askToConfirm = useConfirm();
/** "Costume saved." once a save lands, for screen readers. */
const announcement = ref("");

/** The row's fields with any text, in order, with their labels: an empty one shows nothing. */
function filledIn({ role, member }: CastCostumeRow) {
  const costume = costumeOf(costumes.value, role, member);
  return costumeFields.flatMap(({ key, label }) =>
    costume[key] ? [{ key, label, text: costume[key] }] : [],
  );
}

function edit(row: CastCostumeRow) {
  announcement.value = "";
  startEditing(row);
}

/** Why the open row's form couldn't save it. */
const refusals = {
  failed: "Couldn't save the costume. Try again.",
  stale: "Someone else saved this costume first. Here it is now; your changes weren't saved.",
};

/** Saves a row's fields from the revision the page has, keeping whatever the API answers
 *  with: the row as saved, or as someone else saved it first. */
async function saveRow({ role, member }: CastCostumeRow, fields: CostumeFields) {
  const { revision } = costumeOf(costumes.value, role, member);
  const result = await putCostume({
    roleId: role.id,
    castMemberId: member.id,
    ...fields,
    revision,
  });
  if (!result) return "failed";
  costumes.value = withSaved(costumes.value, result.costume);
  return result.stale ? "stale" : "saved";
}

/** Saves the open row, its form saying why if it can't: on failure the form keeps what was
 *  typed; if someone else saved the row first, it shows their text, to edit from there (FR7).
 *  Whether it was saved. */
async function saveOpenRow(row: CastCostumeRow, fields: CostumeFields) {
  formError.value = "";
  const outcome = await saveRow(row, fields);
  if (outcome !== "saved") formError.value = refusals[outcome];
  return outcome === "saved";
}

async function save(row: CastCostumeRow, fields: CostumeFields) {
  if (saving.value) return;
  saving.value = true;
  const saved = await saveOpenRow(row, fields);
  saving.value = false;
  if (!saved) return;
  announcement.value = "Costume saved.";
  await stopEditing(rowId(row));
}

// Asks first, then saves the row as Save does and copies it to the others (FR16). The form
// stays open, saying how many weren't copied, so a try again reaches them.
async function copy(
  row: CastCostumeRow,
  chosen: CostumeCopy,
  fields: CostumeFields,
  from?: HTMLElement,
) {
  if (saving.value) return;
  if (!(await askToConfirm(chosen.question, "Copy", from))) return;
  saving.value = true;
  const missed = (await saveOpenRow(row, fields)) ? await copyTo(chosen.to, fields) : undefined;
  saving.value = false;
  if (missed === undefined) return;
  if (missed > 0) {
    formError.value = `Couldn't copy to ${missed} costume${missed === 1 ? "" : "s"}. Try again.`;
    return;
  }
  const copied = chosen.to.length;
  announcement.value = `Costume copied to ${copied} other${copied === 1 ? "" : "s"}.`;
  await stopEditing(rowId(row));
}

/** Gives each row the fields' From Wardrobe and From Cast Member, keeping its own notes, one
 *  at a time. A row someone else saved since the page loaded keeps what they saved, so
 *  nothing unseen is overwritten. How many weren't copied. */
async function copyTo(others: CastCostumeRow[], { fromWardrobe, fromCastMember }: CostumeFields) {
  let missed = 0;
  for (const other of others) {
    const { notes } = costumeOf(costumes.value, other.role, other.member);
    if ((await saveRow(other, { fromWardrobe, fromCastMember, notes })) !== "saved") missed++;
  }
  return missed;
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
            :copies="costumeCopiesOf(rows, { role, member })"
            @save="save({ role, member }, $event)"
            @copy="(chosen, fields, from) => copy({ role, member }, chosen, fields, from)"
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
