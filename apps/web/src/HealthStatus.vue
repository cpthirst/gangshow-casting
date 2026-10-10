<script setup lang="ts">
import { HealthResponse } from "@app/shared";
import { onMounted, ref } from "vue";

const label = ref("checking…");

onMounted(async () => {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { status, version } = HealthResponse.parse(await res.json());
    label.value = `${status} (${version})`;
  } catch {
    label.value = "unavailable";
  }
});
</script>

<template>
  <p>API: {{ label }}</p>
</template>
