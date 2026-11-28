# 0043. Stores images outside every production, in the files bucket

- **Status**: Proposed
- **Date**: 2026-11-26
- **Deciders**: Nick Hirst

## Context

The stores PRD gives the Scenery, Props and Wardrobe managers a gallery each for what the show keeps in store from one year to the next (FR1 to FR3). Stores belong to the show, not to a production: nothing done to a production may change them (FR2). Each image will also get a short description (E3.S1, FR15, FR17).

Every file the app keeps today sits under a production and an item, keyed `<production>/<item id>/<department>/<name>` (ADR 0030, ADR 0032). Two clean-ups work from that: saving a running order that cuts an item deletes the item's folder (production-scenery FR13), and deleting a past production deletes every key under its year (ADR 0037). Rows in the table sit in a production's partition, `PROD#<year>`, which deleting a production erases. The PRD assumes no new AWS resource, so the question is where in the bucket and the table stores go, and why neither clean-up reaches them.

## Options considered

1. **The same bucket, under a `stores/` folder of its own; descriptions in the table, in a partition of their own.**
   - Pros: no new resource. The name rules, short-lived links, Content-Security-Policy and private bucket of ADR 0030 all apply as they are. Every production's folder is its year, four digits (ADR 0036), so `stores/` can never be one, and nothing that works by a year's folder or partition reaches it.
   - Cons: the API's access widens to one more folder. Names stay in storage and descriptions in the table, so a rename outside the app leaves a description behind.
2. **A second bucket for the stores.**
   - Pros: a production's clean-up couldn't reach a store at all.
   - Cons: a new AWS resource, CORS rule, Content-Security-Policy entry and `pnpm dev` setting, for the same kind of file. Rejected: the PRD assumes no new resource.
3. **Stores as a pretend production and item, reusing the item file routes as they are.**
   - Pros: the least new code.
   - Cons: the running order, the production list and both clean-ups would all have to learn to leave it alone, and the production id would stop being a year. Rejected: it hides the difference rather than stating it.
4. **Descriptions in each object's S3 metadata, or a JSON file beside the images.**
   - Pros: everything about an image stays in storage.
   - Cons: S3's listing doesn't return metadata, so 300 images would need 300 requests, which ADR 0030 rejected for names. A shared JSON file loses one of two edits made at once, and the listing would have to skip it. Rejected for descriptions.

## Decision

We will use option 1. It extends ADR 0030; everything there stands for item files.

- **Stores**: one shared list in `packages/shared` names each store by its department: Scenery, Props and Wardrobe, in that order. The sidebar, the page's route, the API's routes and the Usage page's names all come from it. A store added later joins the list only.
- **Keys**: `stores/<store>/<name>`, with ADR 0030's name rules. A request's store is checked against the shared list before it reaches a key, so no key reaches outside a store's folder.
- **Routes**: `GET /api/stores/{storeId}/image-links` answers with a short-lived link to each of the store's images, from one listing, so the page loads with one request (FR6). `GET /api/stores/{storeId}/image-link?name=…` gives one image's link, with `&download=true` to save it, as the viewer's Open and Download ask (ADR 0030, as amended for the gallery). Both are open to every signed-in role, need a sign-in like every route (ADR 0018), and answer 404 for a store not in the list. They name no production, so no production check applies.
- **Changes**: `POST /api/stores/{storeId}/uploads` answers with a signed form for one image, as an item's upload does (ADR 0030): up to 100 MB, under its file's name, and only a JPG, PNG, GIF or WebP, the images the gallery shows. `DELETE /api/stores/{storeId}/images?name=…` deletes one image for good, and its description with it once images have them (E3.S1), answering 404 for one already gone, as an item's file delete does. Who may change each store is said once, in the shared list of stores: its own department's permission (Stage for Scenery and Props, Wardrobe for Wardrobe), never Director or Tech, or an admin (stores FR4, FR5). A store's change routes name the need `store` in the route table, and the entry point reads the store from the path, so one route serves every store; a store the list doesn't hold is left to admins, so a gap fails safe. A refusal is the store's department's (ADR 0035).
- **Access**: the API function's `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` add `stores/*`. `s3:ListBucket` is unchanged.
- **Local development**: the folder `<DATA_DIR>/files/stores/<store>/<name>`, served by the dev server at `/api/local-files/stores/<store>/<name>` with the same headers and checks as item files.
- **Descriptions** (E3.S1): in the table, under the partition `STORE#<store>` with the sort key `IMAGE#<name>`, and locally in a file of their own beside the other data. Names still come from storage, so the image list is what storage holds and a description is shown only beside an image that's there. Renaming or deleting an image in the app moves or deletes its description with it.
- **Left alone by every production change**: the running-order clean-up and production delete list only `<year>/` keys and erase only `PROD#<year>` rows (ADR 0030, ADR 0037), and starting or switching a production reads neither. None of them name the stores, and none needs to.

## Consequences

- **Easier**:
  - The stores reuse the item files' storage, links, viewer and security as they are.
  - A store for another department is one entry in the shared list, plus its access when it can change.
- **Harder**:
  - The API's access names one more folder.
  - A rename or delete in the S3 console leaves a description that nothing shows, until the app writes that name again.
  - Stores keep their images for years, so a photo of a cast member uploaded by mistake (ADR 0010) stays until someone deletes it.
- **Revisit if**:
  - a production id could ever be `stores`, which would put a production's files in a store's folder;
  - a store grows to thousands of images, so listing it on every visit gets slow;
  - stores need their own retention or encryption, apart from item files.
