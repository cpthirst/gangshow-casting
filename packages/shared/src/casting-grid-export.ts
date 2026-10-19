import { z } from "zod";
import { CastMember } from "./cast.ts";

/** A role size as the grid shows it: Lead, Support, Cameo or Ensemble (casting-overview-grid FR7). */
export const GridRoleLetter = z.enum(["L", "S", "C", "E"]);
export type GridRoleLetter = z.infer<typeof GridRoleLetter>;

/**
 * The pale fill of each role letter's dot in the grid (web: styles.css, `.grid-dot-*`), so a
 * filled cell in the file looks like its dot on screen. A test in the web app checks the two
 * still agree. Dark text on each reads at over 4.5:1.
 */
export const gridLetterColours: Record<GridRoleLetter, string> = {
  L: "#fde2dc",
  S: "#fff6b8",
  C: "#dcecf8",
  E: "#f1f1f1",
};

/** The grid's dark text (web: styles.css, `--text`), on every fill in the file. */
export const gridTextColour = "#404040";

/** The grid's dark red, for the heading of an item that isn't in the printed programme. */
export const unprintedHeadingColour = "#b8301a";

/** A section as the Overview labels it, including "Not set" for no section. */
export const GridSection = z.enum(["Scouts", "Explorers", "Network", "Not set"]);
export type GridSection = z.infer<typeof GridSection>;

/**
 * POST /api/productions/{productionId}/casting-grid/export (every role, ADRs 0019 and 0021): the grid
 * as the page shows it, which the server turns into an Excel file. Strict, and nothing but
 * names, section, item headings and role letters fits, so no group, age band, note or role
 * name can reach the file (ADR 0010, ADR 0014). 200 returns the .xlsx file.
 */
export const CastingGridExportRequest = z
  .strictObject({
    /** One per item, in running order. */
    items: z
      .array(
        z.strictObject({
          // Such as "2.4 · Finale": a title is up to 120 characters, and the half and number
          // before it add a few more.
          heading: z.string().trim().min(1).max(130),
          /** False for an item left out of the printed programme, which the grid shows in red italics. */
          printed: z.boolean(),
        }),
      )
      .max(200),
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
