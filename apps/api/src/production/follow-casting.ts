import type { RoleStore } from "#/casting/roles/role-store.ts";
import type { MicPlotStore } from "./mic-plot/mic-plot-store.ts";
import type { PropStore } from "./props/prop-store.ts";

/** The production records that name who is cast in an item, so must follow casting. */
export interface CastingFollowers {
  props: PropStore;
  micPlots: MicPlotStore;
}

/** After a casting change, takes every prop's carriers who no longer play its roles off it
 *  (production-props FR28), and frees every channel held by someone no longer in its item
 *  (production-mics FR9). It runs once the change is saved, so if it fails the caller answers
 *  500 for a change that went through; the next casting change sweeps the production again. */
export async function productionFollowsCasting(
  { props, micPlots }: CastingFollowers,
  roles: RoleStore,
  productionId: string,
) {
  const current = (await roles.list(productionId)).roles;
  await props.dropStrayCarriers(productionId, current);
  await micPlots.freeUncastChannels(productionId, current);
}
