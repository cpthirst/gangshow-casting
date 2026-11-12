import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { icons } from "@/utils/icons.ts";
import EditButton from "./EditButton.vue";

describe("EditButton", () => {
  it("is a pencil named for what it edits, with a tooltip saying what it does", () => {
    const button = mount(EditButton, {
      props: { label: "Edit Captain Hook", tooltip: "Edit role", disabled: false },
    });

    expect(button.attributes("aria-label")).toBe("Edit Captain Hook");
    expect(button.attributes("data-tooltip")).toBe("Edit role");
    expect(button.get("svg").attributes("data-icon")).toBe(icons.edit.iconName);
  });

  it("opens the form when chosen, unless it's disabled", async () => {
    const onClick = vi.fn();
    const button = mount(EditButton, {
      props: { label: "Edit", tooltip: "Edit", disabled: false, onClick },
    });

    await button.trigger("click");
    await button.setProps({ disabled: true });

    expect(onClick).toHaveBeenCalledOnce();
    expect(button.attributes()).toHaveProperty("disabled");
  });
});
