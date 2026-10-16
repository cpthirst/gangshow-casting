<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import HealthStatus from "./HealthStatus.vue";
import { isMenuGroup, menuPages } from "./router.ts";
import { useMediaQuery } from "./useMediaQuery.ts";

// Must match the phone @media query in styles.css.
const PHONE_QUERY = "(max-width: 767px)";

const route = useRoute();

// Replaces RouterLink's own aria-current (an explicit attribute wins), so a page outside
// the menu, such as an item, can mark its menu page (Items) as current.
const ariaCurrent = (pageName: string) =>
  route.name === pageName || route.meta.menuPage === pageName ? "page" : undefined;

const main = ref<HTMLElement>();
const menuButton = ref<HTMLButtonElement>();
const isPhone = useMediaQuery(PHONE_QUERY);
const isMenuOpen = ref(false);

// A menu left open on a phone shouldn't reappear after a rotate or resize.
watch(isPhone, closeMenu);

// Focus the content directly: a plain #main link would also change the URL.
function focusContent() {
  main.value?.focus();
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu() {
  isMenuOpen.value = false;
}

// The chosen link is about to be hidden, so move focus rather than lose it. Taps on a
// group label aren't a choice, so the menu stays open.
function onMenuChoice(event: MouseEvent) {
  const isLink = event.target instanceof Element && event.target.closest("a") !== null;
  if (!isMenuOpen.value || !isLink) return;
  closeMenu();
  focusContent();
}

function onEscape() {
  if (!isMenuOpen.value) return;
  closeMenu();
  menuButton.value?.focus();
}
</script>

<template>
  <a class="skip-link" href="#main" data-test="skip-link" @click.prevent="focusContent">
    Skip to main content
  </a>
  <div class="shell">
    <aside class="sidebar" @keydown.esc="onEscape">
      <p class="wordmark" data-test="wordmark">
        <span class="wordmark-name">Chester Gang Show</span>
        <span class="wordmark-sub">Casting</span>
      </p>
      <button
        v-if="isPhone"
        ref="menuButton"
        class="menu-button"
        type="button"
        aria-controls="main-menu"
        :aria-expanded="isMenuOpen"
        @click="toggleMenu"
      >
        Menu
      </button>
      <nav v-show="!isPhone || isMenuOpen" id="main-menu" aria-label="Main" @click="onMenuChoice">
        <ul>
          <li v-for="entry in menuPages" :key="entry.name">
            <template v-if="isMenuGroup(entry)">
              <span :id="`menu-${entry.name}`" class="menu-group">{{ entry.title }}</span>
              <ul class="menu-group-pages" :aria-labelledby="`menu-${entry.name}`">
                <li v-for="page in entry.pages" :key="page.name">
                  <RouterLink :to="page.path" :aria-current="ariaCurrent(page.name)">{{
                    page.meta.title
                  }}</RouterLink>
                </li>
              </ul>
            </template>
            <RouterLink v-else :to="entry.path" :aria-current="ariaCurrent(entry.name)">{{
              entry.meta.title
            }}</RouterLink>
          </li>
        </ul>
      </nav>
      <footer class="sidebar-footer"><HealthStatus /></footer>
    </aside>
    <main id="main" ref="main" tabindex="-1">
      <RouterView />
    </main>
  </div>
</template>
