<script setup lang="ts">
import type { CastMember, Role } from "@app/shared";
import { computed } from "vue";
import { costumeRowsOf } from "@/utils/costumes.ts";
import { fullName } from "@/utils/roles.ts";
import RoleCast from "./RoleCast.vue";

// Who wears what in one item, on its Wardrobe page (production-costume-sheets FR2, FR3): a
// row per cast member per role, read from the casting as it is now.
// roles and cast: the production's.
const props = defineProps<{ itemId: string; roles: Role[]; cast: CastMember[] }>();

const rows = computed(() => costumeRowsOf(props.roles, props.cast, props.itemId));
</script>

<template>
  <section class="item-section" aria-labelledby="costumes-heading">
    <h2 id="costumes-heading">Costumes</h2>
    <!-- One card per row, as the role and prop cards. An explicit list role: Safari drops list
         semantics once bullets are styled away. -->
    <ul v-if="rows.length > 0" class="card-list" role="list" aria-labelledby="costumes-heading">
      <li
        v-for="{ role, member } in rows"
        :key="`${role.id}-${member?.id ?? 'uncast'}`"
        class="card"
        data-test="costume"
      >
        <RoleCast :name="role.name" :cast="member ? fullName(member) : ''" none="Uncast" />
      </li>
    </ul>
    <p v-else data-test="no-costumes">Nobody is cast in this item yet.</p>
  </section>
</template>
