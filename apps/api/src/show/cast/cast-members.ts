import type { CastStore } from "./cast-store.ts";

/** True when every id belongs to someone on the production's cast list: only they can be
 *  cast in a role. No cast list means nobody can be. */
export async function areCastMembers(cast: CastStore, productionId: string, ids: number[]) {
  if (ids.length === 0) return true;
  const members = (await cast.list(productionId))?.members ?? [];
  const known = new Set(members.map((member) => member.id));
  return ids.every((id) => known.has(id));
}
