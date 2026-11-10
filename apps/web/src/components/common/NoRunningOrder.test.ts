import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "@/router/index.ts";
import NoRunningOrder from "./NoRunningOrder.vue";

describe("NoRunningOrder", () => {
  it("says there's no saved running order, with a link to set one up", () => {
    const wrapper = mount(NoRunningOrder, {
      global: { plugins: [createAppRouter(createMemoryHistory())] },
    });

    expect(wrapper.text()).toContain("There's no saved running order yet.");
    expect(wrapper.get("a[href='/running-order']").text()).toBe("Running order page");
  });
});
