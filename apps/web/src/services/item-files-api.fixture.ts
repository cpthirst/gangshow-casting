import type { CastMember, Costume, FileDepartment, ItemFile, ItemNote, Role } from "@app/shared";
import { ItemFileUploadRequest, isGalleryImage, SaveItemNoteRequest } from "@app/shared";
import type { VueWrapper } from "@vue/test-utils";
import { vi } from "vitest";
import { json } from "@/app.fixture.ts";
import { StandInXhr } from "@/services/file-upload.fixture.ts";
import {
  castPath,
  costumesPath,
  rolesPath,
  runningOrderPath,
  saveCostumePath,
} from "@/services/production.ts";
import { costumeSavedFrom } from "@/utils/costumes.fixture.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";

// A stand-in API for the Scenery, SFX and Wardrobe pages' tests, which share one component
// (ItemFiles.vue) and so one fake: the running order, each department's files, notes,
// casting and costumes.

export const show = aRunningOrder(
  [anItem("Opening Number"), anItem("Campfire Song")],
  [anItem("Finale")],
);

export const linkTo = (name: string) => `https://files.example/${encodeURIComponent(name)}?signed`;
export const downloadLinkTo = (name: string) => `${linkTo(name)}&download`;
/** Where the stand-in file storage takes uploads, apart from the API, as the bucket is. */
export const STORAGE = "https://files.example/";

/** Each department's files, by item id, as file storage holds them now. */
export type Held = Partial<Record<FileDepartment, Record<string, ItemFile[]>>>;

/** The casting the Wardrobe page reads its costume rows from: every role, and the cast list. */
export interface Casting {
  roles: Role[];
  cast: CastMember[];
}

export const NOBODY_CAST: Casting = { roles: [], cast: [] };

/** A stand-in API holding the running order, each department's files, changed by uploads
 *  and deletes, any notes, the casting, and the costumes, changed by saves. */
export function apiHolds(
  held: Held = {},
  notes: ItemNote[] = [],
  casting = NOBODY_CAST,
  costumes: Costume[] = [],
) {
  const filesOf = (department: FileDepartment, itemId: string) => {
    const byItem = held[department] ?? {};
    held[department] = byItem;
    const files = byItem[itemId] ?? [];
    byItem[itemId] = files;
    return files;
  };
  vi.stubGlobal("XMLHttpRequest", StandInXhr);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === runningOrderPath()) return json(show);
      if (url === rolesPath()) return json({ productionId: "2027", roles: casting.roles });
      if (url === castPath()) return json({ productionId: "2027", members: casting.cast });
      if (url === costumesPath()) return json({ productionId: "2027", costumes });
      if (url === saveCostumePath("opening-number") && init?.method === "PUT") {
        const saved = costumeSavedFrom("opening-number", init.body);
        const others = costumes.filter(
          (c) => c.roleId !== saved.roleId || c.castMemberId !== saved.castMemberId,
        );
        costumes.splice(0, costumes.length, ...others, saved);
        return json(saved);
      }
      if (/^\/api\/productions\/2027\/(scenery|sfx|wardrobe)-notes$/.test(url)) {
        return json({ productionId: "2027", notes });
      }
      if (url === "/api/usage") return new Response(null, { status: 204 });
      if (url === STORAGE && init?.body instanceof FormData) {
        const { department, itemId, name, size } = JSON.parse(String(init.body.get("key")));
        const files = filesOf(department, itemId);
        files.splice(0, files.length, ...files.filter((f) => f.name !== name), { name, size });
        return new Response(null, { status: 204 });
      }
      const [, itemId = "", department, what, query = ""] =
        /^\/api\/productions\/2027\/items\/([^/]+)\/(scenery|sfx|wardrobe)-([a-z-]+)\??(.*)$/.exec(
          url,
        ) ?? [];
      if (department !== "scenery" && department !== "sfx" && department !== "wardrobe") {
        return json({ status: "ok", version: "dev" });
      }
      const files = filesOf(department, itemId);
      const name = new URLSearchParams(query).get("name");
      if (what === "notes" && init?.method === "PUT") {
        const { text, revision } = SaveItemNoteRequest.parse(JSON.parse(String(init.body)));
        const saved = { itemId, text, revision: revision + 1 };
        notes.splice(0, notes.length, ...notes.filter((n) => n.itemId !== itemId), saved);
        return json(saved);
      }
      if (what === "uploads") {
        const request = ItemFileUploadRequest.parse(JSON.parse(String(init?.body)));
        const key = { department, itemId, name: request.name, size: request.size };
        return json({ url: STORAGE, fields: { key: JSON.stringify(key) } });
      }
      const at = files.findIndex((file) => file.name === name);
      if (what === "files" && init?.method === "DELETE") {
        if (at < 0) return new Response(null, { status: 404 });
        files.splice(at, 1);
        return new Response(null, { status: 204 });
      }
      if (what === "files") return json({ files });
      if (what === "file-link" && name !== null && at >= 0) {
        const download = new URLSearchParams(query).get("download") === "true";
        return json({ url: download ? downloadLinkTo(name) : linkTo(name) });
      }
      if (what === "image-links") {
        const images = files.filter((each) => isGalleryImage(each.name));
        return json({ links: images.map((each) => ({ name: each.name, url: linkTo(each.name) })) });
      }
      return new Response(null, { status: 404 });
    }),
  );
}

export const pageOf = (department: FileDepartment, item = "opening-number") =>
  `/production/items/${item}/${department}`;

export const requests = (match: (url: string, init?: RequestInit) => boolean) =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url, init]) => match(String(url), init))
    .map(([url]) => String(url));

/** The names of the page's file rows, in order. */
export const names = (wrapper: VueWrapper) =>
  wrapper.findAll("main [data-test=file]").map((row) => row.get("[data-test=name]").text());
