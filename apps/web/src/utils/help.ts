import {
  BACKUP_WINDOW_DAYS,
  type DepartmentId,
  departments,
  type Gang,
  gangOf,
  Section,
  sectionLabels,
} from "@app/shared";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { departmentPages, listed, permissionNamesOf, whoCanChangeLine } from "./departments.ts";
import { icons } from "./icons.ts";
import {
  type FilesDepartment,
  sceneryDepartment,
  sfxDepartment,
  wardrobeDepartment,
} from "./item-files.ts";

// Who can use an action, said the same way on every page (in-app-help FR5): everyone, admins
// alone, or whoever the shared list says may change a department's pages.
export type Access = "everyone" | "admins" | DepartmentId;

export function accessLabel(access: Access) {
  if (access === "everyone") return "Everyone";
  if (access === "admins") return "Admins only";
  return `Accounts with ${listed(permissionNamesOf(access), "or")}, and admins`;
}

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
  /** Who can change the page, a department or admins alone; everyone else only views it. */
  changedBy?: Exclude<Access, "everyone">;
  /** The page is about every production, so a past one being open doesn't make it view only. */
  acrossProductions?: true;
  /** The page the Help page links to instead, for a page with no menu entry of its own. */
  reachedFrom?: { page: string; title: string };
  lines: HelpLine[];
}

// The sections in a gang, read from the shared rule so Help can't disagree with the filter.
// The Senior gang also takes anyone with no section.
const gangSections = (gang: Gang) => {
  const labels = Section.options.filter((s) => gangOf(s) === gang).map((s) => sectionLabels[s]);
  return gangOf(null) === gang ? listed([...labels, "no section"], "or") : listed(labels);
};

const productionOverview = { page: "production-overview", title: "Production overview" };

/** The way around every item page: back to its list, and on through the show. */
const itemNavigationLines = (backTo: string): HelpLine[] => [
  {
    icons: [icons.allItems],
    name: "All items",
    does: `Goes back to ${backTo}.`,
    access: "everyone",
  },
  {
    icons: [icons.back, icons.forward],
    name: "Previous and Next",
    does: "Steps to the item before or after this one in the show.",
    access: "everyone",
  },
];

/** A Production department's item page's way around: the show, and the other departments. */
const productionItemNavigationLines: HelpLine[] = [
  ...itemNavigationLines("the Production overview"),
  {
    icons: departmentPages.map(({ icon }) => icon),
    name: "Departments",
    does: "Opens another department's page for this item.",
    access: "everyone",
  },
];

const DOCUMENT_ICONS = [
  icons.pdfFile,
  icons.wordFile,
  icons.excelFile,
  icons.powerPointFile,
  icons.imageFile,
  icons.file,
];

const OPENS_DOCUMENTS =
  "Opens a PDF, image or text file in a new tab. Any other file downloads. Each file's icon shows its type: PDF, Word, Excel, PowerPoint, image, or any other file.";

/** The help for a department whose item page keeps files and notes, all laid out alike. */
function fileDepartmentHelp(
  { key, uploadRule }: FilesDepartment,
  {
    summaryName,
    filesIcons = DOCUMENT_ICONS,
    filesDo = OPENS_DOCUMENTS,
    notesAreFor,
  }: {
    /** As the summary says the department's name. */
    summaryName: string;
    filesIcons?: IconDefinition[];
    filesDo?: string;
    /** Finishes "Anything …". */
    notesAreFor: string;
  },
): PageHelp {
  const { name, noun } = departments[key];
  const addAFile =
    "Adds one file of up to 100 MB to the item, chosen with the button or dragged onto it, showing how much has uploaded. A file with the same name as one already there replaces it, once you confirm. The old copy can't be brought back.";
  return {
    page: `${key}-item`,
    changedBy: key,
    title: `An item's ${noun}`,
    summary: `One item's ${summaryName} files and notes. Open an item's ${summaryName} from Production → Overview.`,
    reachedFrom: productionOverview,
    lines: [
      ...productionItemNavigationLines,
      { icons: filesIcons, name: "Files", does: filesDo, access: "everyone" },
      {
        icons: [icons.remove],
        name: "Remove",
        does: "Takes a file off the item, once you confirm. It can't be brought back.",
        access: key,
      },
      {
        name: "Add a file",
        does: uploadRule ? `${addAFile} ${uploadRule}` : addAFile,
        access: key,
      },
      {
        name: `${name} notes`,
        does: `Anything ${notesAreFor}.`,
        access: "everyone",
        changeAccess: key,
      },
    ],
  };
}

