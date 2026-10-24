<script setup lang="ts">
import logo from "../assets/logo.jpg";
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
  </div>
  <section class="welcome-areas" aria-labelledby="welcome-areas-heading">
    <h2 id="welcome-areas-heading">Where to find things</h2>
    <p>Use the menu to move around. It is split into three areas.</p>
    <dl>
      <dt>Show</dt>
      <dd>
        The show itself: the <RouterLink :to="{ name: 'running-order' }">Running order</RouterLink>
        of items, and the <RouterLink :to="{ name: 'cast' }">Cast</RouterLink> of Scouts and
        Explorers.
      </dd>
      <dt>Production</dt>
      <dd>
        What each item needs backstage: the Mic plot, Props, Scenery and SFX (sound effects). These
        pages are coming soon.
      </dd>
      <dt>Casting</dt>
      <dd>
        Who is in which item: the
        <RouterLink :to="{ name: 'casting-overview' }">Overview</RouterLink> by person, by item or
        as a grid, and the <RouterLink :to="{ name: 'casting-items' }">Items</RouterLink> with how
        far each one's casting has got.
      </dd>
    </dl>
    <p>
      Not sure what a page or button does? The
      <RouterLink :to="{ name: 'help' }">Help</RouterLink> page explains each one.
    </p>
  </section>
</template>
