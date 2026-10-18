<script setup lang="ts">
import { RoleSize } from "@app/shared";
import ClashIcon from "./ClashIcon.vue";
import type { ClashLine } from "./clashes.ts";
import { fullGridHeading, type GridColumn, gridHeading, type TimelineSlot } from "./overview.ts";
import { roleSizeLabel, roleSizeLetter } from "./roles.ts";

// Who is in which item (casting-overview-grid FR5–FR8): a row per person, a column per item
// in running order, and in each cell one dot for their biggest part there. Read-only.
// Each slot's `part` comes from `biggestParts`: their biggest part in that item, ensemble
// included. Names stay pinned at the left while the items scroll (FR10).
// Rows (`timelineOf`) and columns (`gridColumns`) both run in show order, so they line up.
// A heading with a cut title keeps the whole one for hover and screen readers.
const wholeIfCut = (column: GridColumn) =>
  gridHeading(column) === fullGridHeading(column) ? undefined : fullGridHeading(column);

defineProps<{
  columns: GridColumn[];
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
  <!-- What the dots mean (casting-overview-grid FR9), above the grid so it's seen before any
       scrolling: the same dot as in the grid, then the size in words. An explicit list role:
       Safari drops list semantics once bullets are styled away. -->
  <p id="grid-legend-caption" class="role-totals-caption">What the dots mean</p>
  <ul class="grid-legend" role="list" aria-labelledby="grid-legend-caption">
    <li v-for="size in RoleSize.options" :key="size" data-test="legend-item">
      <span :class="['grid-dot', `grid-dot-${size}`]" aria-hidden="true" data-test="legend-dot">{{
        roleSizeLetter(size)
      }}</span>
      <span class="legend-size">{{ roleSizeLabel(size) }}</span>
    </li>
  </ul>
  <div class="table-scroll grid-box" tabindex="0" role="region" aria-label="Who is in which item">
    <table class="casting-grid">
      <thead>
        <tr>
          <th scope="col" class="grid-pinned grid-pinned-first">First name</th>
          <th scope="col" class="grid-pinned grid-pinned-last">Last name</th>
          <th scope="col">Section</th>
          <th
            v-for="column in columns"
            :key="column.itemId"
            scope="col"
            class="grid-item-heading"
            :title="wholeIfCut(column)"
            :aria-label="wholeIfCut(column)">{{ gridHeading(column) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <!-- The first name heads the row; the clash icon sits beside it, as on a person's card. -->
          <th scope="row" class="grid-pinned grid-pinned-first">{{ row.firstName }} <ClashIcon :lines="row.clashLines" /></th>
          <td class="grid-pinned grid-pinned-last">{{ row.lastName }}</td>
          <td>{{ row.section }}</td>
          <td v-for="slot in row.slots" :key="slot.itemId" :class="['grid-cell', { 'grid-empty': !slot.part }]">
            <!-- Nobody there: a dash, so an empty cell is plainly empty, not forgotten. -->
            <span v-if="!slot.part" aria-hidden="true" data-test="grid-dash">-</span>
            <template v-else>
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
