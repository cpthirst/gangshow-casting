import {
  type CastMember,
  type Costume,
  type CostumeFields,
  MAX_NOTE_LENGTH,
  type Role,
} from "@app/shared";
import { castOf, fullName, roleSizeLabel, sortRoles } from "./roles.ts";

/** One row in an item's Costumes section: a cast member in one of its roles, or a role with
 *  nobody in it (production-costume-sheets FR3). */
export interface CostumeRow {
  role: Role;
  member: CastMember | null;
}

/** A cast row: someone in a role, never an uncast role's row. */
export type CastCostumeRow = CostumeRow & { member: CastMember };

/** The rows for an item's Costumes section: one per cast member in each of its roles,
 *  roles in the item's role order and each role's cast as the casting item page shows them,
 *  and one row with nobody for a role that is uncast (production-costume-sheets FR3). */
export const costumeRowsOf = (roles: Role[], cast: CastMember[], itemId: string): CostumeRow[] =>
  sortRoles(roles.filter((role) => role.itemId === itemId)).flatMap((role): CostumeRow[] => {
    const playing = castOf(role, cast);
    if (playing.length === 0) return [{ role, member: null }];
    return playing.map((member) => ({ role, member }));
  });

/** A costume row's fields, in the order the row and its form show them, with their labels
 *  (production-costume-sheets FR4). */
export const costumeFields = [
  { key: "fromWardrobe", label: "From Wardrobe" },
  { key: "fromCastMember", label: "From Cast Member" },
  { key: "notes", label: "Notes" },
] as const satisfies readonly { key: keyof CostumeFields; label: string }[];

/** What the form says stays out of the fields, as the upload area says photos do
 *  (production-costume-sheets FR6, ADR 0010). */
export const COSTUME_RULE = "Garments only: no sizes or measurements.";

/** Whose row it is: "Alex Morgan as Captain Hook". */
export const rowName = (role: Role, member: CastMember) => `${fullName(member)} as ${role.name}`;

const isRow = (costume: Costume, roleId: number, castMemberId: number) =>
  costume.roleId === roleId && costume.castMemberId === castMemberId;

/** The fields saved for a cast member in a role and the revision they were saved at: all
 *  empty, at 0, if nobody has saved them. */
export const costumeOf = (
  costumes: Costume[],
  role: Role,
  member: CastMember,
): CostumeFields & Pick<Costume, "revision"> =>
  costumes.find((costume) => isRow(costume, role.id, member.id)) ?? {
    fromWardrobe: "",
    fromCastMember: "",
    notes: "",
    revision: 0,
  };

/** The costumes with one row's saved in place of what it was. */
export const withSaved = (costumes: Costume[], saved: Costume) => [
  ...costumes.filter((costume) => !isRow(costume, saved.roleId, saved.castMemberId)),
  saved,
];

/** Each field too long to save, with why, counted as it will be saved (trimmed). */
export const costumeErrors = (
  fields: CostumeFields,
): Partial<Record<keyof CostumeFields, string>> =>
  Object.fromEntries(
    costumeFields
      .filter(({ key }) => fields[key].trim().length > MAX_NOTE_LENGTH)
      .map(({ key, label }) => [key, `${label} can be up to ${MAX_NOTE_LENGTH} characters.`]),
  );

/** A way to copy a row's costume to others in its item (production-costume-sheets FR16): its
 *  button's label, what it asks first, and the rows it reaches. */
export interface CostumeCopy {
  label: string;
  question: string;
  to: CastCostumeRow[];
}

const copyQuestion = (whom: string) =>
  `Copy From Wardrobe and From Cast Member to ${whom} in this item? Anything already in them will be overwritten.`;

/** The copies the row's form offers: to the item's other cast rows of its role's type, and to
 *  all of them. Each only when it reaches someone, and the first not when it reaches the same
 *  rows as the second. */
export function costumeCopiesOf(rows: CostumeRow[], from: CastCostumeRow): CostumeCopy[] {
  const others = rows.filter(
    (row): row is CastCostumeRow =>
      row.member !== null && !(row.role.id === from.role.id && row.member.id === from.member.id),
  );
  const sameType = others.filter(({ role }) => role.size === from.role.size);
  const type = roleSizeLabel(from.role.size);
  const toType: CostumeCopy = {
    label: `Copy to ${type}`,
    question: copyQuestion(
      sameType.length === 1
        ? `the other ${type} costume`
        : `the ${sameType.length} other ${type} costumes`,
    ),
    to: sameType,
  };
  const toAll: CostumeCopy = {
    label: "Copy to all",
    question: copyQuestion(
      others.length === 1 ? "the other costume" : `all ${others.length} other costumes`,
    ),
    to: others,
  };
  return [
    ...(sameType.length > 0 && sameType.length < others.length ? [toType] : []),
    ...(others.length > 0 ? [toAll] : []),
  ];
}
