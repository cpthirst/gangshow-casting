<script setup lang="ts">
import { changeRefusedAsReadOnly, isReadOnly } from "./sign-in.ts";
</script>

<template>
  <!-- Text, not a tooltip, so it shows on phones too (team-roles FR6). Styled like the
       "Only admins can …" line, so the reason someone can't edit always looks the same. -->
  <p
    v-if="changeRefusedAsReadOnly"
    class="access-note"
    data-test="read-only"
    role="alert"
  >
    <!-- Made read-only since the page opened: say so where they were editing (FR12). -->
    You have read-only access, so this wasn't saved.
  </p>
  <p v-else-if="isReadOnly" class="access-note" data-test="read-only">You have read-only access</p>
</template>
