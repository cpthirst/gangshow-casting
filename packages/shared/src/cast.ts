import { z } from "zod";
import { ProductionId } from "./running-order.ts";

export const Section = z.enum(["scouts", "explorers", "network"]);

/**
 * A cast member: only the fields ADR 0010 allows. Strict, so any other personal data
 * (a date of birth, contact details…) is rejected rather than silently stored.
 */
export const CastMember = z.strictObject({
  /** Assigned by the app; never edited or reused. */
  id: z.number().int().positive(),
  firstName: z.string().trim().min(1).max(40),
  lastName: z.string().trim().min(1).max(40),
  /** null while not set. */
  section: Section.nullable(),
  /** Scout group or Explorer unit; "" while not set. */
  group: z.string().trim().max(60),
  /** Goes up on every change, so a stale edit or delete can be refused. */
  revision: z.number().int().positive(),
});

/** GET /api/productions/{productionId}/cast: the production's cast members. */
export const CastList = z.strictObject({
  productionId: ProductionId,
  members: z.array(CastMember).max(1000),
});

export type Section = z.infer<typeof Section>;
export type CastMember = z.infer<typeof CastMember>;
export type CastList = z.infer<typeof CastList>;
