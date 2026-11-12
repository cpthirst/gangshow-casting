import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { useFieldIds } from "./useFieldIds.ts";

type Field = "name" | "group";

/** Two forms, each with a name field, the first with an error on it. */
const twoForms = defineComponent(() => {
  const forms = [
    useFieldIds(ref<Partial<Record<Field, string>>>({ name: "Enter a name." })),
    useFieldIds(ref<Partial<Record<Field, string>>>({})),
  ];
  return () =>
    forms.map(({ idFor, errorFor, invalid }) =>
      h("form", [
        h("input", { id: idFor("name"), ...invalid("name") }),
        h("input", { id: idFor("group"), ...invalid("group") }),
        h("p", { id: errorFor("name") }),
      ]),
    );
});

describe("useFieldIds", () => {
  it("gives each field an id of its own, apart from another form's same field", () => {
    const [first, second] = mount(twoForms).findAll("input[id$=name]");

    expect(first?.attributes("id")).not.toBe(second?.attributes("id"));
  });

  it("wires a field with an error to its message, and leaves a field without one alone", () => {
    const form = mount(twoForms).get("form");
    const name = form.get("input[id$=name]");

    expect(name.attributes("aria-invalid")).toBe("true");
    expect(name.attributes("aria-describedby")).toBe(form.get("p").attributes("id"));
    expect(form.get("input[id$=group]").attributes()).not.toHaveProperty("aria-invalid");
  });
});
