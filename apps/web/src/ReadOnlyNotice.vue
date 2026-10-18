<script setup lang="ts">
import { isReadOnly } from "./sign-in.ts";
</script>

<template>
  <!-- Text, not a tooltip, so it shows on phones too (team-roles FR6). Styled like the
       "Only admins can …" line, so the reason someone can't edit always looks the same. -->
  <p v-if="isReadOnly" class="access-note" data-test="read-only">You have read-only access</p>
</template>
