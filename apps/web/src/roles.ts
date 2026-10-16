import { AddRoleRequest, type RoleSize, sameRoleName } from "@app/shared";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every role in the production. */
export const ROLES_PATH = `/api/productions/${PRODUCTION_ID}/roles`;

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

/** The add-role form's fields, as typed. A blank size means none chosen yet. */
export interface RoleForm {
  name: string;
  size: RoleSize | "";
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
  const parsed = AddRoleRequest.safeParse(form);
  if (parsed.success) {
    const existing = taken.names.find((name) => sameRoleName(name, parsed.data.name));
    if (existing) {
      return { ok: false, errors: { name: nameTakenMessage(taken.itemTitle, existing) } };
    }
    return { ok: true, details: parsed.data };
  }

  const errors: Partial<Record<keyof RoleForm, string>> = {};
  for (const issue of parsed.error.issues) {
    if (issue.path[0] === "name") {
      errors.name =
        issue.code === "too_big" ? "Role names can be up to 60 characters" : "Enter a role name";
    }
    if (issue.path[0] === "size") errors.size = "Choose a role size";
  }
  return { ok: false, errors };
}
