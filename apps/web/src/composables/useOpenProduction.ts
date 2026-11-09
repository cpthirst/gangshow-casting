import { ProductionList } from "@app/shared";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { loadRequired } from "@/services/load-data.ts";
import {
  isOpenProductionChangeable,
  listProductions,
  openNewestOf,
  openProductionYear,
  PRODUCTIONS_PATH,
} from "@/services/production.ts";
import { signInNeeded } from "@/services/sign-in.ts";

/** Opens the newest production, once someone is signed in to ask the API for the list. */
export function useOpenProduction() {
  const year = computed(openProductionYear);
  const failed = ref(false);
  const route = useRoute();

  async function openNewest() {
    failed.value = false;
    try {
      const { productions } = await loadRequired(PRODUCTIONS_PATH, ProductionList);
      openNewestOf(productions);
    } catch {
      failed.value = true;
    }
  }

  // Only a past production can be deleted (ADR 0037), so only then is the list asked again.
  // By page, not by a 404, as some reads answer an empty list for a production that's gone.
  async function checkPastProductionStillHeld() {
    if (isOpenProductionChangeable()) return;
    try {
      listProductions((await loadRequired(PRODUCTIONS_PATH, ProductionList)).productions);
    } catch {
      // Left as it was: the next page can find out.
    }
  }

  watch(() => route.fullPath, checkPastProductionStillHeld);

  watch(
    signInNeeded,
    (needed) => {
      if (!needed && year.value === undefined) openNewest();
    },
    { immediate: true },
  );

  return { year, failed };
}
