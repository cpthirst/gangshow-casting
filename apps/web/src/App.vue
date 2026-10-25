<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import logoSmall from "@/assets/logo-small.jpg";
import HealthStatus from "@/components/app/HealthStatus.vue";
import LocalAccessSwitch from "@/components/app/LocalAccessSwitch.vue";
import MainMenu from "@/components/app/MainMenu.vue";
import { useMediaQuery } from "@/composables/useMediaQuery.ts";
import { showPageTitle } from "@/router/index.ts";
import {
  isHosted,
  isLocal,
  isSignedIn,
  isSignInUnavailable,
  justSignedIn,
  signIn,
  signInNeeded,
  signOut,
} from "@/services/sign-in.ts";
import { recordPageUse, recordSession } from "@/services/usage.ts";

// Must match the phone @media query in styles.css.
const PHONE_QUERY = "(max-width: 767px)";

const route = useRoute();
const router = useRouter();

// Set by `pnpm demo`, so its made-up show can't be mistaken for the real one.
const isDemo = import.meta.env.VITE_DEMO === "true";

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

// A session is one sign-in, which lasts the day (usage-tracking FR1, ADR 0024): reloading or
// reopening the app within it starts none. Locally there's no sign-in, so each opening does.
// Each menu page opened is a use (FR2). In setup, not onMounted, so the session is sent
// before the watch below sends the first page use.
if (!signInNeeded.value && (justSignedIn.value || isLocal.value)) recordSession();
watch(
  () => route.name,
  (pageName) => {
    if (!signInNeeded.value) recordPageUse(pageName);
  },
  { immediate: true },
);

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
      <div class="brand">
        <!-- Decorative: the wordmark beside it already names the show. -->
        <img class="brand-logo" :src="logoSmall" alt="" width="360" height="146" />
        <p class="wordmark" data-test="wordmark">
          <span class="wordmark-name">Chester Gang Show</span>
          <span class="wordmark-app">iCUE</span>
          <span class="wordmark-tagline">Show Management App</span>
        </p>
      </div>
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
      <MainMenu v-show="!isPhone || isMenuOpen" id="main-menu" @click="onMenuChoice" />
      <footer class="sidebar-footer">
        <HealthStatus />
        <LocalAccessSwitch v-if="isLocal" />
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
