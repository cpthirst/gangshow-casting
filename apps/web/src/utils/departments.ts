import {
  type AnyOf,
  MIC_PLOT_PERMISSIONS,
  PROPS_PERMISSIONS,
  SCENERY_PERMISSIONS,
  SFX_PERMISSIONS,
  WARDROBE_PERMISSIONS,
} from "@app/shared";
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
  /**
   * Who may change it, any one of these: Scenery is Stage's and Tech's, Props Stage's, SFX
   * and Mic plot Tech's, and Wardrobe Wardrobe's, and a Director may change them all (ADR 0029).
   */
  permissions: AnyOf;
  icon: IconDefinition;
}

/** A department's count on the Overview (production-overview FR14): the number, the small
 *  word under it ("files"), and the one phrase screen readers hear ("9 scenery files"). */
export interface DepartmentCount {
  number: number;
  word: string;
  label: string;
}

/** A count in words, "file" for one and "files" otherwise, and the phrase read out for it. */
export function countInWords(
  number: number,
  one: string,
  many: string,
  label: (word: string) => string,
): DepartmentCount {
  const word = number === 1 ? one : many;
  return { number, word, label: label(word) };
}

/** An item's file count on the Overview: "9" over "files", read with the department's noun
 *  as "9 scenery files". */
export const filesCount = (files: number, noun: string) =>
  countInWords(files, "file", "files", (word) => `${files} ${noun} ${word}`);

// In the order the Overview's buttons show them (production-overview FR4, FR5).
export const departmentPages: DepartmentPage[] = [
  {
    name: "Scenery",
    noun: "scenery",
    route: "scenery-item",
    path: "scenery",
    permissions: SCENERY_PERMISSIONS,
    icon: icons.scenery,
  },
  {
    name: "Props",
    noun: "props",
    route: "props-item",
    path: "props",
    permissions: PROPS_PERMISSIONS,
    icon: icons.props,
  },
  {
    name: "SFX",
    noun: "SFX",
    route: "sfx-item",
    path: "sfx",
    permissions: SFX_PERMISSIONS,
    icon: icons.sfx,
  },
  {
    name: "Mic plot",
    noun: "mic plot",
    route: "mic-plot-item",
    path: "mic-plot",
    permissions: MIC_PLOT_PERMISSIONS,
    icon: icons.micPlot,
  },
  {
    name: "Wardrobe",
    noun: "wardrobe",
    route: "wardrobe-item",
    path: "wardrobe",
    permissions: WARDROBE_PERMISSIONS,
    icon: icons.wardrobe,
  },
];
