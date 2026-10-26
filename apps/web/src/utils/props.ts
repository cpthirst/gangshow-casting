import { AddPropRequest, MAX_PROP_NAME_LENGTH, type Prop, type Role } from "@app/shared";
import { type CastMemberChoice, sortRoles } from "./roles.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every prop in the production (stage-props FR13). */
export const PROPS_PATH = `/api/productions/${PRODUCTION_ID}/props`;

/** Where a new prop for this item is posted. */
export const addPropPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/props`;

/** Where one prop is edited (PUT) or removed (DELETE). */
export const propPath = (propId: number) => `${PROPS_PATH}/${propId}`;

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

/** A prop's roles that still exist, in the item's role order (stage-props FR18). A removed
 *  role's id may linger on the prop; it simply isn't shown. */
export const rolesOf = (prop: Prop, roles: Role[]) =>
  sortRoles(roles.filter((role) => prop.roleIds.includes(role.id)));

/** The prop form's fields, as typed: the roles picked, and the search for one more. */
export interface PropFormFields {
  name: string;
  role: CastMemberChoice;
  roleIds: number[];
}

export type PropFormResult =
  | { ok: true; details: AddPropRequest }
  | { ok: false; errors: Partial<Record<keyof PropFormFields, string>> };

/** The prop the form describes, or a message for each field that needs fixing. Limits come
 *  from the shared schema, so the page and the API agree. */
export function propDetailsFrom(form: PropFormFields): PropFormResult {
  const parsed = AddPropRequest.safeParse({ name: form.name, roleIds: form.roleIds });
  const errors: Partial<Record<keyof PropFormFields, string>> = {};
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((issue) => issue.code === "too_big");
    errors.name = tooLong
      ? `Prop names can be up to ${MAX_PROP_NAME_LENGTH} characters`
      : "A prop needs a name";
  }
  // Typed but not chosen: the text alone doesn't say which role, so it isn't guessed.
  if (form.role.query.trim() !== "") {
    errors.role = "Choose a role from the list, or clear the field";
  }
  if (parsed.success && Object.keys(errors).length === 0) {
    return { ok: true, details: parsed.data };
  }
  return { ok: false, errors };
}
