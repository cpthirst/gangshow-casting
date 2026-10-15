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

/**
 * The details people can set: everything but the app-managed id and revision.
 * POST /api/productions/{productionId}/cast takes these; 201 returns the new CastMember.
 */
export const CastMemberDetails = CastMember.pick({
  firstName: true,
  lastName: true,
  section: true,
  group: true,
});

/**
 * PUT /api/productions/{productionId}/cast/{castId}: new details plus the revision they
 * were based on (stale → 409). The id comes from the URL, so a body with one is refused.
 * 200 returns the updated CastMember.
 */
export const UpdateCastMemberRequest = CastMemberDetails.extend({
  revision: CastMember.shape.revision,
});

/** GET /api/productions/{productionId}/cast: the production's cast members. */
export const CastList = z.strictObject({
  productionId: ProductionId,
  members: z.array(CastMember).max(1000),
});

export type Section = z.infer<typeof Section>;
export type CastMember = z.infer<typeof CastMember>;
export type CastMemberDetails = z.infer<typeof CastMemberDetails>;
export type UpdateCastMemberRequest = z.infer<typeof UpdateCastMemberRequest>;
export type CastList = z.infer<typeof CastList>;
