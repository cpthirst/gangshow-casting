# 0030. Scenery files in a private bucket, each named by its key

- **Status**: Accepted
- **Date**: 2026-10-29
- **Deciders**: Nick Hirst

## Context

The production-scenery PRD gives each item's Scenery page the item's files: set plans, designs and photos of up to 100 MB each (FR6 to FR13). The app stores no files today. A 100 MB file is far bigger than one API request can carry (API Gateway caps one at 10 MB), so files need storage of their own, beside the table (ADR 0015). That is a new AWS resource, and CLAUDE.md asks for a decision record.

The maintainer decided on 2026-10-29 that **file names live in file storage, not the database**: a file renamed, added or removed directly in storage, outside the app, shows on the next load. Casting data must never be publicly reachable, and nor must these files. Each production is self-contained, and an item's files must stay with it when it moves in the running order (FR12). SFX and Wardrobe may later keep files per item too.

## Options considered

1. **One private S3 bucket. A file's key is `<production>/<item id>/scenery/<name>`, and its name is the key's last part.**
   - Pros: a rename at source (on S3, a copy to the new key and a delete of the old one) shows at once, with no database rows to fall out of step. One list request per 1,000 files gives every name and size. Folders by production and item ID keep files with a moved item, and nothing carries over between productions. A department folder under each item leaves room for `sfx/` and `costume/` later.
   - Cons: the name has to be checked so that it can't reach outside its folder. S3's "Create folder" and files nested deeper show up in the listing, so the listing has to skip them.
2. **A generated key per file, with the name held in the object's metadata.**
   - Pros: any name is safe as a key.
   - Cons: renaming at source means editing metadata, which the S3 console makes awkward. Listing doesn't return metadata, so it needs one request per file.
3. **Names in the table, beside a generated key.**
   - Pros: listing is one query.
   - Cons: rejected by the maintainer. A rename at source would leave the table out of step.

## Decision

We will use option 1.

