<script setup lang="ts">
import type { Access, Permission } from "@app/shared";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import AccessChoice from "@/components/common/AccessChoice.vue";
import { isAdminOnlyPage } from "@/router/index.ts";
import { chooseLocalAccess, isAdmin, localAccess } from "@/services/sign-in.ts";
import { inOrder } from "@/utils/accounts.ts";

const route = useRoute();
const router = useRouter();

// Only pnpm dev and pnpm demo show this (App.vue): it changes what the pages show and what
// the local API allows, so any mix of permissions can be tried without an account (FR9).
const admin = computed({
  get: () => localAccess.value === "admin",
  set: (ticked: boolean) => choose(ticked ? "admin" : []),
});
const ticked = computed({
  get: () => (localAccess.value === "admin" ? [] : (localAccess.value ?? [])),
  set: (chosen: Permission[]) => choose(inOrder(chosen)),
});

async function choose(access: Access) {
  chooseLocalAccess(access);
  // Its menu entry has just gone, so don't leave them on it: everyone can open this one.
  if (!isAdmin.value && isAdminOnlyPage(route.name)) await router.push({ name: "running-order" });
}
</script>

<template>
  <AccessChoice
    v-model:admin="admin"
    v-model:permissions="ticked"
    class="local-access"
    data-test="local-access"
    legend="Local role"
    read-only-hint="With nothing ticked, you're read-only."
  />
</template>
