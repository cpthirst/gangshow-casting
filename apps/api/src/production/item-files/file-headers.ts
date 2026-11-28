import { browserTypeOf, type DepartmentId } from "@app/shared";

// A plain-ASCII name for browsers that don't read filename*: anything else becomes "_".
const plainName = (name: string) => name.replace(/[^\x20-\x7e]|["\\%]/g, "_");

// RFC 8187's encoding, which encodeURIComponent nearly is: it leaves ' ( ) * as they are.
const encodedName = (name: string) =>
  encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** How a link to a file is to be followed: by default, to open it if the browser can. */
export interface LinkOptions {
  /** Saved rather than opened, as the image viewer's Download (production-image-gallery FR10). */
  download?: boolean;
}

/**
 * How a department's file is sent (production-scenery FR10): a PDF, image or text file, or an
 * audio file on SFX (production-sfx-wardrobe FR6), opens in the browser as its type, unless
 * asked for as a download, and anything else, HTML and SVG among them, downloads as bytes the
 * browser won't show. Either way under its stored name. The type comes from the name alone.
 */
export function fileHeadersOf(
  name: string,
  department: DepartmentId,
  { download = false }: LinkOptions = {},
) {
  const browserType = browserTypeOf(name, department);
  const how = browserType && !download ? "inline" : "attachment";
  return {
    contentType: browserType ?? "application/octet-stream",
    contentDisposition: `${how}; filename="${plainName(name)}"; filename*=UTF-8''${encodedName(name)}`,
  };
}
