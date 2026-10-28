import { ProductionId } from "@app/shared";
import type { ApiEvent } from "./handler.ts";

/** The production the path's {productionId} names, or undefined if none could have that id:
 *  the id becomes part of a folder or key, so it's checked before any store sees it. */
export function productionIdOf(event: ApiEvent) {
  const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
  return productionId.success ? productionId.data : undefined;
}

/** A positive whole number from a path or query parameter (up to 9 digits, safely within a
 *  JS number), or undefined for anything else. */
export const wholeNumber = (text: string | undefined) =>
  text !== undefined && /^[1-9]\d{0,8}$/.test(text) ? Number(text) : undefined;
