import type { Refusal } from "./cast-store.ts";

/** HTTP status for a refused change to one cast member. */
export const refusalStatus: Record<Refusal, number> = { stale: 409, "not-found": 404 };

/** A positive whole number from a path or query parameter (up to 9 digits, safely within a
 *  JS number), or undefined for anything else. */
export const wholeNumber = (text: string | undefined) =>
  text !== undefined && /^[1-9]\d{0,8}$/.test(text) ? Number(text) : undefined;
