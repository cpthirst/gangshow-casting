import type { CastMember } from "@app/shared";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { castingSheetsDocument } from "./casting-sheets-document.ts";
import { type Block, documentXml, readDocx } from "./docx.fixture.ts";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
let nextId = 1;
const member = (
  firstName: string,
  lastName: string,
  section: CastMember["section"],
  group = "",
): CastMember => ({
  id: nextId++,
  firstName,
  lastName,
  section,
  group,
  singing: "",
  acting: "",
  revision: 1,
});

const order = aRunningOrder([anItem("Opening")], [anItem("Finale")]);

async function sheetsOf(cast: CastMember[]) {
  const doc = castingSheetsDocument({ order, roles: [], cast });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** Each page's paragraphs, split where a paragraph starts a new page. */
const pages = (blocks: Block[]) =>
  blocks.reduce<string[][]>((all, block) => {
    if (block.kind !== "paragraph") return all;
    if (block.pageBreakBefore || all.length === 0) all.push([]);
    all.at(-1)?.push(`${block.style ?? "-"}: ${block.text}`);
    return all;
  }, []);

describe("the Casting Sheets document", () => {
  it("has a page for every cast member, whether or not they're in anything", async () => {
    const cast = [member("Ava", "Example", "scouts"), member("Cara", "Test", "scouts")];

    const sheets = pages(readDocx(await sheetsOf(cast)));

    expect(sheets.map((page) => page[1])).toEqual(["Heading2: Ava Example", "Heading2: Cara Test"]);
  });

  it("orders the pages by section, then surname, then first name", async () => {
    const cast = [
      member("Dan", "Evans", null),
      member("Sam", "Clark", "network"),
      member("Zoe", "Adams", "explorers"),
      member("Tom", "Brown", "scouts"),
      member("Amy", "Brown", "scouts"),
    ];

    const names = pages(readDocx(await sheetsOf(cast))).map((page) => page[1]);

    expect(names).toEqual([
      "Heading2: Amy Brown",
      "Heading2: Tom Brown",
      "Heading2: Zoe Adams",
      "Heading2: Sam Clark",
      "Heading2: Dan Evans",
    ]);
  });

  it("heads each page with the show, then the person, their section and their group", async () => {
    const sheets = pages(
      readDocx(await sheetsOf([member("Ava", "Example", "scouts", "1st Anytown")])),
    );

    expect(sheets[0]?.slice(0, 3)).toEqual([
      "Heading1: Gang Show 2027",
      "Heading2: Ava Example",
      "-: Scouts · 1st Anytown",
    ]);
  });

  it.each([
    ["no group", member("Sam", "Clark", "network"), "-: Network"],
    ["no section", member("Kit", "Person", null, "2nd Anytown"), "-: 2nd Anytown"],
  ])("leaves out what isn't set: %s", async (_case, person, details) => {
    const sheets = pages(readDocx(await sheetsOf([person])));

    expect(sheets[0]?.[2]).toBe(details);
  });

  it("shows only the name when neither section nor group is set", async () => {
    const sheets = pages(readDocx(await sheetsOf([member("Dan", "Evans", null)])));

    expect(sheets[0]).toEqual(["Heading1: Gang Show 2027", "Heading2: Dan Evans"]);
  });

  it("holds nothing about the cast beyond name, section and group", async () => {
    const noted = {
      ...member("Ava", "Example", "scouts"),
      singing: "Strong alto voice",
      acting: "Shy",
    };

    const xml = documentXml(await sheetsOf([noted]));

    expect(xml).not.toContain("Strong alto voice");
    expect(xml).not.toContain("Shy");
  });
});
