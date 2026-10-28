import {
  AddPropRequest,
  type CastMember,
  carryingCast,
  type ItemNote,
  MAX_PROP_NAME_LENGTH,
  MAX_PROP_QUANTITY,
  type Prop,
  type Role,
  type RunningOrder,
} from "@app/shared";
import { sortCast } from "./cast.ts";
import { type CastMemberChoice, castOf, fullName, sortRoles } from "./roles.ts";
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

/** Who carries a prop with these roles and quantity (production-props FR26, FR27): everyone
 *  in its named parts always does, and up to `room` more are chosen from the rest of its
 *  ensembles' cast, by surname, when there are more of them than that. */
export function carriersOf(roles: Role[], cast: CastMember[], quantity: number) {
  const ids = carryingCast(roles);
  const named = sortCast(cast.filter((member) => ids.named.includes(member.id)));
  const choosable = sortCast(cast.filter((member) => ids.choosable.includes(member.id)));
  const room = Math.max(0, quantity - named.length);
  // When the ensembles fit the room left, they all carry it. When the named parts fill it,
  // nobody in them does, so there's nobody to choose. A quantity not yet typed (NaN) is
  // neither, and offers no choosing.
  const everyoneFits = choosable.length <= room;
  return {
    named,
    /** The named parts that always carry it, in role order, for saying which. */
    namedRoles: sortRoles(roles)
      .filter((role) => role.size !== "ensemble" && role.castMemberIds.length > 0)
      .map((role) => role.name),
    choosable,
    room,
    everyoneFits,
    offersCarriers: room > 0 && !everyoneFits,
  };
}

/** Who carries a prop, role by role in the item's role order, how many are left to choose,
 *  and how many aren't given to anyone (production-props FR26, FR27). A carrier no longer
 *  in its ensembles doesn't count. Each role's carriers are "" when it has none, with
 *  `none` to show instead. */
export function carryingOf(prop: Prop, roles: Role[], cast: CastMember[]) {
  const linked = rolesOf(prop, roles);
  const { named, choosable, room, everyoneFits, offersCarriers } = carriersOf(
    linked,
    cast,
    prop.quantity,
  );
  // Only while there's room to choose: the named parts may have filled it since.
  const chosen = offersCarriers
    ? choosable.filter((member) => prop.carrierIds.includes(member.id))
    : [];
  const carrying = [...named, ...(everyoneFits ? choosable : chosen)].map(({ id }) => id);
  const carries = (member: CastMember) => carrying.includes(member.id);
  return {
    roles: linked.map((role) => {
      const playing = castOf(role, cast);
      return {
        role,
        carriers: playing.filter(carries).map(fullName).join(", "),
        none: playing.length === 0 ? "Uncast" : "Nobody carries it",
      };
    }),
    toChoose: offersCarriers ? Math.max(0, room - chosen.length) : 0,
    // Nobody left to choose, yet fewer carry it than the quantity: the rest go to nobody. A
    // prop linked to no roles isn't carried, so it has none to give.
    notGiven:
      linked.length > 0 && !offersCarriers ? Math.max(0, prop.quantity - carrying.length) : 0,
  };
}

/** What a prop's card and the props list say is left to sort out about its carriers: how
 *  many are left to choose, and how many aren't given to anyone (production-props FR26,
 *  FR27, FR29). One place, so the two say it the same way. */
export const toChooseLabel = (count: number) => `${count} left to choose`;
export const notGivenLabel = (count: number) => `${count} not given to anyone`;

/** What the carrier picker says about how many can still be chosen. */
export function carriersHint(quantity: number, chosen: number) {
  const limit = `Choose up to ${quantity}`;
  if (chosen === 0) return limit;
  const left = quantity - chosen;
  // Lowering the quantity can leave more chosen than it allows (production-props FR28).
  if (left < 0) return `${limit} · ${-left} too many: remove ${-left}`;
  return `${limit} · ${left > 0 ? left : "none"} left to choose`;
}

