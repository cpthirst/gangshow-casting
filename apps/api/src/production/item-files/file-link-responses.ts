import { type ItemFile, ItemFileLinkQuery, isGalleryImage } from "@app/shared";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, uncached } from "#/http/json.ts";
import type { LinkOptions } from "./file-headers.ts";

// The answers that give short-lived links to files, an item's or a store's (ADR 0030,
// ADR 0042, ADR 0043). Anyone holding a link can use it for a while, so none is kept.

/** Links to each image among the files, from one request. */
export async function imageLinksResponse(
  files: ItemFile[],
  linkTo: (name: string) => Promise<string | undefined>,
) {
  const images = files.filter(({ name }) => isGalleryImage(name));
  const linked = await Promise.all(
    images.map(async ({ name }) => {
      // Gone since the list, if deleted meanwhile: left out, as the next list will be.
      const url = await linkTo(name);
      return url === undefined ? [] : [{ name, url }];
    }),
  );
  return uncached(jsonResponse(200, { links: linked.flat() }));
}

/** A link to the file the query names: 400 for a name no file could have, 404 if it isn't
 *  there, or if `keeps` says it isn't a file kept here. */
export async function fileLinkResponse(
  event: ApiEvent,
  linkTo: (name: string, options: LinkOptions) => Promise<string | undefined>,
  keeps: (name: string) => boolean = () => true,
) {
  const query = ItemFileLinkQuery.safeParse(event.queryStringParameters ?? {});
  if (!query.success) return { statusCode: 400 };
  const { name, download } = query.data;
  if (!keeps(name)) return { statusCode: 404 };
  const url = await linkTo(name, { download: download === "true" });
  if (url === undefined) return { statusCode: 404 };
  return uncached(jsonResponse(200, { url }));
}
