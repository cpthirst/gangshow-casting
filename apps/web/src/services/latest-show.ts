import { CastList, ItemNoteList, MicPlotList, PropList, RoleList, RunningOrder } from "@app/shared";
import { CAST_PATH } from "@/utils/cast.ts";
import { departmentNotesPath } from "@/utils/item-notes.ts";
import { MIC_PLOT_PATH, micPlotListOf } from "@/utils/mic-plot.ts";
import { PROPS_PATH, propsListOf } from "@/utils/props.ts";
import { ROLES_PATH } from "@/utils/roles.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import { loadRequired } from "./load-data.ts";

export type LatestShow = Awaited<ReturnType<typeof latestShow>>;

/** The cast, roles and running order as saved right now, so an export holds the latest
 *  casting, not what the page loaded earlier (casting-overview-by-item FR15). Throws if any
 *  of them can't be loaded, or there's no saved running order yet. */
export async function latestShow() {
  const [cast, { roles }, order] = await Promise.all([
    loadRequired(CAST_PATH, CastList),
    loadRequired(ROLES_PATH, RoleList),
    loadRequired(RUNNING_ORDER_PATH, RunningOrder),
  ]);
  return { cast: cast.members, roles, order };
}

/** The production's title and its props list as saved right now, with the casting as it is
 *  at that moment (production-props FR22). Throws if anything it needs can't be loaded. */
export async function latestPropsList() {
  const [show, { props }, { notes }] = await Promise.all([
    latestShow(),
    loadRequired(PROPS_PATH, PropList),
    loadRequired(departmentNotesPath("props"), ItemNoteList),
  ]);
  return {
    title: show.order.title,
    halves: propsListOf({ ...show, props, notes }),
  };
}

/** The production and its mic plot as saved right now, with the casting as it is at that
 *  moment (production-mics FR14). Throws if anything it needs can't be loaded. */
export async function latestMicPlot() {
  const [show, { items: plots }, { notes }] = await Promise.all([
    latestShow(),
    loadRequired(MIC_PLOT_PATH, MicPlotList),
    loadRequired(departmentNotesPath("mic-plot"), ItemNoteList),
  ]);
  return {
    title: show.order.title,
    productionId: show.order.productionId,
    halves: micPlotListOf({ ...show, plots, notes }),
  };
}
