import { browserTypeOf } from "@app/shared";

// A plain-ASCII name for browsers that don't read filename*: anything else becomes "_".
const plainName = (name: string) => name.replace(/[^\x20-\x7e]|["\\%]/g, "_");

// RFC 8187's encoding, which encodeURIComponent nearly is: it leaves ' ( ) * as they are.
const encodedName = (name: string) =>
  encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * How a scenery file is sent (production-scenery FR10): a PDF, image or text file opens in the
 * browser as its type, and anything else, HTML and SVG among them, downloads as bytes the
 * browser won't show. Either way under its stored name. The type comes from the name alone.
 */
export function fileHeadersOf(name: string) {
  const browserType = browserTypeOf(name);
  const how = browserType ? "inline" : "attachment";
  return {
    contentType: browserType ?? "application/octet-stream",
    contentDisposition: `${how}; filename="${plainName(name)}"; filename*=UTF-8''${encodedName(name)}`,
  };
}
