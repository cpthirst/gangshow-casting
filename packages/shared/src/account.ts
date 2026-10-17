import { z } from "zod";

/** The name an admin chooses for a team member's account: the only data held about them (ADR 0018). */
export const Username = z
  .string()
  .regex(
    /^[A-Za-z0-9._-]{1,32}$/,
    "A username is 1–32 letters, digits, dots, hyphens or underscores.",
  );

export type Username = z.infer<typeof Username>;
