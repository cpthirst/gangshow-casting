<script setup lang="ts">
import { inject } from "vue";
import logo from "../assets/logo.jpg";
import { showMenuGroupKey } from "../menu.ts";

// A button, not a link: it opens a group in the menu rather than going to a page.
const showInMenu = inject(showMenuGroupKey, () => {});
</script>

<template>
  <div class="welcome">
    <img class="welcome-logo" :src="logo" alt="Chester Gang Show" width="1200" height="488" />
    <h1>Welcome</h1>
    <p data-test="intro">
      This is iCUE, the Chester Gang Show's app for managing the show, so every department works
      from the same information. Today it covers casting, showing who is in which item and when;
      props lists, sound effects and mic plots are to come.
    </p>
    <p data-test="help-note">
      New here? Check out <RouterLink :to="{ name: 'help' }">Help</RouterLink> first: it explains
      what each page is for and what its buttons do.
    </p>
  </div>
  <section class="welcome-areas" aria-labelledby="welcome-areas-heading">
    <h2 id="welcome-areas-heading">Where to find things</h2>
    <p>
      Use the menu to move around. It has three areas: choose one below to open it in the menu.
      Help and, for admins, Accounts and Usage sit beside them.
    </p>
    <dl>
      <dt>
        <button type="button" class="link-button" data-test="show-show" @click="showInMenu('show')">
          Show
        </button>
      </dt>
      <dd>
        The show itself: the <RouterLink :to="{ name: 'running-order' }">Running order</RouterLink>
        of items, and the <RouterLink :to="{ name: 'cast' }">Cast</RouterLink> of Scouts and
        Explorers.
      </dd>
      <dt>
        <button type="button" class="link-button" data-test="show-casting" @click="showInMenu('casting')">
          Casting
        </button>
      </dt>
      <dd>
        Who is in which item: the
        <RouterLink :to="{ name: 'casting-overview' }">Overview</RouterLink> by person, by item or
        as a grid, and the <RouterLink :to="{ name: 'casting-items' }">Items</RouterLink> with how
        far each one's casting has got.
      </dd>
      <dt>
        <button type="button" class="link-button" data-test="show-production" @click="showInMenu('production')">
          Production
        </button>
      </dt>
      <dd>
        What each item needs backstage: the Mic plot, Props, Scenery and SFX (sound effects). These
        pages are coming soon.
      </dd>
    </dl>
  </section>
</template>
