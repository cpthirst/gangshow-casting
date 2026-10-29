<script setup lang="ts">
import PageHelp from "@/components/common/PageHelp.vue";
import { pageHelp, permissionHelp } from "@/utils/help.ts";
</script>

<template>
  <h1>Help</h1>
  <section
    v-for="help in pageHelp"
    :key="help.page"
    class="help-section"
    :aria-labelledby="`help-${help.page}`"
  >
    <h2 :id="`help-${help.page}`">{{ help.title }}</h2>
    <PageHelp :help="help" />
    <p>
      <RouterLink :to="{ name: (help.reachedFrom ?? help).page }"
        >Go to the {{ (help.reachedFrom ?? help).title }} page</RouterLink
      >
    </p>
  </section>
  <section class="help-section" aria-labelledby="help-permissions">
    <h2 id="help-permissions">Permissions</h2>
    <p>
      Everyone can view the show, casting and production pages. An admin gives each account the
      permissions it needs to change things:
    </p>
    <ul class="help-lines" role="list">
      <li
        v-for="permission in permissionHelp"
        :key="permission.name"
        class="help-line"
        data-test="permission"
      >
        <span><strong>{{ permission.name }}</strong>: {{ permission.does }}</span>
      </li>
    </ul>
  </section>
</template>
