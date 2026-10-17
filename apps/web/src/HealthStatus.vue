<script setup lang="ts">
import { HealthResponse } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import { apiFetch, signInNeeded } from "./sign-in.ts";

const status = ref("checking…");
// The API answers no one until they sign in, which isn't the same as it being down.
const label = computed(() => (signInNeeded.value ? "sign in needed" : status.value));

onMounted(async () => {
  try {
    const res = await apiFetch("/api/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { status: health, version } = HealthResponse.parse(await res.json());
    status.value = `${health} (${version})`;
  } catch {
    status.value = "unavailable";
  }
});
</script>

<template>
  <p>API: {{ label }}</p>
</template>
