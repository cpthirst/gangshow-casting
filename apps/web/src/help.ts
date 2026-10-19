import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { icons } from "./icons.ts";

// Who can use an action, said the same way on every page (in-app-help FR5).
const accessLabels = {
  everyone: "Everyone",
  casting: "Casting team and admins",
  admins: "Admins only",
} as const;

export type Access = keyof typeof accessLabels;

export const accessLabel = (access: Access) => accessLabels[access];

export interface HelpLine {
  /** The page's own icons for this action, if it has any. */
  icons?: IconDefinition[];
  /** The button or action, as the page names it. */
  name: string;
  does: string;
  access: Access;
}

export interface PageHelp {
  /** The page's route name, exactly as in router.ts: the Welcome page links to it by name. */
  page: string;
  title: string;
  /** A line about the page as a whole, before its actions. */
  summary: string;
  lines: HelpLine[];
}

// Written once, shown on the Welcome page and behind each page's help button (FR9). Keep each
// page to about 8 lines: one per action.
export const pageHelp: PageHelp[] = [
  {
    page: "running-order",
    title: "Running order",
    summary:
      "The show's items in the order they're performed. Changes stay on your screen until an admin saves them.",
    lines: [
      {
        name: "Read the order",
        does: "See when each item starts, who's in it and its minutes, with each half's total.",
        access: "everyone",
      },
      {
        icons: [icons.drag],
        name: "Drag",
        does: "Grab an item by its handle and move it to a new place.",
        access: "casting",
      },
      {
        icons: [icons.moveUp, icons.moveDown, icons.moveToOtherHalf],
        name: "Move",
        does: "Moves an item one place up or down, or to the other half.",
        access: "casting",
      },
      {
        icons: [icons.edit],
        name: "Edit",
        does: "Changes an item's details, such as its title, minutes or stage.",
        access: "casting",
      },
      {
        icons: [icons.remove],
        name: "Remove",
        does: "Takes an item out of the running order.",
        access: "admins",
      },
      {
        name: "Add item",
        does: "Adds a new item to that half.",
        access: "admins",
      },
      {
        name: "Save as Draft",
        does: "Saves the changes as the next draft, for everyone to see.",
        access: "admins",
      },
      {
        name: "Reset",
        does: "Throws away the changes you haven't saved.",
        access: "casting",
      },
    ],
  },
];

/** The named page's help. A page without any is a mistake in the code, so it fails loudly. */
export function helpFor(page: string): PageHelp {
  const help = pageHelp.find((candidate) => candidate.page === page);
  if (!help) throw new Error(`No help written for the page "${page}"`);
  return help;
}
