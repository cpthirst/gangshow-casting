<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { accessLabel, type PageHelp } from "@/utils/help.ts";

// One page's help: the same on the Help page and behind the page's help button (FR9).
defineProps<{ help: PageHelp }>();
</script>

<template>
  <p>{{ help.summary }}</p>
  <ul class="help-lines" role="list">
    <li v-for="line in help.lines" :key="line.name" class="help-line" data-test="help-line">
      <!-- Decorative: the action's name is written beside them. Kept, empty, on lines without
           icons, so every line's words start in the same place. -->
      <span class="help-icons" aria-hidden="true">
        <span v-for="icon in line.icons" :key="icon.iconName" class="help-icon">
          <FontAwesomeIcon :icon="icon" />
        </span>
      </span>
      <span>
        <strong data-test="help-name">{{ line.name }}</strong>:
        <span data-test="help-does">{{ line.does }}</span>
        <template v-if="line.changeAccess">
          <span :class="['badge', 'help-access', `help-access-${line.access}`]" data-test="help-access"
            >Reading: {{ accessLabel(line.access) }}</span
          >
          <span
            :class="['badge', 'help-access', `help-access-${line.changeAccess}`]"
            data-test="help-access"
            >Changing: {{ accessLabel(line.changeAccess) }}</span
          >
        </template>
        <span
          v-else
          :class="['badge', 'help-access', `help-access-${line.access}`]"
          data-test="help-access"
          >{{ accessLabel(line.access) }}</span
        >
      </span>
    </li>
  </ul>
</template>
