import { z } from "zod";
import { itemGangLabels, ProductionId } from "./running-order.ts";

/** Every section, youngest first: the order the filter, the form and the Overview use. */
export const Section = z.enum(["beavers", "cubs", "scouts", "explorers", "network"]);
export type Section = z.infer<typeof Section>;

/**
 * Each section's label. With Section, the one list the cast form, the filter, the Overview
 * and both exports read (ADR 0010, junior-cast FR9).
 */
export const sectionLabels = {
  beavers: "Beavers",
  cubs: "Cubs",
  scouts: "Scouts",
  explorers: "Explorers",
  network: "Network",
} as const satisfies Record<Section, string>;

/** The two gangs, Junior first, as the Cast page's gang filter lists them (junior-cast FR1). */
export const Gang = z.enum(["junior", "senior"]);
export type Gang = z.infer<typeof Gang>;

export const gangLabels = {
  junior: itemGangLabels.junior,
  senior: itemGangLabels.senior,
} as const satisfies Record<Gang, string>;

const juniorSections: readonly Section[] = ["beavers", "cubs"];

/** Which gang a member is in: Beavers and Cubs are Junior; everyone else, with or without a
 *  section, is Senior. The one rule every page reads (junior-cast FR9). */
export const gangOf = (section: Section | null): Gang =>
  section !== null && juniorSections.includes(section) ? "junior" : "senior";

/** A short free-text note on how someone sings or acts (ADR 0014); absent when not given. */
const SkillNote = z.string().trim().max(100).optional();

/**
 * A cast member: only the fields ADR 0010 and ADR 0014 allow. Strict, so any other personal
 * data (a date of birth, contact details…) is rejected rather than silently stored.
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
  /** Casting notes, never health or contact details (ADR 0014). */
  singing: SkillNote,
  acting: SkillNote,
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
  singing: true,
  acting: true,
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

export type CastMember = z.infer<typeof CastMember>;
export type CastMemberDetails = z.infer<typeof CastMemberDetails>;
export type UpdateCastMemberRequest = z.infer<typeof UpdateCastMemberRequest>;
export type CastList = z.infer<typeof CastList>;
