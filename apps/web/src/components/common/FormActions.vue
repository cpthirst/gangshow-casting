<script setup lang="ts">
// An add or edit form's last lines: why the last save failed, if it did, then Save and Cancel,
// both waiting while a save is on its way.
defineProps<{ saving: boolean; error: string }>();
const emit = defineEmits<{ cancel: [] }>();
</script>

<template>
  <p v-if="error" class="field-error form-error" role="alert">{{ error }}</p>
  <div class="editor-actions">
    <button type="submit" class="primary" :disabled="saving">Save</button>
    <button type="button" data-test="cancel" :disabled="saving" @click="emit('cancel')">
      Cancel
    </button>
  </div>
</template>
