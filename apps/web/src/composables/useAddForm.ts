import { nextTick, ref } from "vue";

/**
 * A form opened by an Add button, as on Cast, Accounts and Productions. Bind `addButton` to the
 * button; closing puts focus back on it, so a keyboard user carries on from where they were.
 */
export function useAddForm() {
  const adding = ref(false);
  const addButton = ref<HTMLButtonElement>();

  async function stopAdding() {
    adding.value = false;
    await nextTick();
    addButton.value?.focus();
  }

  return { adding, addButton, stopAdding };
}
