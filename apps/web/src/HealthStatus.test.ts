import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import HealthStatus from "./HealthStatus.vue";

const respondWith = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("HealthStatus", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the API status and version from /api/health", async () => {
    const fetchMock = respondWith(200, { status: "ok", version: "1.2.3" });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(HealthStatus);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/health");
    expect(wrapper.text()).toBe("API: ok (1.2.3)");
  });

  it("shows unavailable when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const wrapper = mount(HealthStatus);
    await flushPromises();

    expect(wrapper.text()).toBe("API: unavailable");
  });

  it("treats an error status or off-contract body as unavailable", async () => {
    vi.stubGlobal("fetch", respondWith(500, { status: "down" }));

    const wrapper = mount(HealthStatus);
    await flushPromises();

    expect(wrapper.text()).toBe("API: unavailable");
  });

  it("shows a checking state before the API answers", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    expect(mount(HealthStatus).text()).toBe("API: checking…");
  });
});
