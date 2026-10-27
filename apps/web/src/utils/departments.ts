import type { Permission } from "@app/shared";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { icons } from "./icons.ts";

/** A department's page for one item, opened by its button on the Production overview. */
export interface DepartmentPage {
  /** As the button's tooltip and the page's title say it. */
  name: string;
  /** Mid-sentence, as in "Edit mic plot for Opening Number". */
  noun: string;
  /** The item page's route name. */
  route: string;
  /** The last part of the item page's address, after /production/items/<item id>/. */
  path: string;
  /** Who may change it: Scenery and Props are Stage's, SFX and Mic plot Tech's. */
  permission: Permission;
  icon: IconDefinition;
}

// In the order the Overview's buttons show them (production-overview FR4, FR5).
export const departmentPages: DepartmentPage[] = [
  {
    name: "Scenery",
    noun: "scenery",
    route: "scenery-item",
    path: "scenery",
    permission: "stage",
    icon: icons.scenery,
  },
  {
    name: "Props",
    noun: "props",
    route: "props-item",
    path: "props",
    permission: "stage",
    icon: icons.props,
  },
  { name: "SFX", noun: "SFX", route: "sfx-item", path: "sfx", permission: "tech", icon: icons.sfx },
  {
    name: "Mic plot",
    noun: "mic plot",
    route: "mic-plot-item",
    path: "mic-plot",
    permission: "tech",
    icon: icons.micPlot,
  },
  {
    name: "Wardrobe",
    noun: "wardrobe",
    route: "wardrobe-item",
    path: "wardrobe",
    permission: "wardrobe",
    icon: icons.wardrobe,
  },
];

/** The departments whose item pages say "Coming soon" until their own feature fills them.
 *  Props already has its own (PropsItemPage); take each department out as its page arrives. */
export const comingSoonPages = departmentPages.filter((page) => page.route !== "props-item");
