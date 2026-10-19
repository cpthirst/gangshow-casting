import type { CastMember } from "@app/shared";
import { type Document, Packer } from "docx";
import { describe, expect, it } from "vitest";
import { castingSheetsDocument } from "./casting-sheets-document.ts";
import { styleOf } from "./docx.fixture.ts";
import { itemOverviewDocument } from "./item-overview-document.ts";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";

// Both Word exports look like a Word document made today: Word's default font, Aptos, and
// headings spaced more the higher they are.

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const ava: CastMember = {
  id: 1,
  firstName: "Ava",
  lastName: "Example",
  section: "scouts",
  group: "",
  singing: "",
  acting: "",
  revision: 1,
};
const order = aRunningOrder([anItem("Opening")]);

const documents: [string, () => Document][] = [
  [
    "the Item Overview",
    () =>
      itemOverviewDocument("Gang Show 2027", [
        {
          id: "first-half",
          name: "First half",
          items: [{ itemId: "opening", title: "Opening", number: 1, roles: [] }],
        },
      ]),
  ],
  ["the Casting Sheets", () => castingSheetsDocument({ order, roles: [], cast: [ava] })],
];

const fileOf = async (make: () => Document) => new Uint8Array(await Packer.toBuffer(make()));

describe.each(documents)("%s", (_name, make) => {
  it("sets its text in Aptos, Word's default font", async () => {
    const file = await fileOf(make);

    expect(styleOf(file, "defaults").font).toBe("Aptos");
    for (const heading of ["Heading1", "Heading2", "Heading3"]) {
      expect(styleOf(file, heading).font).toBe("Aptos");
    }
  });

  it("spaces Heading 1 more than Heading 2, Heading 2 more than Heading 3, and Heading 3 more than normal text", async () => {
    const file = await fileOf(make);

    const [h1, h2, h3, normal] = ["Heading1", "Heading2", "Heading3", "defaults"].map((id) =>
      styleOf(file, id),
    );
    const gap = (style: ReturnType<typeof styleOf> | undefined) =>
      (style?.before ?? 0) + (style?.after ?? 0);
    expect(gap(h1)).toBeGreaterThan(gap(h2));
    expect(gap(h2)).toBeGreaterThan(gap(h3));
    expect(gap(h3)).toBeGreaterThan(gap(normal));
    expect(gap(normal)).toBeGreaterThan(0);
  });

  it("sizes Heading 1 largest, then Heading 2, then Heading 3, then normal text", async () => {
    const file = await fileOf(make);

    const sizes = ["Heading1", "Heading2", "Heading3", "defaults"].map(
      (id) => styleOf(file, id).size ?? 0,
    );
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(4);
  });
});
