import type { RunningOrder } from "@app/shared";
import { computed, type Ref } from "vue";
import { useRoute } from "vue-router";
import { placeOf } from "@/utils/running-order.ts";

/** Where the item this page's address names sits in the running order, once it's loaded. */
export function useItemPlace(order: Ref<RunningOrder | undefined>) {
  const route = useRoute();
  return computed(() => {
    const itemId = route.params.itemId;
    return order.value && typeof itemId === "string" ? placeOf(order.value, itemId) : undefined;
  });
}
