import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { icons } from "./icons.ts";

// Who can use an action, said the same way on every page (in-app-help FR5). A Director may
// change every department's pages, but not the casting (production-scenery FR1).
const accessLabels = {
  everyone: "Everyone",
  casting: "Accounts with Casting, and admins",
  stage: "Accounts with Stage or Director, and admins",
  scenery: "Accounts with Stage, Tech or Director, and admins",
  tech: "Accounts with Tech or Director, and admins",
  wardrobe: "Accounts with Wardrobe or Director, and admins",
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
  /** Who can change it, for a line where reading and changing differ (an item's notes). */
  changeAccess?: Access;
}

export interface PageHelp {
  /** The page's route name, exactly as in the router: the Help page links to it by name. */
  page: string;
  title: string;
  /** A line about the page as a whole, before its actions. */
  summary: string;
  /** The page the Help page links to instead, for a page with no menu entry of its own. */
  reachedFrom?: { page: string; title: string };
  lines: HelpLine[];
}

// Written once, shown on the Help page and behind each page's help button (FR9). Keep each
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
  {
    page: "cast",
    title: "Cast",
    summary: "Everyone in this production's cast, with their section, group and casting notes.",
    lines: [
      {
        name: "Filter",
        does: "Type a first or last name, or pick a section, to show only the people who match.",
        access: "everyone",
      },
      {
        name: "Clear filters",
        does: "Shows the whole cast again.",
        access: "everyone",
      },
      {
        name: "Add cast member",
        does: "Adds someone to this production's cast.",
        access: "casting",
      },
      {
        icons: [icons.edit],
        name: "Edit",
        does: "Changes someone's name, section, group or casting notes.",
        access: "casting",
      },
      {
        icons: [icons.remove],
        name: "Delete",
        does: "Takes someone out of the cast.",
        access: "admins",
      },
    ],
  },
  {
    page: "casting-overview",
    title: "Overview",
    summary: "Everyone in the cast and how much they're cast, three ways.",
    lines: [
      {
        name: "By person",
        does: "Each person and their roles, with when they're on stage.",
        access: "everyone",
      },
      {
        name: "By item",
        does: "Each item's roles in show order, and who plays them.",
        access: "everyone",
      },
      {
        name: "Grid",
        does: "Everyone against every item, in one table.",
        access: "everyone",
      },
      {
        icons: [icons.exportFile],
        name: "Export to Excel",
        does: "On the Grid, saves the grid as an Excel file.",
        access: "everyone",
      },
      {
        icons: [icons.exportWord],
        name: "Export to Word",
        does: "On By person, saves casting sheets; on By item, an item overview.",
        access: "everyone",
      },
      {
        icons: [icons.error],
        name: "Clash",
        does: "Marks a clash, such as someone in back-to-back items. Point at it or tap it to read the clash.",
        access: "everyone",
      },
    ],
  },
  {
    page: "casting-items",
    title: "Items",
    summary: "The show's items in running order, with how far each one's casting has got.",
    lines: [
      {
        icons: [icons.cast],
        name: "Open an item",
        does: "Opens the item to cast it, or only to view it without the Casting permission.",
        access: "everyone",
      },
      {
        icons: [icons.error],
        name: "Clash",
        does: "Someone in the item has a clash. Point at it or tap it to read the clash.",
        access: "everyone",
      },
      {
        name: "Not in printed programme",
        does: "The item has no number in the printed programme.",
        access: "everyone",
      },
    ],
  },
  {
    page: "casting-item",
    title: "An item",
    summary: "One item's roles and notes. Open an item from Casting → Items.",
    reachedFrom: { page: "casting-items", title: "Items" },
    lines: [
      {
        icons: [icons.allItems],
        name: "All items",
        does: "Goes back to the list of items.",
        access: "everyone",
      },
      {
        icons: [icons.back, icons.forward],
        name: "Previous and Next",
        does: "Steps to the item before or after this one in the show.",
        access: "everyone",
      },
      {
        name: "Add role",
        does: "Adds a role to the item, with its size and who plays it.",
        access: "casting",
      },
      {
        icons: [icons.edit],
        name: "Edit",
        does: "Changes a role's name, size or who plays it.",
        access: "casting",
      },
      {
        icons: [icons.remove],
        name: "Remove",
        does: "Takes a role off the item.",
        access: "casting",
      },
      {
        name: "Notes",
        does: "Anything the team needs to know about the item.",
        access: "everyone",
        changeAccess: "casting",
      },
    ],
  },
  // Production's page. Each department's permission is what lets someone change its pages.
  {
    page: "production-overview",
    title: "Production overview",
    summary:
      "The show's items in running order, each with a button for every department's page for it, and how many props it needs.",
    // One line per button, in the row's order (production-overview FR4), standing in for an
    // icon legend on the page. Each line's labels say who can change its page.
    lines: [
      {
        icons: [icons.scenery],
        name: "Scenery",
        does: "Opens the item's scenery page, with the files for its sets.",
        access: "everyone",
        changeAccess: "scenery",
      },
      {
        icons: [icons.props],
        name: "Props",
        does: "Opens the item's props page, for its props, the roles that use them and its notes.",
        access: "everyone",
        changeAccess: "stage",
      },
      {
        icons: [icons.sfx],
        name: "SFX",
        does: "Opens the item's SFX page, for its sound effects. Coming soon.",
        access: "everyone",
        changeAccess: "tech",
      },
      {
        icons: [icons.micPlot],
        name: "Mic plot",
        does: "Opens the item's mic plot page, for who wears which microphone. Coming soon.",
        access: "everyone",
        changeAccess: "tech",
      },
      {
        icons: [icons.wardrobe],
        name: "Wardrobe",
        does: "Opens the item's wardrobe page, for what the cast wear. Coming soon.",
        access: "everyone",
        changeAccess: "wardrobe",
      },
      {
        icons: [icons.exportWord],
        name: "Generate Props List",
        does: "Saves every item's props, characters and cast as a Word document.",
        access: "everyone",
      },
    ],
  },
  {
    page: "scenery-item",
    title: "An item's scenery",
    summary:
      "One item's scenery files and notes. Open an item's scenery from Production → Overview.",
    reachedFrom: { page: "production-overview", title: "Production overview" },
    lines: [
      {
        icons: [icons.allItems],
        name: "All items",
        does: "Goes back to the Production overview.",
        access: "everyone",
      },
      {
        icons: [icons.back, icons.forward],
        name: "Previous and Next",
        does: "Steps to the item before or after this one in the show.",
        access: "everyone",
      },
      {
        icons: [
          icons.pdfFile,
          icons.wordFile,
          icons.excelFile,
          icons.powerPointFile,
          icons.imageFile,
          icons.file,
        ],
        name: "Files",
        does: "Opens a PDF, image or text file in a new tab. Any other file downloads. Each file's icon shows its type: PDF, Word, Excel, PowerPoint, image, or any other file.",
        access: "everyone",
      },
      {
        name: "Scenery notes",
        does: "Anything the stage and tech teams need to know about the item's sets.",
        access: "everyone",
        changeAccess: "scenery",
      },
    ],
  },
  {
    page: "props-item",
    title: "An item's props",
    summary: "One item's props and notes. Open an item's props from Production → Overview.",
    reachedFrom: { page: "production-overview", title: "Production overview" },
    lines: [
      {
        icons: [icons.allItems],
        name: "All items",
        does: "Goes back to the Production overview.",
        access: "everyone",
      },
      {
        icons: [icons.back, icons.forward],
        name: "Previous and Next",
        does: "Steps to the item before or after this one in the show.",
        access: "everyone",
      },
      {
        name: "Add prop",
        does: "Adds a prop by name, quantity and roles. When there are more people than the quantity, also choose who carries it.",
        access: "stage",
      },
      {
        icons: [icons.edit],
        name: "Edit",
        does: "Changes a prop's name, quantity, the roles that use it or who carries it.",
        access: "stage",
      },
      {
        icons: [icons.remove],
        name: "Remove",
        does: "Takes a prop off the item.",
        access: "stage",
      },
      {
        name: "Props notes",
        does: "Anything the props team needs to know about the item's props.",
        access: "everyone",
        changeAccess: "stage",
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
