<script setup lang="ts">
import logo from "@/assets/logo.jpg";
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
      Use the menu to move around. It has three areas: choose one below to go to its first page.
      Help and, for admins, Accounts and Usage sit beside them.
    </p>
    <dl>
      <dt>
        <!-- The first page in the group: the menu opens the group when it arrives. -->
        <RouterLink :to="{ name: 'running-order' }" data-test="area-show">Show</RouterLink>
      </dt>
      <dd>
        The show itself: the <RouterLink :to="{ name: 'running-order' }">Running order</RouterLink>
        of items, and the <RouterLink :to="{ name: 'cast' }">Cast</RouterLink> of Scouts and
        Explorers.
      </dd>
      <dt>
        <!-- The first page in the group: the menu opens the group when it arrives. -->
        <RouterLink :to="{ name: 'casting-overview' }" data-test="area-casting">Casting</RouterLink>
      </dt>
      <dd>
        Who is in which item: the
        <RouterLink :to="{ name: 'casting-overview' }">Overview</RouterLink> by person, by item or
        as a grid, and the <RouterLink :to="{ name: 'casting-items' }">Items</RouterLink> with how
        far each one's casting has got.
      </dd>
      <dt>
        <!-- The first page in the group: the menu opens the group when it arrives. -->
        <RouterLink :to="{ name: 'production-overview' }" data-test="area-production"
          >Production</RouterLink
        >
      </dt>
      <dd>
        What each department needs for each item, on one page: the
        <RouterLink :to="{ name: 'production-overview' }">Overview</RouterLink>, with the show's
        items in running order and a button to open each department's page for them. Stage, Tech or Wardrobe lets
        someone change that department's pages, and Director lets them change every department's.
      </dd>
    </dl>
  </section>
</template>
