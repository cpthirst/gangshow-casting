import { type CastMember, CastMemberDetails, type GridSection, type Section } from "@app/shared";

// Only one production for now (see docs/product/running-order/prd.md).
export const CAST_PATH = "/api/productions/2027/cast";

const sectionNames: Record<Section, GridSection> = {
  scouts: "Scouts",
  explorers: "Explorers",
  network: "Network",
};

export const sectionLabel = (section: Section | null): GridSection =>
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

/** The add/edit form's fields, as typed. A blank section means not set. */
export interface CastForm {
  firstName: string;
  lastName: string;
  section: Section | "";
  group: string;
  singing: string;
  acting: string;
}

export const castFormFor = (member?: CastMember): CastForm => ({
  firstName: member?.firstName ?? "",
  lastName: member?.lastName ?? "",
  section: member?.section ?? "",
  group: member?.group ?? "",
  singing: member?.singing ?? "",
  acting: member?.acting ?? "",
});

const messages: Record<keyof CastForm, { missing: string; tooLong: string }> = {
  firstName: {
    missing: "Enter a first name",
    tooLong: "Keep the first name to 40 characters or fewer",
  },
  lastName: {
    missing: "Enter a last name",
    tooLong: "Keep the last name to 40 characters or fewer",
  },
  section: { missing: "Choose a section", tooLong: "Choose a section" },
  group: { missing: "", tooLong: "Keep the group to 60 characters or fewer" },
  singing: { missing: "", tooLong: "Keep the singing note to 100 characters or fewer" },
  acting: { missing: "", tooLong: "Keep the acting note to 100 characters or fewer" },
};

const isFormField = (key: unknown): key is keyof CastForm =>
  typeof key === "string" && key in messages;

export type CastFormResult =
  | { ok: true; details: CastMemberDetails }
  | { ok: false; errors: Partial<Record<keyof CastForm, string>> };

/** The details the form describes, or a message for each field that needs fixing.
 *  Limits come from the shared schema, so the page and the API agree. */
export function detailsFrom(form: CastForm): CastFormResult {
  const parsed = CastMemberDetails.safeParse({
    ...form,
    section: form.section === "" ? null : form.section,
  });
  if (parsed.success) return { ok: true, details: parsed.data };

  const errors: Partial<Record<keyof CastForm, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (!isFormField(field)) continue;
    errors[field] = issue.code === "too_big" ? messages[field].tooLong : messages[field].missing;
  }
  return { ok: false, errors };
}

/** Members whose first or last name contains the text, ignoring case and accents, in
 *  surname order: the cast member search when casting a role. One box searches either
 *  name, so it can't reuse filterCast, whose separate name filters must both match. */
export function searchCast(members: CastMember[], text: string) {
  const query = plain(text);
  return sortCast(
    members.filter((m) => plain(m.firstName).includes(query) || plain(m.lastName).includes(query)),
  );
}

/** The delete confirmation. Deleting also takes them out of every role, so say how many;
 *  roleCount is undefined when the roles couldn't be counted. */
export const deleteWarning = (name: string, roleCount: number | undefined) =>
  `Delete ${name} from the cast?${rolesNote(roleCount)} This can't be undone.`;

function rolesNote(roleCount: number | undefined) {
  if (roleCount === undefined) return " They'll be removed from any roles they're in.";
  if (roleCount === 0) return "";
  return ` They'll be removed from ${roleCount} role${roleCount === 1 ? "" : "s"}.`;
}
