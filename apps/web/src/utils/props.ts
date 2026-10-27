import {
  AddPropRequest,
  type CastMember,
  type ItemNote,
  MAX_PROP_NAME_LENGTH,
  MAX_PROP_QUANTITY,
  type Prop,
  type Role,
  type RunningOrder,
} from "@app/shared";
import { type CastMemberChoice, castNames, sortRoles } from "./roles.ts";
import { runningClock } from "./running-order.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every prop in the production (production-props FR13). */
export const PROPS_PATH = `/api/productions/${PRODUCTION_ID}/props`;

/** Where a new prop for this item is posted. */
export const addPropPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/props`;

/** Where one prop is edited (PUT) or removed (DELETE). */
export const propPath = (propId: number) => `${PROPS_PATH}/${propId}`;

/** How many props each item has, by item id, adding up quantities ("Umbrella ×10" is 10;
 *  production-props FR25): 0 for an item with none. */
export function propCounts(props: readonly Prop[]) {
  const counts = new Map<string, number>();
  for (const { itemId, quantity } of props) {
    counts.set(itemId, (counts.get(itemId) ?? 0) + quantity);
  }
  return (itemId: string) => counts.get(itemId) ?? 0;
}

/** A count with its label, so it never reads as a bare number: "1 prop", "3 props". */
export const propCountLabel = (count: number) => `${count} prop${count === 1 ? "" : "s"}`;

/** Props by name, ignoring case and comparing numbers by value ("Umbrella 2" before
 *  "Umbrella 10"), as roles are (production-props FR21). Returns a new array. */
export const sortProps = (props: readonly Prop[]) =>
  [...props].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }),
  );

/** A prop's roles that still exist, in the item's role order (production-props FR18). A removed
 *  role's id may linger on the prop; it simply isn't shown. */
export const rolesOf = (prop: Prop, roles: Role[]) =>
  sortRoles(roles.filter((role) => prop.roleIds.includes(role.id)));

/** One item in the props list: its notes ("" for none) and props, each prop with its roles
 *  and who plays them ("" while uncast). */
export interface PropsListItem {
  title: string;
  /** Its programme number; null when it isn't in the printed programme. */
  number: number | null;
  notes: string;
  props: { name: string; roles: { name: string; cast: string }[] }[];
}

/** One half of the props list: its name and items in running order. */
export interface PropsListHalf {
  name: string;
  items: PropsListItem[];
}

/** The whole show's props, half by half in running order, in the order each item's props
 *  page shows them (production-props FR22). Only names: nothing else about the cast. */
export function propsListOf(show: {
  order: RunningOrder;
  props: Prop[];
  roles: Role[];
  cast: CastMember[];
  notes: ItemNote[];
}): PropsListHalf[] {
  const notesOf = (itemId: string) => show.notes.find((note) => note.itemId === itemId)?.text;
  return runningClock(show.order).halves.map(({ half, rows }) => ({
    name: half.name,
    items: rows.map(
      ({ item, number }): PropsListItem => ({
        title: item.title,
        number,
        notes: notesOf(item.id) ?? "",
        props: sortProps(show.props.filter((prop) => prop.itemId === item.id)).map((prop) => ({
          name: prop.name,
          roles: rolesOf(prop, show.roles).map((role) => ({
            name: role.name,
            cast: castNames(role, show.cast),
          })),
        })),
      }),
    ),
  }));
}

/** The prop form's fields, as typed: the roles picked, and the search for one more. */
export interface PropFormFields {
  name: string;
  quantity: string;
  role: CastMemberChoice;
  roleIds: number[];
}

export type PropFormResult =
  | { ok: true; details: AddPropRequest }
  | { ok: false; errors: Partial<Record<keyof PropFormFields, string>> };

/** The prop the form describes, or a message for each field that needs fixing. Limits come
 *  from the shared schema, so the page and the API agree. */
export function propDetailsFrom(form: PropFormFields): PropFormResult {
  const parsed = AddPropRequest.safeParse({
    name: form.name,
    quantity: quantityOf(form.quantity),
    roleIds: form.roleIds,
  });
  const errors: Partial<Record<keyof PropFormFields, string>> = {};
  const issues = parsed.error?.issues ?? [];
  const nameIssues = issues.filter(({ path }) => path[0] === "name");
  if (nameIssues.length > 0) {
    const tooLong = nameIssues.some((issue) => issue.code === "too_big");
    errors.name = tooLong
      ? `Prop names can be up to ${MAX_PROP_NAME_LENGTH} characters`
      : "A prop needs a name";
  }
  if (issues.some(({ path }) => path[0] === "quantity")) {
    errors.quantity = `Quantity must be a whole number from 1 to ${MAX_PROP_QUANTITY}`;
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

/** The quantity typed, as a number; anything but digits, an empty field included, is no
 *  quantity at all, so it's refused rather than saved as the API's default of 1. */
function quantityOf(typed: string) {
  const quantity = typed.trim();
  return /^\d+$/.test(quantity) ? Number(quantity) : Number.NaN;
}
