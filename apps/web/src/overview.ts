import { type CastMember, Section } from "@app/shared";
import { sectionLabel, sortCast } from "./cast.ts";

/** One section of the Overview: its people, in display order. */
export interface OverviewSection {
  key: Section | "not-set";
  label: string;
  members: CastMember[];
}

// Scouts, Explorers, Network, then anyone with no section (casting-overview FR1).
const SECTION_ORDER = [...Section.options, null] as const;

/** The cast grouped by section, empty sections left out. Each section is in surname
 *  order (casting-overview.E2.S2 orders it by casting score instead). */
export function castBySection(members: CastMember[]): OverviewSection[] {
  return SECTION_ORDER.map(
    (section): OverviewSection => ({
      key: section ?? "not-set",
      label: sectionLabel(section),
      members: sortCast(members.filter((member) => member.section === section)),
    }),
  ).filter((group) => group.members.length > 0);
}

/** "3 people", "1 person". */
export const peopleCount = (count: number) => `${count} ${count === 1 ? "person" : "people"}`;
