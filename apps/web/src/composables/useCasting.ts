import { CastList, type CastMember, type Role, RoleList } from "@app/shared";
import { ref } from "vue";
import { loadData } from "@/services/load-data.ts";
import { castPath, rolesPath } from "@/services/production.ts";

/**
 * The production's casting for a page that shows who plays what: every role and the cast
 * list. `load` fetches both and returns how to show them, in the shape the item page frame's
 * load takes, so a page shows them with the running order and whatever else it loads. No
 * roles or cast list yet just means there are none.
 */
export function useCasting() {
  const roles = ref<Role[]>([]);
  const cast = ref<CastMember[]>([]);

  async function load() {
    const [loadedRoles, loadedCast] = await Promise.all([
      loadData(rolesPath(), RoleList),
      loadData(castPath(), CastList),
    ]);
    return () => {
      roles.value = loadedRoles?.roles ?? [];
      cast.value = loadedCast?.members ?? [];
    };
  }

  return { roles, cast, load };
}
