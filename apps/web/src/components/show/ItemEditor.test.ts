import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { anItem } from "@/utils/running-order.fixture.ts";
import { aNewItem } from "@/utils/running-order.ts";
import ItemEditor from "./ItemEditor.vue";

enableAutoUnmount(afterEach);

// Made-up items only (CLAUDE.md safeguarding).
const gangList = (wrapper: ReturnType<typeof mount>) => {
  const select = wrapper.get("select[name=gang]").element;
  if (!(select instanceof HTMLSelectElement)) throw new Error("Gang is not a list");
  return select;
};
const appliedGang = (wrapper: ReturnType<typeof mount>) =>
  wrapper.emitted<[{ gang: string }]>("apply")?.[0]?.[0].gang;

describe("the item editor's Gang", () => {
  it("offers Junior, Senior and Both, labelled Gang", () => {
    const wrapper = mount(ItemEditor, { props: { item: anItem("Beaver Bop") } });
    const select = gangList(wrapper);

    expect(wrapper.get(`label[for="${select.id}"]`).text()).toBe("Gang");
    expect([...select.options].map((option) => option.text.trim())).toEqual([
      "Junior",
      "Senior",
      "Both",
    ]);
  });

  it("makes a new item Senior unless its Gang is changed", async () => {
    const wrapper = mount(ItemEditor, { props: { item: aNewItem(), addingTo: "second half" } });
    expect(gangList(wrapper).selectedOptions[0]?.text.trim()).toBe("Senior");

    await wrapper.get("input[name=title]").setValue("Campfire Song");
    await wrapper.get("form").trigger("submit");

    expect(appliedGang(wrapper)).toBe("senior");
  });

  it.each(["junior", "both"])("marks an item for the %s gang", async (gang) => {
    const wrapper = mount(ItemEditor, { props: { item: anItem("Beaver Bop") } });

    await wrapper.get("select[name=gang]").setValue(gang);
    await wrapper.get("form").trigger("submit");

    expect(appliedGang(wrapper)).toBe(gang);
  });
});
