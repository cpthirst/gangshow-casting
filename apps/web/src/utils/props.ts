import { AddPropRequest, MAX_PROP_NAME_LENGTH, type Prop } from "@app/shared";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every prop in the production (stage-props FR13). */
export const PROPS_PATH = `/api/productions/${PRODUCTION_ID}/props`;

/** Where a new prop for this item is posted. */
export const addPropPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/props`;

/** How many props each item has, by item id: 0 for an item with none. */
export function propCounts(props: readonly Prop[]) {
  const counts = new Map<string, number>();
  for (const { itemId } of props) counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  return (itemId: string) => counts.get(itemId) ?? 0;
}

/** A count with its label, so it never reads as a bare number: "1 prop", "3 props". */
export const propCountLabel = (count: number) => `${count} prop${count === 1 ? "" : "s"}`;

/** Props by name, ignoring case and comparing numbers by value ("Umbrella 2" before
 *  "Umbrella 10"), as roles are (stage-props FR21). Returns a new array. */
export const sortProps = (props: readonly Prop[]) =>
  [...props].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }),
  );

/** The prop form's fields, as typed. */
export interface PropFormFields {
  name: string;
}

export type PropFormResult =
  | { ok: true; details: AddPropRequest }
  | { ok: false; errors: Partial<Record<keyof PropFormFields, string>> };

/** The prop the form describes, or a message for each field that needs fixing. Limits come
 *  from the shared schema, so the page and the API agree. */
export function propDetailsFrom(form: PropFormFields): PropFormResult {
  const parsed = AddPropRequest.safeParse({ name: form.name });
  if (parsed.success) return { ok: true, details: parsed.data };
  const tooLong = parsed.error.issues.some((issue) => issue.code === "too_big");
  return {
    ok: false,
    errors: {
      name: tooLong
        ? `Prop names can be up to ${MAX_PROP_NAME_LENGTH} characters`
        : "A prop needs a name",
    },
  };
}
