import type { Costume } from "@app/shared";
import type { DOMWrapper } from "@vue/test-utils";
import { alexMorgan, captainHook } from "./casting.fixture.ts";

// Made-up data only: tests never use the real cast (CLAUDE.md safeguarding).

/** What Alex Morgan wears as Captain Hook in Opening Number. */
export const alexAsHook: Costume = {
  itemId: "opening-number",
  roleId: captainHook().id,
  castMemberId: alexMorgan.id,
  fromWardrobe: "Red coat, hook",
  fromCastMember: "Black shoes",
  notes: "Hem the coat",
};

/** A costume row's fields as shown: each label with its text. */
export const costumeFieldsOf = (row: Pick<DOMWrapper<Element>, "findAll">) =>
  row
    .findAll("[data-test=costume-field]")
    .map((field) => [field.get("dt").text(), field.get("dd").text()]);

/** A costume form's field, found by its label. */
export function costumeFormField(
  form: Pick<DOMWrapper<Element>, "findAll" | "get">,
  label: string,
) {
  const id = form
    .findAll("label")
    .find((found) => found.text() === label)
    ?.attributes("for");
  return form.get<HTMLTextAreaElement>(`#${CSS.escape(id ?? "")}`);
}
