import type { RoleStore } from "#/casting/roles/role-store.ts";
import type { CostumeStore } from "./costumes/costume-store.ts";
import type { MicPlotStore } from "./mic-plot/mic-plot-store.ts";
import type { PropStore } from "./props/prop-store.ts";

/** The production records that name who is cast in an item, so must follow casting. */
export interface CastingFollowers {
  props: PropStore;
  micPlots: MicPlotStore;
  costumes: CostumeStore;
}

/** After a casting change, takes every prop's carriers who no longer play its roles off it
 *  (production-props FR28), frees every channel held by someone no longer in its item
 *  (production-mics FR9), and deletes the costumes of every role that has gone
 *  (production-costume-sheets FR8). It runs once the change is saved, so if it fails the
 *  caller answers 500 for a change that went through; the next casting change sweeps the
 *  production again. */
export async function productionFollowsCasting(
  { props, micPlots, costumes }: CastingFollowers,
  roles: RoleStore,
  productionId: string,
) {
  const current = (await roles.list(productionId)).roles;
  await props.dropStrayCarriers(productionId, current);
  await micPlots.freeUncastChannels(productionId, current);
  await costumes.keepOnlyRoles(
    productionId,
    current.map((role) => role.id),
  );
}