// Written once, shown on the Help page and behind each page's help button (FR9). Keep each
// page to about 8 lines: one per action.
export const pageHelp: PageHelp[] = [
  {
    page: "running-order",
    changedBy: "admins",
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
        access: "admins",
      },
      {
        icons: [icons.moveUp, icons.moveDown, icons.moveToOtherHalf],
        name: "Move",
        does: "Moves an item one place up or down, or to the other half.",
        access: "admins",
      },
      {
        icons: [icons.edit],
        name: "Edit",
        does: "Changes an item's details, such as its title, minutes, stage or gang. Saving an item for a different gang takes anyone not in that gang out of its roles, and asks you first.",
        access: "admins",
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
        access: "admins",
      },
    ],
  },
  {
    page: "cast",
    changedBy: "casting",
    title: "Cast",
    summary: "Everyone in this production's cast, with their section, group and casting notes.",
    lines: [
      {
        name: "Filter",
        does: "Type a first or last name, or pick a section, to show only the people who match.",
        access: "everyone",
      },
      {
        name: "Gang",
        does: `Pick Junior (${gangSections("junior")}) or Senior (${gangSections("senior")}) to show only that gang.`,
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
        does: "Changes someone's name, section, group or casting notes. Moving them to the other gang asks first, then takes them out of roles in items not for it.",
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
    changedBy: "casting",
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
    changedBy: "casting",
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
    changedBy: "casting",
    title: "An item",
    summary: "One item's roles and notes. Open an item from Casting → Items.",
    reachedFrom: { page: "casting-items", title: "Items" },
    lines: [
      ...itemNavigationLines("the list of items"),
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
        name: "Cast member",
        does: `Searches the cast by name, offering only the item's gang: for a Junior item, ${gangSections("junior")}; for a Senior item, ${gangSections("senior")}; for an item for both gangs, everyone.`,
        access: "casting",
      },
      {
        name: "Casting notes",
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
      "The show's items in running order, each with a button for every department's page for it, and a count of what that department has for it.",
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
        changeAccess: "props",
      },
      {
        icons: [icons.sfx],
        name: "SFX",
        does: "Opens the item's SFX page, with the files for its sound effects.",
        access: "everyone",
        changeAccess: "sfx",
      },
      {
        icons: [icons.micPlot],
        name: "Mic plot",
        does: "Opens the item's mic plot page, for who wears which microphone and its notes.",
        access: "everyone",
        changeAccess: "mic-plot",
      },
      {
        icons: [icons.wardrobe],
        name: "Wardrobe",
        does: "Opens the item's wardrobe page, with the files for what the cast wear.",
        access: "everyone",
        changeAccess: "wardrobe",
      },
      {
        icons: [icons.exportWord],
        name: "Generate Props List",
        does: "Saves every item's props, characters and cast as a Word document.",
        access: "everyone",
      },
      {
        icons: [icons.exportFile],
        name: "Generate Mic Plot",
        does: "Saves every item's mics, with who wears each, their roles and the item's Mic plot notes, as an Excel file. It holds under-18s' names, so it is for the production team only.",
        access: "everyone",
      },
    ],
  },
  fileDepartmentHelp(sceneryDepartment, {
    summaryName: "scenery",
    notesAreFor: "the stage and tech teams need to know about the item's sets",
  }),
  {
    page: "props-item",
    changedBy: "props",
    title: "An item's props",
    summary: "One item's props and notes. Open an item's props from Production → Overview.",
    reachedFrom: productionOverview,
    lines: [
      ...productionItemNavigationLines,
      {
        name: "Add prop",
        does: "Adds a prop by name, quantity and roles. When there are more people than the quantity, also choose who carries it.",
        access: "props",
      },
      {
        icons: [icons.edit],
        name: "Edit",
        does: "Changes a prop's name, quantity, the roles that use it or who carries it.",
        access: "props",
      },
      {
        icons: [icons.remove],
        name: "Remove",
        does: "Takes a prop off the item.",
        access: "props",
      },
      {
        name: "Props notes",
        does: "Anything the props team needs to know about the item's props.",
        access: "everyone",
        changeAccess: "props",
      },
    ],
  },
  fileDepartmentHelp(sfxDepartment, {
    summaryName: "SFX",
    filesIcons: [icons.audioFile, ...DOCUMENT_ICONS],
    filesDo:
      "Plays an MP3, WAV, M4A, AAC or OGG file in a new tab, and opens a PDF, image or text file there too. Any other file downloads. Each file's icon shows its type: audio, PDF, Word, Excel, PowerPoint, image, or any other file.",
    notesAreFor: "the tech team needs to know about the item's sound effects",
  }),
  {
    page: "mic-plot-item",
    changedBy: "mic-plot",
    title: "An item's mic plot",
    summary:
      "One item's mics and Mic plot notes. Open an item's mic plot from Production → Overview.",
    reachedFrom: productionOverview,
    lines: [
      ...productionItemNavigationLines,
      {
        name: "Mic 1 to Mic 24",
        does: "All 24 mics, in order, used or not. Type a name to give a mic to only someone cast in the item, one mic each. The roles they play in it show under them, from the casting: you don't choose them. Someone without a named part shows their ensemble. It saves straight away.",
        access: "everyone",
        changeAccess: "mic-plot",
      },
      {
        name: "Used in previous item",
        does: "A mic someone else had in the item just before is greyed out. The person who had it can keep it. It resets at the interval: the first item of each half can use any mic.",
        access: "everyone",
      },
      {
        icons: [icons.error],
        name: "Error",
        does: 'A mic given out before the running order changed, which now breaks the "Used in previous item" rule, stays, flagged as an Error, until it\'s cleared. It can only be cleared.',
        access: "everyone",
      },
      {
        icons: [icons.remove],
        name: "Clear",
        does: "Frees the mic, so no one wears it in the item.",
        access: "mic-plot",
      },
      {
        name: "Mic plot notes",
        does: "Anything the tech team needs to know about the item's mics, such as which are on only for songs.",
        access: "everyone",
        changeAccess: "mic-plot",
      },
    ],
  },
  fileDepartmentHelp(wardrobeDepartment, {
    summaryName: "Wardrobe",
    notesAreFor: "the wardrobe team needs to know about what the cast wear in the item",
  }),
  {
    page: "productions",
    changedBy: "admins",
    acrossProductions: true,
    title: "Productions",
    summary:
      "Every production, by its year. Everyone starts on the newest and can look back at older ones.",
    lines: [
      {
        name: "Switch production",
        does: "Choose an older year under the year in the menu to look back at it, then Open. A past production is view only for everyone, admins too, and can't be made changeable again; its exports still work. The next time you open the app, you're back on the newest.",
        access: "everyone",
      },
      {
        name: "Add production",
        does: "Starts a new production for a four-digit year later than the newest. It starts empty: nothing carries over from earlier years. Everyone opens it from their next page load.",
        access: "admins",
      },
      {
        name: "Delete production",
        does: `Deletes a past production for good: its cast, running orders, casting, props, files, mics and notes. It asks first, and can't be undone, though copies stay in backups for up to ${BACKUP_WINDOW_DAYS} days. The newest can't be deleted, and nobody's account changes. If a delete stops part way, the production shows as Not finished and can't be opened: delete it again to finish.`,
        access: "admins",
      },
    ],
  },
];

