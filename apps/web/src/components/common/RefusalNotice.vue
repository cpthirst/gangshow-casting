<script setup lang="ts">
import type { DepartmentId } from "@app/shared";
import { changeRefusedAsReadOnly } from "@/services/sign-in.ts";
import { refusedLine } from "@/utils/departments.ts";

// The department the page is about, which names what wasn't saved.
withDefaults(defineProps<{ about?: DepartmentId }>(), { about: "casting" });
</script>

<template>
  <!-- Lost the permission since the page opened: say so where they were editing (team-roles
       FR12). The View only badge by the title says the rest. -->
  <p v-if="changeRefusedAsReadOnly" class="access-note" data-test="refused" role="alert">
    {{ refusedLine(about) }}
  </p>
</template>
