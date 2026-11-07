import { type DepartmentId, departments, type Permission, permissions } from "@app/shared";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { icons } from "./icons.ts";

/** Each department's permission by the name the team knows it by (production-props FR7). */
export const PERMISSION_NAMES: Record<Permission, string> = {
  casting: "Casting",
  stage: "Stage",
  tech: "Tech",
  wardrobe: "Wardrobe",
  director: "Director",
};

/** Permissions in the order the Accounts page offers them, whatever order they were given in. */
export const inOrder = (access: readonly Permission[]) =>
  permissions.filter((permission) => access.includes(permission));

/** "A", "A and B", "A, B and C", or with "or" in place of "and". */
export const listed = (names: string[], conjunction: "and" | "or" = "and") =>
  names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} ${conjunction} ${names.at(-1)}`;

/** The names of a department's permissions, in the order the Accounts page lists them. */
export const permissionNamesOf = (id: DepartmentId) =>
  inOrder(departments[id].permissions).map((permission) => PERMISSION_NAMES[permission]);

/** Who may change a department, in the order the Accounts page lists permissions, then admins. */
const whoMayChange = (id: DepartmentId) => listed([...permissionNamesOf(id), "admins"]);

/** What a department's pages say to someone who may only view them. */
export const viewOnlyLine = (id: DepartmentId) => {
  const { noun, it } = departments[id];
  return `You can view the ${noun}, but not change ${it}: only ${whoMayChange(id)} can.`;
};

/** What a department's pages say when the API refuses a change as read-only (team-roles FR12). */
export const refusedLine = (id: DepartmentId) => {
  const { noun, it } = departments[id];
  return `You can view the ${noun} but not change ${it}, so this wasn't saved.`;
};

/** A Production department, whose page for one item the Overview's buttons open. */
export type ProductionDepartmentId = Exclude<DepartmentId, "casting">;

/** A department's page for one item, opened by its button on the Production overview. */
export interface DepartmentPage {
  id: ProductionDepartmentId;
  /** As the button's tooltip and the page's title say it. */
  name: string;
  /** Mid-sentence, as in "Edit mic plot for Opening Number". */
  noun: string;
  /** The item page's route name. */
  route: string;
  icon: IconDefinition;
}

/** The route name of a department's page for one item. */
export const itemRouteOf = (id: DepartmentId) => `${id}-item`;

/** The department's page, named as the shared list names it. */
const departmentPage = (id: ProductionDepartmentId, icon: IconDefinition): DepartmentPage => ({
  id,
  name: departments[id].name,
  noun: departments[id].noun,
  route: itemRouteOf(id),
  icon,
});

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
  departmentPage("scenery", icons.scenery),
  departmentPage("props", icons.props),
  departmentPage("sfx", icons.sfx),
  departmentPage("mic-plot", icons.micPlot),
  departmentPage("wardrobe", icons.wardrobe),
];
