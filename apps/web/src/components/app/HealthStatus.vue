<script setup lang="ts">
import { HealthResponse } from "@app/shared";
import { computed, onMounted, ref } from "vue";
import { loadRequired } from "@/services/load-data.ts";
import { signInNeeded } from "@/services/sign-in.ts";

const status = ref("checking…");
// The API answers no one until they sign in, which isn't the same as it being down.
const label = computed(() => (signInNeeded.value ? "sign in needed" : status.value));

// The release the API was deployed as, which the pages ship with: "v1.12.0". A local API
// says "dev", which isn't a release number, so it shows as it is.
const release = ref<string>();
const releaseOf = (version: string) => (/^\d/.test(version) ? `v${version}` : version);

onMounted(async () => {
  try {
    const { status: health, version } = await loadRequired("/api/health", HealthResponse);
    status.value = health;
    release.value = releaseOf(version);
  } catch {
    status.value = "unavailable";
  }
});
</script>

<!-- One box, so the release stays under the status in the phone's one-row footer. -->
<template>
  <div>
    <p>API: {{ label }}</p>
    <p v-if="release" data-test="release">{{ release }}</p>
  </div>
</template>
