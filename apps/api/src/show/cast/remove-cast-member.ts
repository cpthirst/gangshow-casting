import type { RoleStore } from "#/casting/roles/role-store.ts";
import type { CastStore, Refusal } from "./cast-store.ts";

/** Deletes a cast member for good, if they're still at `revision`, and takes them out of
 *  every role in the same change, so nobody is left cast after they've gone (ADR 0010). */
export type RemoveCastMember = (
  productionId: string,
  id: number,
  revision: number,
) => Promise<"removed" | Refusal>;

/**
 * For stores that can't share a transaction, like the local files: roles first, so a
 * failure never leaves roles pointing at nobody, then the member, then roles again.
 */
export function uncastThenRemove(cast: CastStore, roles: RoleStore): RemoveCastMember {
  return async (productionId, id, revision) => {
    // Refuse a stale or unknown delete before touching the roles; cast.remove has the final say.
    const member = (await cast.list(productionId))?.members.find((m) => m.id === id);
    if (!member) return "not-found";
    if (member.revision !== revision) return "stale";

    // If this throws, the member isn't deleted at all. If someone changes the member before
    // the delete below, they end up uncast but still listed, which is safe to retry.
    await roles.uncastMember(productionId, id);
    const result = await cast.remove(productionId, id, revision);
    if (result !== "removed") return result;
    // Again, in case they were cast in a role while this ran: no trace is left (ADR 0010).
    await roles.uncastMember(productionId, id);
    return "removed";
  };
}
