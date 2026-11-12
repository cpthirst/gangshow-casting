import { computed, nextTick, ref, shallowRef } from "vue";
import { useAddForm } from "./useAddForm.ts";

/**
 * A list with one form open at a time, to add or to edit a row, as on Cast, Casting, Props and
 * Costumes.
 * rowAttribute: the attribute carrying each row's id, so closing an edit puts focus back on
 * that row's Edit button.
 */
export function useListEditing<Item>(rowAttribute: string) {
  const { adding, addButton, stopAdding } = useAddForm();
  /** The row whose edit form is open, if any. */
  const editing = shallowRef<Item | null>(null);
  const saving = ref(false);
  const formError = ref("");
  /** Visible message about a conflict or a failed change. */
  const notice = ref("");
  // While a form is open or a change is saving, other changes wait.
  const busy = computed(() => adding.value || editing.value !== null || saving.value);

  function clearMessages() {
    formError.value = "";
    notice.value = "";
  }

  function startAdding() {
    clearMessages();
    adding.value = true;
  }

  function startEditing(item: Item) {
    clearMessages();
    editing.value = item;
  }

  async function stopEditing(id: number | string) {
    editing.value = null;
    await nextTick();
    // The row may be filtered out of view after a change; then focus simply stays put.
    document
      .querySelector<HTMLButtonElement>(`[${rowAttribute}="${id}"] [data-test=edit]`)
      ?.focus();
  }

  /** For when a row and its buttons have gone: keeps keyboard focus on the page. */
  async function focusAddButton() {
    await nextTick();
    addButton.value?.focus();
  }

  return {
    adding,
    addButton,
    editing,
    saving,
    formError,
    notice,
    busy,
    clearMessages,
    startAdding,
    stopAdding,
    startEditing,
    stopEditing,
    focusAddButton,
  };
}
