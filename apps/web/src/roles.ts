import { AddRoleRequest, type CastMember, type Role, RoleSize, sameRoleName } from "@app/shared";
import { sortCast } from "./cast.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every role in the production. */
export const ROLES_PATH = `/api/productions/${PRODUCTION_ID}/roles`;

/** Where an edited role is put. */
export const updateRolePath = (roleId: number) => `${ROLES_PATH}/${roleId}`;

/** Where a role is removed, if it's still at the revision shown. */
export const removeRolePath = (role: Role) => `${ROLES_PATH}/${role.id}?revision=${role.revision}`;

/** Where a new role for this item is posted. */
export const addRolePath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/roles`;

const sizeLabels: Record<RoleSize, string> = {
  lead: "Lead",
  support: "Support",
  cameo: "Cameo",
  ensemble: "Ensemble",
};

export const roleSizeLabel = (size: RoleSize) => sizeLabels[size];

// RoleSize is declared biggest first (packages/shared), so its order is the ranking.
const sizeRank = (size: RoleSize) => RoleSize.options.indexOf(size);

/** The bigger of two parts: someone with both a lead and an ensemble role in an item counts
 *  as a lead there. */
export const biggerPart = (a: RoleSize, b: RoleSize) => (sizeRank(a) <= sizeRank(b) ? a : b);

/** An item's roles in reading order: biggest first (lead → ensemble), then by name,
 *  ignoring case (PRD FR4). Returns a new array. */
export const sortRoles = (roles: Role[]) =>
  [...roles].sort(
    (a, b) =>
      sizeRank(a.size) - sizeRank(b.size) ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );

/** The cast member field: what's typed, and who was chosen from the list (if anyone). */
export interface CastMemberChoice {
  query: string;
  id: number | null;
}

/** The role form's fields, as typed. A blank size means none chosen yet. When editing an
 *  ensemble, members lists who's in it, and castMember is the search for one more. */
export interface RoleForm {
  name: string;
  size: RoleSize | "";
  castMember: CastMemberChoice;
  members?: number[];
}

export type RoleFormResult =
  | { ok: true; details: AddRoleRequest }
  | { ok: false; errors: Partial<Record<keyof RoleForm, string>> };

/** The names an item's roles already use, so a new one can't repeat them. */
export interface TakenNames {
  itemTitle: string;
  names: string[];
}

export const nameTakenMessage = (itemTitle: string, name: string) =>
  `${itemTitle} already has a role called ${name.trim()}`;

/** The role the form describes, or a message for each field that needs fixing.
 *  Limits come from the shared schema, so the page and the API agree. */
export function roleDetailsFrom(form: RoleForm, taken: TakenNames): RoleFormResult {
  const { castMember, members } = form;
  const parsed = AddRoleRequest.safeParse({
    name: form.name,
    size: form.size,
    castMemberIds: members ?? (castMember.id === null ? [] : [castMember.id]),
  });
  const errors: Partial<Record<keyof RoleForm, string>> = {};
  // Typed but not chosen: the text alone doesn't say who, so it isn't guessed.
  if (castMember.id === null && castMember.query.trim() !== "") {
    errors.castMember = "Choose a cast member from the list, or clear the field";
  }
  if (parsed.success) {
    const existing = taken.names.find((name) => sameRoleName(name, parsed.data.name));
    if (existing) errors.name = nameTakenMessage(taken.itemTitle, existing);
    return Object.keys(errors).length > 0
      ? { ok: false, errors }
      : { ok: true, details: parsed.data };
  }

  for (const issue of parsed.error.issues) {
    if (issue.path[0] === "name") {
      errors.name =
        issue.code === "too_big" ? "Role names can be up to 60 characters" : "Enter a role name";
    }
    if (issue.path[0] === "size") errors.size = "Choose a role size";
    // Only an ensemble holds several people (PRD FR6).
    const singleSize = form.size !== "" && form.size !== "ensemble" ? form.size : undefined;
    // Add All Cast can fill an ensemble past the shared limit on a big cast (FR11).
    if (issue.path[0] === "castMemberIds" && !singleSize && issue.code === "too_big") {
      errors.castMember = "An ensemble can hold up to 200 people. Remove some to save it.";
    }
    if (issue.path[0] === "castMemberIds" && singleSize && (members?.length ?? 0) > 1) {
      errors.size = `Leave one person in this ensemble before making it a ${roleSizeLabel(singleSize)} role`;
    }
  }
  return { ok: false, errors };
}

/** An item's role counts: every role, and those with anyone in them (an ensemble counts as
 *  cast once it has one person). PRD casting-items FR2. */
export function roleCounts(roles: Role[], itemId: string) {
  const itemRoles = roles.filter((role) => role.itemId === itemId);
  return {
    total: itemRoles.length,
    cast: itemRoles.filter((role) => role.castMemberIds.length > 0).length,
  };
}

/** "5 roles, 3 cast": the counts as a screen reader should hear them. */
export const spokenCounts = ({ total, cast }: { total: number; cast: number }) =>
  `${total} role${total === 1 ? "" : "s"}, ${cast} cast`;

/** Who "Add All Cast" puts in an ensemble (casting-roles FR11): everyone on the cast list who
 *  isn't in another role in the item, nor already in the ensemble, in surname order. Parts
 *  in other items don't matter, and no casting rules are checked. */
export const remainingCast = (
  cast: CastMember[],
  inOtherRoles: readonly number[],
  inEnsemble: readonly number[],
) =>
  sortCast(cast)
    .map((member) => member.id)
    .filter((id) => !inOtherRoles.includes(id) && !inEnsemble.includes(id));
