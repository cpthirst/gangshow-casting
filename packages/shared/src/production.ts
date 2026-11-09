import { z } from "zod";

/** A production's id, which is its year: all it's named by (ADR 0036). */
export const ProductionYear = z.string().regex(/^\d{4}$/);

export const ProductionList = z.object({
  productions: z.array(ProductionYear).nonempty(),
  /** Productions whose delete hasn't finished (ADR 0037), which nothing opens; left out if none. */
  deleting: z.array(ProductionYear).optional(),
});
export type ProductionList = z.infer<typeof ProductionList>;

/** The production everyone opens: the highest year (ADR 0036). */
export const newestProduction = (productions: ProductionList["productions"]) =>
  productions.reduce((newest, year) => (year > newest ? year : newest));

/** The years in the order they're offered: the newest first. */
export const newestFirst = (productions: readonly string[]) => productions.toSorted().reverse();

/**
 * Only the newest production can change: every other year, even one the list doesn't hold,
 * is view only for everyone (FR21). No flag says so, so nothing can reopen one (ADR 0036).
 */
export const mayChangeProduction = (year: string, productions: ProductionList["productions"]) =>
  year === newestProduction(productions);

/** A refused change to a past production, with the list, so a page left open can catch up. */
export const PastProductionRefusal = z.object({
  message: z.string(),
  productions: ProductionList.shape.productions,
});
export type PastProductionRefusal = z.infer<typeof PastProductionRefusal>;

/** What someone is told when they try to change a past production. */
export const PAST_PRODUCTION_REFUSAL = "You can view this past production, but not change it.";

/** The API's answer to any change to a production that isn't the newest. */
export const pastProductionRefusal = (
  productions: ProductionList["productions"],
): PastProductionRefusal => ({
  message: PAST_PRODUCTION_REFUSAL,
  productions,
});

/** POST /api/productions, naming the year. 201 → the updated ProductionList; 400 → startRefusal. */
export const NewProduction = z.strictObject({ year: z.string() });
export type NewProduction = z.infer<typeof NewProduction>;

/** Whether a year can be started: four digits, and later than the newest (ADR 0036, FR21). */
export const mayStartProduction = (year: string, productions: ProductionList["productions"]) =>
  ProductionYear.safeParse(year).success && year > newestProduction(productions);

/** What an admin is told when mayStartProduction says no. */
export const startRefusal = (productions: ProductionList["productions"]) =>
  `The year must be a four-digit year later than ${newestProduction(productions)}.`;

/**
 * How long copies of a deleted production can stay in backups: the table's point-in-time
 * recovery period, which the stack reads from here. The files bucket keeps none (ADR 0037).
 */
export const BACKUP_WINDOW_DAYS = 7;

/** Any production but the newest can be deleted, so the list never empties (ADR 0036, 0037). */
export const mayDeleteProduction = (year: string, productions: ProductionList["productions"]) =>
  year !== newestProduction(productions);

/** What an admin is told when mayDeleteProduction says no. */
export const NEWEST_PRODUCTION_REFUSAL = "The newest production can't be deleted.";
