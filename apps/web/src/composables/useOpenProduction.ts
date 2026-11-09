import { newestProduction, ProductionList } from "@app/shared";
import { computed, ref, watch } from "vue";
import { loadRequired } from "@/services/load-data.ts";
import { openProduction, openProductionYear, PRODUCTIONS_PATH } from "@/services/production.ts";
import { signInNeeded } from "@/services/sign-in.ts";

/** Opens the newest production, once someone is signed in to ask the API for the list. */
export function useOpenProduction() {
  const year = computed(openProductionYear);
  const failed = ref(false);

  async function openNewest() {
    failed.value = false;
    try {
      const { productions } = await loadRequired(PRODUCTIONS_PATH, ProductionList);
      openProduction(newestProduction(productions));
    } catch {
      failed.value = true;
    }
  }

  watch(
    signInNeeded,
    (needed) => {
      if (!needed && year.value === undefined) openNewest();
    },
    { immediate: true },
  );

  return { year, failed };
}
