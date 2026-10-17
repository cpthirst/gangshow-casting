import { ref } from "vue";

/**
 * Set once the API says no one is signed in: the app then shows only how to sign in. Nothing
 * clears it yet, as there's no way to sign in until hosting E3.S2, which resets it.
 */
export const signInNeeded = ref(false);

/** fetch for the API's routes, noticing when the API says no one is signed in. */
export async function apiFetch(...args: Parameters<typeof fetch>) {
  const res = await fetch(...args);
  if (res.status === 401) signInNeeded.value = true;
  return res;
}
