import { strFromU8, unzipSync } from "fflate";

/** One run of text in a paragraph, with the formatting a test cares about. */
export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  /** "B8301A", as Word stores it; undefined for the default colour. */
  color: string | undefined;
}

export type Block =
  | {
      kind: "paragraph";
      style: string | undefined;
      text: string;
      runs: Run[];
      pageBreakBefore: boolean;
    }
  | { kind: "table"; rows: { header: boolean; cells: string[] }[] };

const textOf = (xml: string) =>
  [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
    .map((match) => unescapeXml(match[1] ?? ""))
    .join("");

const runsOf = (xml: string): Run[] =>
  [...xml.matchAll(/<w:r>(.*?)<\/w:r>/gs)].map(([, run = ""]) => ({
    text: textOf(run),
    bold: /<w:b\/>|<w:b w:val="true"\/>/.test(run),
    italic: /<w:i\/>|<w:i w:val="true"\/>/.test(run),
    color: /<w:color w:val="([0-9A-Fa-f]{6})"\/>/.exec(run)?.[1]?.toUpperCase(),
  }));

/** The body of a .docx, top to bottom, as paragraphs and tables: enough to check what a
 *  document says, and how, without opening Word. Empty paragraphs are left out. */
export function readDocx(file: Uint8Array): Block[] {
  const xml = documentXml(file);
  const blocks: Block[] = [];
  for (const [element] of xml.matchAll(/<w:tbl>.*?<\/w:tbl>|<w:p(?:\s[^>]*)?>.*?<\/w:p>/gs)) {
    if (element.startsWith("<w:tbl>")) {
      const rows = [...element.matchAll(/<w:tr(?:\s[^>]*)?>(.*?)<\/w:tr>/gs)].map(
        ([, row = ""]) => ({
          header: row.includes("<w:tblHeader"),
          cells: [...row.matchAll(/<w:tc>(.*?)<\/w:tc>/gs)].map(([, cell = ""]) => textOf(cell)),
        }),
      );
      blocks.push({ kind: "table", rows });
      continue;
    }
    const text = textOf(element);
    const pageBreakBefore =
      element.includes("<w:pageBreakBefore") || element.includes('w:type="page"');
    if (text === "" && !pageBreakBefore) continue;
    blocks.push({
      kind: "paragraph",
      style: /<w:pStyle w:val="([^"]+)"\/>/.exec(element)?.[1],
      text,
      runs: runsOf(element),
      pageBreakBefore,
    });
  }
  return blocks;
}

/** The document's raw XML, to check what is not in it. */
export const documentXml = (file: Uint8Array) =>
  strFromU8(unzipSync(file)["word/document.xml"] ?? new Uint8Array());

/** The text of every paragraph, with its style: the document's outline at a glance. */
export const outline = (blocks: Block[]) =>
  blocks.flatMap((block) =>
    block.kind === "paragraph" ? [`${block.style ?? "-"}: ${block.text}`] : [],
  );

const unescapeXml = (text: string) =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
