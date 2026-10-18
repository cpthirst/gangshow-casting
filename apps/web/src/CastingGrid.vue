<script setup lang="ts">
import ClashIcon from "./ClashIcon.vue";
import type { ClashLine } from "./clashes.ts";
import type { TimelineSlot } from "./overview.ts";
import { roleSizeLabel, roleSizeLetter } from "./roles.ts";

// Who is in which item (casting-overview-grid FR5–FR8): a row per person, a column per item
// in running order, and in each cell one dot for their biggest part there. Read-only.
// Each slot's `part` comes from `biggestParts`: their biggest part in that item, ensemble
// included. Rows and columns both come from `timelineOf`, so their slots line up.
defineProps<{
  columns: TimelineSlot[];
  rows: {
    id: number;
    firstName: string;
    lastName: string;
    section: string;
    clashLines: ClashLine[];
    slots: TimelineSlot[];
  }[];
}>();
</script>

<template>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Who is in which item">
    <table class="casting-grid">
      <thead>
        <tr>
          <th scope="col">First name</th>
          <th scope="col">Last name</th>
          <th scope="col">Section</th>
          <th v-for="column in columns" :key="column.itemId" scope="col">{{ column.title }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <!-- The first name heads the row; the clash icon sits beside it, as on a person's card. -->
          <th scope="row">{{ row.firstName }} <ClashIcon :lines="row.clashLines" /></th>
          <td>{{ row.lastName }}</td>
          <td>{{ row.section }}</td>
          <td v-for="slot in row.slots" :key="slot.itemId" :class="{ 'grid-empty': !slot.part }">
            <template v-if="slot.part">
              <!-- Seen as a letter in a coloured dot; heard as the size in words. -->
              <span :class="['grid-dot', `grid-dot-${slot.part}`]" aria-hidden="true" data-test="grid-dot">{{
                roleSizeLetter(slot.part)
              }}</span>
              <span class="visually-hidden">{{ roleSizeLabel(slot.part) }}</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
