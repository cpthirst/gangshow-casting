import { onMounted, onUnmounted, ref } from "vue";

export function useMediaQuery(query: string) {
  const list = matchMedia(query);
  const matches = ref(list.matches);
  const update = (event: MediaQueryListEvent) => {
    matches.value = event.matches;
  };

  onMounted(() => list.addEventListener("change", update));
  onUnmounted(() => list.removeEventListener("change", update));

  return matches;
}
