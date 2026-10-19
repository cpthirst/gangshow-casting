<script setup lang="ts">
import { TeamRole } from "@app/shared";
import { useRoute, useRouter } from "vue-router";
import { ROLE_NAMES } from "./accounts.ts";
import { isAdminOnlyPage } from "./router.ts";
import { chooseLocalRole, isAdmin, localRole } from "./sign-in.ts";

const route = useRoute();
const router = useRouter();

// Only pnpm dev and pnpm demo show this (App.vue): it changes what the pages show and what
// the local API allows, so each role can be tried without an account (team-roles FR16).
async function onChange(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return;
  // Parsed only for its type: the options are the roles themselves.
  const role = TeamRole.safeParse(event.target.value);
  if (!role.success) return;
  chooseLocalRole(role.data);
  // Its menu entry has just gone, so don't leave them on it: every role can open this one.
  if (!isAdmin.value && isAdminOnlyPage(route.name)) await router.push({ name: "running-order" });
}
</script>

<template>
  <div class="local-role">
    <label for="local-role">Local role</label>
    <select id="local-role" data-test="local-role" :value="localRole" @change="onChange">
      <option v-for="role in TeamRole.options" :key="role" :value="role">
        {{ ROLE_NAMES[role] }}
      </option>
    </select>
  </div>
</template>