/** One item in the props list: its notes ("" for none) and props, each prop with its
 *  quantity, its roles and who in them carries it (or why nobody does), and what's left to
 *  sort out about its carriers. */
export interface PropsListItem {
  title: string;
  /** Its programme number; null when it isn't in the printed programme. */
  number: number | null;
  notes: string;
  props: {
    name: string;
    quantity: number;
    roles: { name: string; cast: string }[];
    notes: string[];
  }[];
}

/** One half of the props list: its name and items in running order. */
export interface PropsListHalf {
  name: string;
  items: PropsListItem[];
}

/** The whole show's props, half by half in running order, in the order each item's props
 *  page shows them, and with its carriers as the cards show them (production-props FR22, FR29).
 *  Only names: nothing else about the cast. */
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
        props: sortProps(show.props.filter((prop) => prop.itemId === item.id)).map((prop) => {
          const { roles, toChoose, notGiven } = carryingOf(prop, show.roles, show.cast);
          return {
            name: prop.name,
            quantity: prop.quantity,
            roles: roles.map(({ role, carriers, none }) => ({
              name: role.name,
              cast: carriers || none,
            })),
            notes: [
              ...(toChoose > 0 ? [toChooseLabel(toChoose)] : []),
              ...(notGiven > 0 ? [notGivenLabel(notGiven)] : []),
            ],
          };
        }),
      }),
    ),
  }));
}

/** The prop form's fields, as typed: the roles and carriers picked, and the search for one
 *  more of each. */
export interface PropFormFields {
  name: string;
  quantity: string;
  role: CastMemberChoice;
  roleIds: number[];
  carrier: CastMemberChoice;
  carrierIds: number[];
}

export type PropFormResult =
  | { ok: true; details: AddPropRequest }
  | { ok: false; errors: Partial<Record<keyof PropFormFields, string>> };

/** The prop the form describes, or a message for each field that needs fixing. Limits come
 *  from the shared schema, so the page and the API agree. carrying: whether the form offers
 *  a carrier picker (without one, everyone in the prop's roles carries it, so no carriers
 *  are saved), and how many people in which named parts always carry it (production-props
 *  FR26, FR27). */
export function propDetailsFrom(
  form: PropFormFields,
  carrying: { offersCarriers: boolean; named: number; namedRoles: string[] },
): PropFormResult {
  const quantity = quantityOf(form.quantity);
  const carrierIds = carrying.offersCarriers ? form.carrierIds : [];
  const parsed = AddPropRequest.safeParse({
    name: form.name,
    quantity,
    roleIds: form.roleIds,
    carrierIds,
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
  const room = quantity - carrying.named;
  if (issues.some(({ path }) => path[0] === "quantity")) {
    errors.quantity = `Quantity must be a whole number from 1 to ${MAX_PROP_QUANTITY}`;
  } else if (room < 0) {
    const roles = new Intl.ListFormat("en-GB").format(carrying.namedRoles);
    errors.quantity = `${roles} always carry it: make the quantity at least ${carrying.named}`;
  } else if (carrierIds.length > room) {
    // The picker stops at the room left, so only lowering the quantity gets here (FR28).
    const chosen = carrierIds.length;
    errors.quantity = `${chosen} carriers chosen for ${room}: remove ${chosen - room} first`;
  }
  // Typed but not chosen: the text alone doesn't say which role, so it isn't guessed.
  if (form.role.query.trim() !== "") {
    errors.role = "Choose a role from the list, or clear the field";
  }
  if (carrying.offersCarriers && form.carrier.query.trim() !== "") {
    errors.carrier = "Choose someone from the list, or clear the field";
  }
  if (parsed.success && Object.keys(errors).length === 0) {
    return { ok: true, details: parsed.data };
  }
  return { ok: false, errors };
}

/** The quantity typed, as a number; anything but digits, an empty field included, is no
 *  quantity at all (NaN), so it's refused rather than saved as the API's default of 1. */
export function quantityOf(typed: string) {
  const quantity = typed.trim();
  return /^\d+$/.test(quantity) ? Number(quantity) : Number.NaN;
}
