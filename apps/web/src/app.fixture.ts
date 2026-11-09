import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";

/** A stand-in API's answer. */
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** The whole app at this address, so routing, the menu and the tab title are real. */
export async function openAppAt(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}
