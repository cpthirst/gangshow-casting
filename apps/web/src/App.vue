<script setup lang="ts">
import { ref } from "vue";
import HealthStatus from "./HealthStatus.vue";
import { menuPages } from "./router.ts";
import { useMediaQuery } from "./useMediaQuery.ts";

const main = ref<HTMLElement>();
const menuButton = ref<HTMLButtonElement>();
const isPhone = useMediaQuery("(max-width: 767px)");
const menuOpen = ref(false);

// Focus the content directly: a plain #main link would also change the URL.
function skipToContent() {
  main.value?.focus();
}

function closeMenu() {
  menuOpen.value = false;
}

function closeMenuAndRefocus() {
  if (!isPhone.value || !menuOpen.value) return;
  closeMenu();
  menuButton.value?.focus();
}
</script>

<template>
  <a class="skip-link" href="#main" data-test="skip-link" @click.prevent="skipToContent">
    Skip to main content
  </a>
  <div class="shell">
    <aside class="sidebar" @keydown.esc="closeMenuAndRefocus">
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
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        Menu
      </button>
      <nav v-show="!isPhone || menuOpen" id="main-menu" aria-label="Main" @click="closeMenu">
        <ul>
          <li v-for="page in menuPages" :key="page.name">
            <RouterLink :to="page.path">{{ page.meta.title }}</RouterLink>
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
