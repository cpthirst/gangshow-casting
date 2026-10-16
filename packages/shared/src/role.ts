import { z } from "zod";
import { CastMember } from "./cast.ts";
import { ProductionId, RunningOrderItem } from "./running-order.ts";

/** Ranked biggest first, for ordering an item's roles (casting-item-overview.E2.S1). */
export const RoleSize = z.enum(["lead", "support", "cameo", "ensemble"]);

/**
 * A part in one item. Strict, and it holds cast member ids, never their names, so deleting
 * someone from the cast removes them from every role (ADR 0010).
 */
export const Role = z.strictObject({
  /** Assigned by the app; never edited or reused. */
  id: z.number().int().positive(),
  /** The running-order item it belongs to. */
  itemId: RunningOrderItem.shape.id,
  /** The character name, e.g. "Captain Hook". Unique within its item (see sameRoleName). */
  name: z.string().trim().min(1).max(60),
  size: RoleSize,
  /** Who plays it: empty while uncast. */
  castMemberIds: z.array(CastMember.shape.id).max(200),
  /** Goes up on every change, so a stale edit or removal can be refused. */
  revision: z.number().int().positive(),
});

/**
 * POST /api/productions/{productionId}/items/{itemId}/roles: a new, uncast role.
 * 201 returns the Role; 404 if the item isn't in the latest saved running order.
 */
export const AddRoleRequest = Role.pick({ name: true, size: true });

/** 400 from adding a role: the item already has a role with that name. */
export const AddRoleRefusal = z.strictObject({ error: z.literal("name-taken") });

/** Role names match ignoring case and surrounding spaces ("captain hook " = "Captain Hook"). */
export const sameRoleName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** GET /api/productions/{productionId}/roles: every role in the production. */
export const RoleList = z.strictObject({
  productionId: ProductionId,
  roles: z.array(Role).max(2000),
});

export type RoleSize = z.infer<typeof RoleSize>;
export type Role = z.infer<typeof Role>;
export type AddRoleRequest = z.infer<typeof AddRoleRequest>;
export type AddRoleRefusal = z.infer<typeof AddRoleRefusal>;
export type RoleList = z.infer<typeof RoleList>;
