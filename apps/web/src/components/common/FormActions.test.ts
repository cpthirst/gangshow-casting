import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import FormActions from "./FormActions.vue";

const buttons = (saving: boolean) =>
  mount(FormActions, { props: { saving, error: "" } }).findAll("button");

describe("FormActions", () => {
  it("offers Save, which submits the form, and Cancel, which asks to close it", async () => {
    const actions = mount(FormActions, { props: { saving: false, error: "" } });
    const [save, cancel] = actions.findAll("button");

    await cancel?.trigger("click");

    expect([save?.text(), save?.attributes("type")]).toEqual(["Save", "submit"]);
    expect(cancel?.text()).toBe("Cancel");
    expect(actions.emitted("cancel")).toHaveLength(1);
  });

  it("holds both buttons while a save is on its way", () => {
    expect(buttons(true).map((button) => button.attributes("disabled"))).toEqual(["", ""]);
    expect(buttons(false).map((button) => button.attributes("disabled"))).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("says why the last save failed, as an alert, only when it did", () => {
    const failed = mount(FormActions, { props: { saving: false, error: "Couldn't save." } });

    expect(failed.get("[role=alert]").text()).toBe("Couldn't save.");
    expect(buttons(false)).toHaveLength(2);
    expect(
      mount(FormActions, { props: { saving: false, error: "" } })
        .find("[role=alert]")
        .exists(),
    ).toBe(false);
  });
});
