import { z } from "zod";

/** A production's id, which is its year: all it's named by (ADR 0036). */
export const ProductionYear = z.string().regex(/^\d{4}$/);

export const ProductionList = z.object({ productions: z.array(ProductionYear).nonempty() });
export type ProductionList = z.infer<typeof ProductionList>;

/** The production everyone opens: the highest year (ADR 0036). */
export const newestProduction = (productions: ProductionList["productions"]) =>
  productions.reduce((newest, year) => (year > newest ? year : newest));
