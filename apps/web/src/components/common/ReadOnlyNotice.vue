<script setup lang="ts">
import type { DepartmentId } from "@app/shared";
import { canChange, changeRefusedAsReadOnly } from "@/services/sign-in.ts";
import { refusedLine, viewOnlyLine } from "@/utils/departments.ts";

// The department the page is about, which says who may change it.
withDefaults(defineProps<{ about?: DepartmentId }>(), { about: "casting" });
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
    <!-- Lost the permission since the page opened: say so where they were editing (FR12). -->
    {{ refusedLine(about) }}
  </p>
  <p v-else-if="!canChange(about)" class="access-note" data-test="read-only">{{ viewOnlyLine(about) }}</p>
</template>
