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
- **Names**: a name is valid if it is 1 to 255 characters long, has no `/`, `\` or control characters, and isn't `.` or `..`. Upload (E2.S7) will refuse any other name. Listing skips anything else it finds, such as an S3 console folder (a key ending in `/`).
- **Listing**: the API lists the item's prefix with `/` as the delimiter, so it sees only the item's own files and nothing nested deeper. It follows S3's continuation tokens to the end, and returns each file's name and size. The page sorts by name.
- **Access**: only the API function may read the bucket, and in this story only by listing (`s3:ListBucket`). Download links (E2.S2) and uploads (E2.S7) will add only what they need. Listing goes through the API route, so it needs a sign-in like every route (ADR 0018). The stack's tests check that the bucket refuses public access. `pnpm check:hosted` doesn't ask the bucket directly.
- **Local development**: as with `DATA_TABLE`, the API uses the bucket when `FILES_BUCKET` is set, and otherwise a folder laid out the same way: `<DATA_DIR>/files/<production>/<item id>/scenery/<name>`, git-ignored with the rest of the data. `pnpm demo` and the tests always use a folder. `pnpm dev` gets `FILES_BUCKET` once the maintainer's first deploy has created the bucket.
- **Cost**: a show's scenery files are expected to total a few GB, which is cents a month in S3 Standard, plus pennies for list requests. That stays well inside the £5 budget alert (remote-data FR13).

## Consequences

- **Easier**:
  - The production team, or the maintainer, can fix a name, add a file or tidy up in the S3 console, and the app shows the result on the next load.
  - SFX and Wardrobe can keep files the same way under their own folder in each item.
- **Harder**:
  - Renaming at source is a copy and a delete, not an edit.
  - The name rules must hold everywhere a key is made. Upload (E2.S7) has to apply them, and deleting a removed item's files (E2.S6) has to delete the whole `<production>/<item id>/` prefix.
  - `pnpm dev` reads the real bucket once it's configured, as it does the real table.
- **Revisit if**:
  - an item's files run to many thousands, so listing them on every load gets slow;
  - files need a description, tags or history (PRD non-goals);
  - the team wants files anyone can reach without signing in.
