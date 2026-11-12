import type { RoleStore } from "#/casting/roles/role-store.ts";
import type { CostumeStore } from "#/production/costumes/costume-store.ts";
import type { CastStore, Refusal } from "./cast-store.ts";

/** Deletes a cast member for good, if they're still at `revision`, and takes them out of
 *  every role and deletes their costumes in the same change, so nothing about them is left
 *  after they've gone (ADR 0010, production-costume-sheets FR8). */
export type RemoveCastMember = (
  productionId: string,
  id: number,
  revision: number,
) => Promise<"removed" | Refusal>;

/**
 * For stores that can't share a transaction, like the local files: roles and costumes first,
 * so a failure never leaves them pointing at nobody, then the member, then both again.
 */
export function uncastThenRemove(
  cast: CastStore,
  roles: RoleStore,
  costumes: CostumeStore,
): RemoveCastMember {
  const uncast = async (productionId: string, id: number) => {
    await roles.uncastMember(productionId, id);
    // Uncast first, so a save checked after this is refused. One checked just before can
    // still land after; the local files are one person's, so that's left for the sweep after
    // the delete below.
    await costumes.deleteCostumesOf(productionId, id);
  };
  return async (productionId, id, revision) => {
    // Refuse a stale or unknown delete before touching the roles; cast.remove has the final say.
    const member = (await cast.list(productionId))?.members.find((m) => m.id === id);
    if (!member) return "not-found";
    if (member.revision !== revision) return "stale";

    // If this throws, the member isn't deleted at all. If someone changes the member before
    // the delete below, they end up uncast, with no costumes, but still listed, which is safe
    // to retry.
    await uncast(productionId, id);
    const result = await cast.remove(productionId, id, revision);
    if (result !== "removed") return result;
    // Again, in case they were cast in a role while this ran: no trace is left (ADR 0010).
    await uncast(productionId, id);
    return "removed";
  };
}
