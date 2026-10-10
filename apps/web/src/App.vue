<script setup lang="ts">
import { ref } from "vue";
import HealthStatus from "./HealthStatus.vue";
import { menuPages } from "./router.ts";

const main = ref<HTMLElement>();

// Focus the content directly: a plain #main link would also change the URL.
function skipToContent() {
  main.value?.focus();
}
</script>

<template>
  <a class="skip-link" href="#main" data-test="skip-link" @click.prevent="skipToContent">
    Skip to main content
  </a>
  <div class="shell">
    <aside class="sidebar">
      <p class="wordmark" data-test="wordmark">
        <span class="wordmark-name">Chester Gang Show</span>
        <span class="wordmark-sub">Casting</span>
      </p>
      <nav aria-label="Main">
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
