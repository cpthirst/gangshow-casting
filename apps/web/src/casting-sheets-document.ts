import type { CastMember } from "@app/shared";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { sectionLabel } from "./cast.ts";
import type { LatestShow } from "./latest-show.ts";
import { castBySection } from "./overview.ts";

// A casting sheet for every cast member, to print and hand out (casting-overview-by-item
// FR9–FR11): one page each, headed with the show and who it's for. Only their name, section
// and group: a sheet handed to a young person shows nobody else's details (ADR 0022).

/** "Scouts · 1st Anytown", leaving out whatever isn't set: never the screen's "Not set" on
 *  a sheet handed to a young person. */
const detailsOf = ({ section, group }: CastMember) =>
  [section === null ? "" : sectionLabel(section), group].filter((part) => part !== "").join(" · ");

const sheetOf = (title: string, member: CastMember, first: boolean) => {
  const details = detailsOf(member);
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: !first,
      children: [new TextRun({ text: title })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: `${member.firstName} ${member.lastName}` })],
    }),
    ...(details === "" ? [] : [new Paragraph({ children: [new TextRun({ text: details })] })]),
  ];
};

/** The Casting Sheets: a page per cast member, by section, then surname, then first name. */
export function castingSheetsDocument({ order, cast }: LatestShow) {
  const members = castBySection(cast).flatMap((section) => section.members);
  return new Document({
    title: `${order.title} casting sheets`,
    sections: [
      {
        children: members.flatMap((member, i) => sheetOf(order.title, member, i === 0)),
      },
    ],
  });
}

/** The Casting Sheets as a .docx file. */
export const castingSheetsFile = (show: LatestShow) => Packer.toBlob(castingSheetsDocument(show));
