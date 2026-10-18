import { z } from "zod";
import { CastMember } from "./cast.ts";

/** A role size as the grid shows it: Lead, Support, Cameo or Ensemble (casting-overview-grid FR7). */
export const GridRoleLetter = z.enum(["L", "S", "C", "E"]);
export type GridRoleLetter = z.infer<typeof GridRoleLetter>;

/** A section as the Overview labels it, including "Not set" for no section. */
export const GridSection = z.enum(["Scouts", "Explorers", "Network", "Not set"]);
export type GridSection = z.infer<typeof GridSection>;

/**
 * POST /api/productions/{productionId}/casting-grid/export (admins only, ADR 0019): the grid
 * as the page shows it, which the server turns into an Excel file. Strict, and nothing but
 * names, section, item headings and role letters fits, so no group, age band, note or role
 * name can reach the file (ADR 0010, ADR 0014). 200 returns the .xlsx file.
 */
export const CastingGridExportRequest = z
  .strictObject({
    /** One heading per item, in running order, such as "2.4 · Finale". */
    // A title is up to 120 characters; the half and number before it add a few more.
    items: z.array(z.string().trim().min(1).max(130)).max(200),
    rows: z
      .array(
        z.strictObject({
          firstName: CastMember.shape.firstName,
          lastName: CastMember.shape.lastName,
          /** As the Overview labels it. */
          section: GridSection,
          /** One per item: the person's biggest part in it, or null. */
          cells: z.array(GridRoleLetter.nullable()).max(200),
        }),
      )
      .max(1000),
  })
  .refine(({ items, rows }) => rows.every((row) => row.cells.length === items.length), {
    message: "Every row needs a cell for every item",
    path: ["rows"],
  });

export type CastingGridExportRequest = z.infer<typeof CastingGridExportRequest>;
