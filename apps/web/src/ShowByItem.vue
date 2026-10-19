<script setup lang="ts">
import ClashIcon from "./ClashIcon.vue";
import { type Clash, clashesOf, describeEach } from "./clashes.ts";
import { itemHeading, type ShowHalf } from "./overview.ts";
import { roleSizeLabel } from "./roles.ts";

// The whole show item by item (casting-overview-by-item FR2, FR4): each half under its name,
// each item under its number and title, with a table of its roles. Read-only for every
// role (FR6). Real headings, so a screen reader can move from item to item. Each name has
// its clash icon, as on the item's page. On a phone each role stacks into a labelled card.

const props = defineProps<{
  halves: ShowHalf[];
  clashes: Clash[];
}>();

const clashesHere = (memberId: number, itemId: string) =>
  describeEach(clashesOf(props.clashes, memberId, itemId));
</script>

<template>
  <section v-for="half in halves" :key="half.id" class="by-item-half">
    <h2 :id="`by-item-${half.id}`">{{ half.name }}</h2>
    <section v-for="item in half.items" :key="item.itemId" class="by-item-item" data-test="show-item">
      <!-- Unprinted: red italics as on the grid, and the Items list's badge, so it's said in
           words, not by colour alone. -->
      <h3 :class="{ 'by-item-unprinted': item.number === null }">
        {{ itemHeading(item) }}
        <span v-if="item.number === null" class="badge">Not in printed programme</span>
      </h3>
      <p v-if="item.roles.length === 0">No roles have been added yet.</p>
      <div
        v-else
        class="table-scroll"
        tabindex="0"
        role="region"
        :aria-label="`Roles in ${item.title}`">
        <table class="by-item-roles">
          <thead>
            <tr>
              <th scope="col">Role name</th>
              <th scope="col">Role type</th>
              <th scope="col">Cast</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in item.roles" :key="role.id">
              <th scope="row">{{ role.name }}</th>
              <td data-label="Role type">
                <span :class="['pill', `pill-${role.size}`]">{{ roleSizeLabel(role.size) }}</span>
              </td>
              <td data-label="Cast">
                <span v-if="role.cast.length === 0" class="uncast">Uncast</span>
                <template v-for="(member, i) in role.cast" :key="member.id"
                  ><template v-if="i > 0">, </template
                  ><span class="cast-name"
                    >{{ member.name }}<ClashIcon :lines="clashesHere(member.id, item.itemId)" /></span
                ></template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
