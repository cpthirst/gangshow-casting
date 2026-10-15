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
