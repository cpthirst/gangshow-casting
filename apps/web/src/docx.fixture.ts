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

/** Each table row's set height in twentieths of a point (undefined where Word sizes it to
 *  fit), across every table in the document, top to bottom. */
export const rowHeights = (file: Uint8Array) =>
  [...documentXml(file).matchAll(/<w:tr(?:\s[^>]*)?>(.*?)<\/w:tr>/gs)].map(([, row = ""]) => {
    const height = /<w:trHeight [^>]*w:val="(\d+)"/.exec(row)?.[1];
    return height === undefined ? undefined : Number(height);
  });

/** The page's size and the height left for content once the top and bottom margins are
 *  taken off, in twentieths of a point, as the document's last section sets them. */
export function pageOf(file: Uint8Array) {
  const xml = documentXml(file);
  const number = (pattern: RegExp) => Number(pattern.exec(xml)?.[1] ?? Number.NaN);
  const width = number(/<w:pgSz [^>]*w:w="(\d+)"/);
  const height = number(/<w:pgSz [^>]*w:h="(\d+)"/);
  const top = number(/<w:pgMar [^>]*w:top="(\d+)"/);
  const bottom = number(/<w:pgMar [^>]*w:bottom="(\d+)"/);
  return { width, height, bodyHeight: height - top - bottom };
}

/** A paragraph style's font, size (in half-points) and spacing before and after (in
 *  twentieths of a point), as the document's styles define it; "defaults" reads the
 *  document's defaults, which every style starts from. */
export function styleOf(file: Uint8Array, styleId: string) {
  const xml = strFromU8(unzipSync(file)["word/styles.xml"] ?? new Uint8Array());
  const style =
    styleId === "defaults"
      ? /<w:docDefaults>(.*?)<\/w:docDefaults>/s.exec(xml)?.[1]
      : new RegExp(`<w:style [^>]*w:styleId="${styleId}"[^>]*>(.*?)</w:style>`, "s").exec(xml)?.[1];
  const number = (pattern: RegExp) => {
    const value = pattern.exec(style ?? "")?.[1];
    return value === undefined ? undefined : Number(value);
  };
  return {
    font: /<w:rFonts [^>]*w:ascii="([^"]+)"/.exec(style ?? "")?.[1],
    size: number(/<w:sz w:val="(\d+)"/),
    before: number(/<w:spacing [^>]*w:before="(\d+)"/),
    after: number(/<w:spacing [^>]*w:after="(\d+)"/),
  };
}
