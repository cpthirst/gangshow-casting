/** What a log may say about a store's error: its name only, as its message can quote stored
 *  casting (ADR 0010). */
export const errorName = (error: unknown) =>
  error instanceof Error ? error.name : "unknown error";