/** What each permission lets someone change, for the Help page's Permissions section. */
export const permissionHelp = [
  {
    name: "Casting",
    does: "Changes the cast, and the roles and who plays them.",
  },
  { name: "Stage", does: "Changes the Scenery and Props pages." },
  {
    name: "Tech",
    does: "Changes the Scenery, SFX and Mic plot pages.",
  },
  { name: "Wardrobe", does: "Changes what the cast wear in each item: its files and notes." },
  {
    name: "Director",
    does: "Changes every production department's pages, now and as they come: Scenery, Props, SFX, Mic plot and Wardrobe today. Not the cast, roles, casting or running order, and nothing only admins can do.",
  },
  {
    name: "Admins",
    does: "Change everything in the newest production. Only admins can delete cast members, change the running order, start and delete productions and manage accounts.",
  },
];

/** Who can change the page, for a page a department or admins alone own (simplify FR13). */
export function whoCanChange({ changedBy, title }: PageHelp) {
  if (changedBy === undefined) return undefined;
  return changedBy === "admins"
    ? `Only admins can change the ${title.toLowerCase()}.`
    : whoCanChangeLine(changedBy);
}

/** The named page's help. A page without any is a mistake in the code, so it fails loudly. */
export function helpFor(page: string): PageHelp {
  const help = pageHelp.find((candidate) => candidate.page === page);
  if (!help) throw new Error(`No help written for the page "${page}"`);
  return help;
}
