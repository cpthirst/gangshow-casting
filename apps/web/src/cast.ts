import type { CastMember, Section } from "@app/shared";

const sectionNames: Record<Section, string> = {
  scouts: "Scouts",
  explorers: "Explorers",
  network: "Network",
};

export const sectionLabel = (section: Section | null) =>
  section === null ? "Not set" : sectionNames[section];

// The platform's locale-aware comparison: case and accents don't change the order.
const byName = new Intl.Collator("en-GB", { sensitivity: "base" });

/** Sorted by last name, then first name. */
export const sortCast = (members: CastMember[]) =>
  [...members].sort(
    (a, b) => byName.compare(a.lastName, b.lastName) || byName.compare(a.firstName, b.firstName),
  );

export const countLabel = (count: number) => `${count} cast member${count === 1 ? "" : "s"}`;

/** "56 cast members", or "12 of 56 cast members" while filtered. */
export const matchesLabel = (shown: number, total: number, filtered: boolean) =>
  filtered ? `${shown} of ${countLabel(total)}` : countLabel(total);

/** What the filters can be set to. "all" and "not-set" are section choices, not sections. */
export interface CastFilters {
  firstName: string;
  lastName: string;
  section: Section | "all" | "not-set";
}

export const NO_FILTERS: CastFilters = { firstName: "", lastName: "", section: "all" };

export const hasFilters = (filters: CastFilters) =>
  filters.firstName.trim() !== "" || filters.lastName.trim() !== "" || filters.section !== "all";

// Case- and accent-free text, so "zoe" finds "Zoë" (standard Unicode normalisation).
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-GB")
    .trim();

const sectionMatches = (choice: CastFilters["section"], section: Section | null) =>
  choice === "all" || (choice === "not-set" ? section === null : section === choice);

/** The members matching every filter that's set; names match any part, ignoring case and accents. */
export function filterCast(members: CastMember[], filters: CastFilters) {
  const first = plain(filters.firstName);
  const last = plain(filters.lastName);
  return members.filter(
    (m) =>
      plain(m.firstName).includes(first) &&
      plain(m.lastName).includes(last) &&
      sectionMatches(filters.section, m.section),
  );
}
