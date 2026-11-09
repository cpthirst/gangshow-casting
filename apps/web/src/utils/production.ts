// The production the app shows, held here and nowhere else. The app opens the newest when it
// starts (useOpenProduction), and pages are only shown once it has (ADR 0036).
let open: string | undefined;

/** Where the API lists the productions. */
export const PRODUCTIONS_PATH = "/api/productions";

/** The open production's year, if one has been opened. */
export const openProductionYear = () => open;

/** Opens the production with this year, or (undefined) none. */
export function openProduction(year: string | undefined) {
  open = year;
}

/** Where the API keeps everything about the open production. */
export function productionPath() {
  if (open === undefined) throw new Error("No production is open");
  return `${PRODUCTIONS_PATH}/${open}`;
}
