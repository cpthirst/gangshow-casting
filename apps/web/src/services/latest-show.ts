import { CastList, ItemNoteList, PropList, RoleList, RunningOrder } from "@app/shared";
import { CAST_PATH } from "@/utils/cast.ts";
import { PROPS_PATH, propsListOf } from "@/utils/props.ts";
import { PROPS_NOTES_PATH } from "@/utils/props-notes.ts";
import { ROLES_PATH } from "@/utils/roles.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import { apiFetch } from "./sign-in.ts";

async function getJson(path: string): Promise<unknown> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

export type LatestShow = Awaited<ReturnType<typeof latestShow>>;

/** The cast, roles and running order as saved right now, so an export holds the latest
 *  casting, not what the page loaded earlier (casting-overview-by-item FR15). Throws if any
 *  of them can't be loaded, or there's no saved running order yet. */
export async function latestShow() {
  const [cast, roles, order] = await Promise.all(
    [CAST_PATH, ROLES_PATH, RUNNING_ORDER_PATH].map(getJson),
  );
  return {
    cast: CastList.parse(cast).members,
    roles: RoleList.parse(roles).roles,
    order: RunningOrder.parse(order),
  };
}

/** The production's title and its props list as saved right now, with the casting as it is
 *  at that moment (stage-props FR22). Throws if anything it needs can't be loaded. */
export async function latestPropsList() {
  const [show, props, notes] = await Promise.all([
    latestShow(),
    getJson(PROPS_PATH),
    getJson(PROPS_NOTES_PATH),
  ]);
  return {
    title: show.order.title,
    halves: propsListOf({
      ...show,
      props: PropList.parse(props).props,
      notes: ItemNoteList.parse(notes).notes,
    }),
  };
}
