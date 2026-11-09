import { z } from "zod";

/** A production's id, which is its year: all it's named by (ADR 0036). */
export const ProductionYear = z.string().regex(/^\d{4}$/);

export const ProductionList = z.object({ productions: z.array(ProductionYear).nonempty() });
export type ProductionList = z.infer<typeof ProductionList>;

/** The production everyone opens: the highest year (ADR 0036). */
export const newestProduction = (productions: ProductionList["productions"]) =>
  productions.reduce((newest, year) => (year > newest ? year : newest));

/** POST /api/productions, naming the year. 201 → the updated ProductionList; 400 → startRefusal. */
export const NewProduction = z.strictObject({ year: z.string() });
export type NewProduction = z.infer<typeof NewProduction>;

/** Whether a year can be started: four digits, and later than the newest (ADR 0036, FR21). */
export const mayStartProduction = (year: string, productions: ProductionList["productions"]) =>
  ProductionYear.safeParse(year).success && year > newestProduction(productions);

/** What an admin is told when mayStartProduction says no. */
export const startRefusal = (productions: ProductionList["productions"]) =>
  `The year must be a four-digit year later than ${newestProduction(productions)}.`;