- **Bucket**: one bucket in the stack (`FilesBucket`), in London with the table. It blocks all public access, is encrypted with S3-managed keys, refuses requests that don't use TLS, and has no bucket policy that opens it. It has no versioning, so a replaced or deleted file is gone (PRD non-goals, ADR 0010). It is retained if the stack is deleted, because it holds the only copy of the files. The `FilesBucketName` output names it.
- **Keys**: `<production>/<item id>/scenery/<name>`. The production and item IDs are checked against their schemas before they reach a key, as they already are for folders and table keys.
- **Names**: a name is valid if it is 1 to 255 characters long, has no `/`, `\` or control characters, and isn't `.` or `..`. Upload refuses any other name. Listing skips anything else it finds, such as an S3 console folder (a key ending in `/`).
- **Listing**: the API lists the item's prefix with `/` as the delimiter, so it sees only the item's own files and nothing nested deeper. It follows S3's continuation tokens to the end, and returns each file's name and size. The page sorts by name.
- **Access**: only the API function may read the bucket: it lists it (`s3:ListBucket`) and reads scenery files (`s3:GetObject` on `*/*/scenery/*`) to sign links to them (see Opening and downloading), deletes them (`s3:DeleteObject` on the same keys; see Deleting), and signs upload forms (`s3:PutObject` on the same keys; see Uploading). Listing goes through the API route, so it needs a sign-in like every route (ADR 0018). The stack's tests check that the bucket refuses public access. `pnpm check:hosted` doesn't ask the bucket directly.
- **Local development**: as with `DATA_TABLE`, the API uses the bucket when `FILES_BUCKET` is set, and otherwise a folder laid out the same way: `<DATA_DIR>/files/<production>/<item id>/scenery/<name>`, git-ignored with the rest of the data. `pnpm demo` and the tests always use a folder. `pnpm dev` gets `FILES_BUCKET` once the maintainer's first deploy has created the bucket.
- **Opening and downloading** (amended 2026-10-29, production-scenery E2.S2): the page asks `GET …/items/{itemId}/scenery-file-link?name=<name>` for a link to one file, which every signed-in role may. The API checks the name as above and that the file is there (404 if not), then signs an S3 link to it that lasts 5 minutes, on S3's address, never the app's. The link sets the response's type and `Content-Disposition` from the name's extension alone, never from what storage holds: a PDF, JPG, PNG, GIF, WebP or plain-text file opens `inline` with its own type, in a new tab; anything else, HTML and SVG among them, is an `attachment` of type `application/octet-stream`, so nothing that can run script ever opens. Locally, with no bucket, the dev server serves the files folder at `/api/local-files/<key>` with the same headers, checking each part of the path as a key's. It is unsigned and doesn't expire, as the local API needs no sign-in anyway. Because those files come from the app's own address, it also sends `nosniff`, and `sandbox` on downloads. Options considered: the API sending the file itself (rejected: Lambda answers carry at most 6 MB, and files reach 100 MB); a public or CloudFront path (rejected: files must never be publicly reachable); signed local links (rejected by the maintainer as more than local use needs).
- **Counting** (amended 2026-10-29, production-overview E2.S3): the Overview asks `GET …/scenery-file-counts` for every item's file count, which every signed-in role may. The API lists the production's prefix once, with no delimiter, following continuation tokens, and counts only keys shaped `<item id>/scenery/<name>` with a valid item ID and name, so nested files, other departments' folders and folder placeholders aren't counted. It needs nothing beyond `s3:ListBucket`. One listing for the whole production costs a request per 1,000 files, where asking per item would cost one per item on every visit.
- **Deleting** (amended 2026-10-29, production-scenery E2.S4): the page sends `DELETE …/items/{itemId}/scenery-files?name=<name>`, which needs Stage, Tech, Director or an admin. The API checks the name as above, so a delete can't reach another item's folder, then looks for the file before deleting it: S3 answers a delete of a missing key as if it worked, and the page needs a 404 to say the file is already gone. With no versioning, a deleted file can't be brought back.
- **Uploading** (amended 2026-10-29, production-scenery E2.S7):
  - **One route.** The page sends `POST …/items/{itemId}/scenery-uploads` with `{name, size, replace?}`, which needs Stage, Tech, Director or an admin. The API checks the item is in the latest saved running order, the name as above, and that the stated size is at most 100 MB (400 if not). It answers 409 if the item already has a file of that name, compared exactly, unless `replace` is true (FR9). Otherwise it returns an S3 presigned POST, `{url, fields}`, which lasts 5 minutes. Its policy fixes the key and sets `content-length-range` from 0 to 100 MB, so S3 itself refuses a bigger file, whatever sends it. Signing it uses `@aws-sdk/s3-presigned-post`, from the same SDK as the client.
  - **The file goes straight to S3.** The page posts the form's fields, then the file, to the bucket's own address with plain `fetch`, never with the sign-in token. Nothing is called afterwards: the page reloads the list, as S3 holds the names and sizes.
  - **CORS and CSP.** The bucket's CORS allows `POST` from any origin. The signed form is the only key: S3 takes a plain HTML form from any site anyway, so naming the app's address would protect nothing. It would also make a cycle, as the pages' Content-Security-Policy now names the bucket, whose `connect-src` adds its regional address.
  - **Locally**, with no bucket, the API returns the file's `/api/local-files/<key>` path with no fields. The dev server takes a multipart form there, checking the path as a key's, refusing a file over 100 MB, and accepting the form only with a local `Origin`. That keeps other sites' pages out, as its rule that writes be JSON does elsewhere.
  - **Options considered**: sending the file through the API (rejected: API Gateway caps a request at 10 MB); a presigned PUT (rejected: it can't cap the size unless the page states the length and the signature covers it, which is easier to get wrong than a policy); S3 multipart upload (rejected for now: resuming a dropped upload would need routes to start, sign each part, finish and abandon, and clean-up of parts left behind, for files that are at most 100 MB).
- **Cost**: a show's scenery files are expected to total a few GB, which is cents a month in S3 Standard, plus pennies for list requests. That stays well inside the £5 budget alert (remote-data FR13).

## Consequences

- **Easier**:
  - The production team, or the maintainer, can fix a name, add a file or tidy up in the S3 console, and the app shows the result on the next load.
  - SFX and Wardrobe can keep files the same way under their own folder in each item.
- **Harder**:
  - Renaming at source is a copy and a delete, not an edit.
  - The name rules must hold everywhere a key is made. Upload applies them, and refuses `${` too, which S3 would rewrite in an upload form's key, and deleting a removed item's files (E2.S6) has to delete the whole `<production>/<item id>/` prefix.
  - `pnpm dev` reads the real bucket once it's configured, as it does the real table, so its AWS profile needs `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on scenery files as well as `s3:ListBucket`.
  - Anyone handed a file's link can use it for 5 minutes without signing in. That's the price of downloads that don't pass through the API. The same goes for an upload form, for its one key, of up to 100 MB.
  - An upload that fails part-way starts again from the beginning.
  - The 409 for a taken name is checked when the form is signed. A form signed earlier, or a second one signed in the same minutes, can still overwrite the file: the confirm (E2.S5) is a courtesy, not a lock.
- **Revisit if**:
  - an item's files run to many thousands, so listing them on every load gets slow;
  - files need a description, tags or history (PRD non-goals);
  - the team wants files anyone can reach without signing in;
  - uploads over backstage connections keep failing part-way, which would make S3 multipart upload worth its routes.
