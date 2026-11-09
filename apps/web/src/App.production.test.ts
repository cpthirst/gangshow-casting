import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";

vi.mock("@/utils/production.ts", () => ({ PRODUCTION_PATH: "/api/productions/2028" }));

enableAutoUnmount(afterEach);
beforeEach(useLocalSignIn);
afterEach(() => vi.unstubAllGlobals());

const PRODUCTION = "/api/productions/2028";
// The app's own requests, which belong to no production.
const NOT_ABOUT_A_PRODUCTION = ["/api/health", "/api/usage"];

const productionId = "2028";
const answers: Record<string, unknown> = {
  "running-order": {
    ...aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]),
    productionId,
  },
  cast: { productionId, members: [] },
  roles: { productionId, roles: [] },
  props: { productionId, props: [] },
  "mic-plot": { productionId, items: [] },
};

/** A stand-in API for the 2028 production, keeping every request the page makes. */
function serve2028() {
  const requests: { url: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: String(init?.body ?? "") });
      const last = url.split("/").at(-1) ?? "";
      if (last.endsWith("-counts")) return new Response(JSON.stringify({ counts: {} }));
      if (last.endsWith("notes")) {
        return new Response(JSON.stringify({ productionId, notes: [] }));
      }
      return new Response(JSON.stringify(answers[last] ?? { status: "ok", version: "1.2.3" }));
    }),
  );
  return requests;
}

async function open(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
}

describe("a web app set to show production 2028", () => {
  it.each([
    ["Cast", "/cast", ["cast"]],
    ["Running order", "/running-order", ["running-order"]],
    ["Casting Items", "/casting/items", ["running-order", "roles", "cast", "item-notes"]],
    ["an item's Casting page", "/casting/items/opening-number", ["running-order", "roles", "cast"]],
    [
      "the Production overview",
      "/production/overview",
      ["running-order", "props", "mic-plot", "scenery-file-counts", "props-notes"],
    ],
  ])("asks only for 2028 on %s", async (_page, path, expected) => {
    const requests = serve2028();

    await open(path);

    const urls = requests.map(({ url }) => url);
    expect(urls.filter((url) => !url.startsWith(`${PRODUCTION}/`))).toEqual(
      urls.filter((url) => NOT_ABOUT_A_PRODUCTION.includes(url)),
    );
    expect(urls).toEqual(expect.arrayContaining(expected.map((rest) => `${PRODUCTION}/${rest}`)));
    const visits = requests.filter(({ url }) => url === "/api/usage").map(({ body }) => body);
    for (const visit of visits) expect(visit).not.toContain("2027");
  });
});
