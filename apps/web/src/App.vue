<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import HealthStatus from "./HealthStatus.vue";
import LocalRoleSwitch from "./LocalRoleSwitch.vue";
import { isMenuGroup, menuPages, showPageTitle } from "./router.ts";
import {
  isAdmin,
  isHosted,
  isLocal,
  isSignedIn,
  isSignInUnavailable,
  signIn,
  signInNeeded,
  signOut,
} from "./sign-in.ts";
import { recordSession } from "./usage.ts";
import { useMediaQuery } from "./useMediaQuery.ts";

// Must match the phone @media query in styles.css.
const PHONE_QUERY = "(max-width: 767px)";

const route = useRoute();
const router = useRouter();

// Set by `pnpm demo`, so its made-up show can't be mistaken for the real one.
const isDemo = import.meta.env.VITE_DEMO === "true";

// Replaces RouterLink's own aria-current (an explicit attribute wins), so a page outside
// the menu, such as an item, can mark its menu page (Items) as current.
const ariaCurrent = (pageName: string) =>
  route.name === pageName || route.meta.menuPage === pageName ? "page" : undefined;

const shownMenuPages = computed(() =>
  menuPages.filter((entry) => isMenuGroup(entry) || !entry.adminOnly || isAdmin.value),
);

const main = ref<HTMLElement>();
const menuButton = ref<HTMLButtonElement>();
const isPhone = useMediaQuery(PHONE_QUERY);
const isMenuOpen = ref(false);

// A menu left open on a phone shouldn't reappear after a rotate or resize.
watch(isPhone, closeMenu);

// After the router names the page, so the tab says what the page actually shows.
watch(
  [signInNeeded, () => route.fullPath],
  ([needed]) => {
    if (needed) showPageTitle("Sign in");
  },
  { flush: "post" },
);

// Each time the app opens signed in, by signing in or coming back still signed in, is a
// session (usage-tracking FR1).
onMounted(() => {
  if (!signInNeeded.value) recordSession();
});

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

// Leaving the page first lets it ask its own question about unsaved changes; signing out
// goes ahead only if it lets them leave.
async function leaveAndSignOut() {
  const stayed = await router.push({ name: "signing-out" });
  if (stayed) return;
  await signOut();
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
        <span class="wordmark-app">iCUE</span>
        <span class="wordmark-tagline">Show Management App</span>
      </p>
      <p v-if="isDemo" class="demo-label" data-test="demo-label">
        Demo data: a made-up show, reset each time the demo starts
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
          <li v-for="entry in shownMenuPages" :key="entry.name">
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
      <footer class="sidebar-footer">
        <HealthStatus />
        <LocalRoleSwitch v-if="isLocal" />
        <button
          v-if="isSignedIn"
          class="sign-out-button"
          type="button"
          data-test="sign-out"
          @click="leaveAndSignOut"
        >
          Sign out
        </button>
      </footer>
    </aside>
    <main id="main" ref="main" tabindex="-1">
      <template v-if="signInNeeded">
        <h1>You need to sign in</h1>
        <p v-if="isSignInUnavailable" role="alert">
          Couldn't set up sign-in. Reload the page to try again.
        </p>
        <p v-else role="alert">
          The show's casting is only for the production team. Sign in to see it.
        </p>
        <div v-if="isHosted" class="editor-actions">
          <button class="primary" type="button" data-test="sign-in" @click="signIn">
            Sign in
          </button>
        </div>
      </template>
      <RouterView v-else />
    </main>
  </div>
</template>
