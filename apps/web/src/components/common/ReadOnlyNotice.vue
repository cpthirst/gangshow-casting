<script setup lang="ts">
import { computed } from "vue";
import { canChangeCasting, canChangeProps, changeRefusedAsReadOnly } from "@/services/sign-in.ts";

// What the page is about, which says whose permission changes it: the casting pages and
// Running order need Casting; the props pages need Stage or Director.
const props = withDefaults(defineProps<{ about?: "casting" | "props" }>(), { about: "casting" });

const notices = {
  casting: {
    canChange: canChangeCasting,
    viewOnly: "You can view the casting, but not change it.",
    refused: "You can view the casting but not change it, so this wasn't saved.",
  },
  props: {
    canChange: canChangeProps,
    viewOnly: "You can view the props, but not change them.",
    refused: "You can view the props but not change them, so this wasn't saved.",
  },
};
const notice = computed(() => notices[props.about]);
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
    {{ notice.refused }}
  </p>
  <p v-else-if="!notice.canChange.value" class="access-note" data-test="read-only">{{ notice.viewOnly }}</p>
</template>
