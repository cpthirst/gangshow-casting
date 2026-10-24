import { CastList, RoleList, RunningOrder } from "@app/shared";
import { CAST_PATH } from "@/utils/cast.ts";
import { ROLES_PATH } from "@/utils/roles.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import { apiFetch } from "./sign-in.ts";

export type LatestShow = Awaited<ReturnType<typeof latestShow>>;

/** The cast, roles and running order as saved right now, so an export holds the latest
 *  casting, not what the page loaded earlier (casting-overview-by-item FR15). Throws if any
 *  of them can't be loaded, or there's no saved running order yet. */
export async function latestShow() {
  const [cast, roles, order] = await Promise.all(
    [CAST_PATH, ROLES_PATH, RUNNING_ORDER_PATH].map(async (path) => {
      const res = await apiFetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return res.json();
    }),
  );
  return {
    cast: CastList.parse(cast).members,
    roles: RoleList.parse(roles).roles,
    order: RunningOrder.parse(order),
  };
}
