<script setup lang="ts">
import { canChangeCasting, changeRefusedAsReadOnly } from "@/services/sign-in.ts";
</script>

<template>
  <!-- Text, not a tooltip, so it shows on phones too (team-roles FR6). Styled like the
       "Only admins can …" line, so the reason someone can't edit always looks the same.
       Only the casting pages and Running order use it, so it asks about Casting alone; the
       Stage pages (stage-props E4) will need it to ask about their own department. -->
  <p
    v-if="changeRefusedAsReadOnly"
    class="access-note"
    data-test="read-only"
    role="alert"
  >
    <!-- Lost Casting since the page opened: say so where they were editing (FR12). -->
    You can view the casting but not change it, so this wasn't saved.
  </p>
  <p v-else-if="!canChangeCasting" class="access-note" data-test="read-only">You can view the casting, but not change it.</p>
</template>
