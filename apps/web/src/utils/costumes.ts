import type { CastMember, Role } from "@app/shared";
import { castOf, sortRoles } from "./roles.ts";

/** One row in an item's Costumes section: a cast member in one of its roles, or a role with
 *  nobody in it (production-costume-sheets FR3). */
export interface CostumeRow {
  role: Role;
  member: CastMember | null;
}

/** The rows for an item's Costumes section: one per cast member in each of its roles,
 *  roles in the item's role order and each role's cast as the casting item page shows them,
 *  and one row with nobody for a role that is uncast (production-costume-sheets FR3). */
export const costumeRowsOf = (roles: Role[], cast: CastMember[], itemId: string): CostumeRow[] =>
  sortRoles(roles.filter((role) => role.itemId === itemId)).flatMap((role): CostumeRow[] => {
    const playing = castOf(role, cast);
    if (playing.length === 0) return [{ role, member: null }];
    return playing.map((member) => ({ role, member }));
  });
