import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("still renders the page when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const wrapper = mount(App, { props: { title: "Hello" } });
    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("Hello");
    expect(wrapper.text()).toContain("API: unavailable");
  });
});
