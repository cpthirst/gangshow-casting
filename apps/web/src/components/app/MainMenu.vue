<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { isMenuGroup, menuPages } from "@/router/index.ts";
import { isAdmin } from "@/services/sign-in.ts";

// The main menu, as a disclosure navigation menu (WAI-ARIA Authoring Practices): each group's
// label is a button that shows or hides its pages. Not role="menu": that's for application
// menus with arrow-key focus, and would hide these links from screen readers' link lists.

const route = useRoute();

const entries = computed(() =>
  menuPages.filter((entry) => isMenuGroup(entry) || !entry.adminOnly || isAdmin.value),
);

// A page outside the menu, such as an item, marks its menu page (Items) as current.
const isCurrent = (pageName: string) => route.name === pageName || route.meta.menuPage === pageName;
// Replaces RouterLink's own aria-current (an explicit attribute wins).
const ariaCurrent = (pageName: string) => (isCurrent(pageName) ? "page" : undefined);

/** The group holding the current page, so its label can say so while it's folded away. */
const currentGroup = computed(
  () =>
    menuPages.find(
      (entry) => isMenuGroup(entry) && entry.pages.some((page) => isCurrent(page.name)),
    )?.name,
);

// One group open at a time, like an accordion: the menu stays short, which matters most on a
// phone. All start folded away; going to a page opens its group, so it's never hidden.
const openGroup = ref<string | undefined>();
watch(
  () => route.name,
  () => {
    if (currentGroup.value) openGroup.value = currentGroup.value;
  },
  { immediate: true },
);

function toggle(name: string) {
  openGroup.value = openGroup.value === name ? undefined : name;
}

// Escape folds the open group away and puts focus back on its label. It carries on up, so on
// a phone the same Escape closes the whole menu, as Escape closes things everywhere else.
function foldAway(name: string) {
  if (openGroup.value !== name) return;
  openGroup.value = undefined;
  document.getElementById(`menu-${name}`)?.focus();
}
</script>

<template>
  <nav aria-label="Main">
    <ul class="menu">
      <li v-for="entry in entries" :key="entry.name" @keydown.esc="foldAway(entry.name)">
        <template v-if="isMenuGroup(entry)">
          <button
            :id="`menu-${entry.name}`"
            class="menu-item menu-group"
            :class="{ 'holds-current': currentGroup === entry.name }"
            type="button"
            :aria-expanded="openGroup === entry.name"
            :aria-controls="`menu-${entry.name}-pages`"
            @click="toggle(entry.name)"
          >
            {{ entry.title }}
            <!-- The yellow bar's meaning, for screen readers, while the current page is hidden. -->
            <span
              v-if="currentGroup === entry.name && openGroup !== entry.name"
              class="visually-hidden"
              >(current page inside)</span
            >
          </button>
          <ul
            v-show="openGroup === entry.name"
            :id="`menu-${entry.name}-pages`"
            class="menu-group-pages"
            :aria-labelledby="`menu-${entry.name}`"
          >
            <li v-for="page in entry.pages" :key="page.name">
              <RouterLink
                class="menu-subitem"
                :to="page.path"
                :aria-current="ariaCurrent(page.name)"
                >{{ page.meta.title }}</RouterLink
              >
            </li>
          </ul>
        </template>
        <RouterLink
          v-else
          class="menu-item"
          :to="entry.path"
          :aria-current="ariaCurrent(entry.name)"
          >{{ entry.meta.title }}</RouterLink
        >
      </li>
    </ul>
  </nav>
</template>
