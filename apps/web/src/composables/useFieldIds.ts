import { type Ref, useId } from "vue";

/**
 * Ids for a form's fields and their error messages, unique on the page, and the attributes
 * that wire a field to its error while it has one, as every add and edit form does.
 * errors: each field's error, by field.
 */
export function useFieldIds<Field extends string>(errors: Ref<Partial<Record<Field, string>>>) {
  const uid = useId();
  const idFor = (field: Field) => `${uid}-${field}`;
  const errorFor = (field: Field) => `${uid}-${field}-error`;
  const invalid = (field: Field) =>
    errors.value[field] ? { "aria-invalid": true, "aria-describedby": errorFor(field) } : {};
  return { uid, idFor, errorFor, invalid };
}
