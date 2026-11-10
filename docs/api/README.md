# The iCUE API

The API is what the iCUE pages talk to. It holds each production's running order, cast, casting, props, mic plots, notes and files, and the team's accounts. Only the production team can reach it: every `/api` route needs a token from the team's sign-in.

**In short:** sign in, send your token with each request, read what you like, and change only what your permissions allow. If someone else saved first, you get a 409, and you try again from what's there now.

The full reference is [`openapi.json`](openapi.json), an [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) description generated from the code. Open it in any OpenAPI viewer. This page explains how to read it.

## How sign-in works

1. The pages read `/config.json`, a public file holding only the settings needed to start signing in. It's the one thing in the spec that needs no token.
2. The pages send you to the team's Cognito sign-in page, using the authorization code flow with PKCE. Only an account an admin created can sign in; there's no self sign-up.
3. Cognito returns an **access token**, which lasts 5 minutes. The pages renew it quietly for up to a day.
4. Every request carries it: `Authorization: Bearer <token>`. The token is checked by API Gateway before any iCUE code runs, so a missing or bad token always gets a `401`.

What you may do comes from your token, never from anything you send ([ADR 0018](../adr/0018-access-control-with-cognito.md), [ADR 0026](../adr/0026-department-permissions-as-user-pool-groups.md)). The groups in its `cognito:groups` claim are your permissions, and its `username` claim says who you are. Changes to an account's access apply within 5 minutes.

## Who can do what

- **Anyone signed in** can use every read, the Excel export of the casting grid, and record their own usage.
- **A change to a department's data** needs one of that department's permissions, or an admin.
- **Admins only:** the accounts, starting and deleting productions, saving the running order, deleting a cast member, and reading usage.
- **Past productions are view only, for everyone.** Only the newest production can change, and admins are no exception.

Each operation in the spec says what it needs, in its description and in the `x-permission` field. [The architecture guide](../architecture/README.md#roles-and-department-permissions) shows which permission opens which department. The spec is generated from the table in [`packages/shared/src/api-routes.ts`](../../packages/shared/src/api-routes.ts), and that guide is written against it.

## Reading the spec

| In the spec | Means |
|---|---|
| `paths` | Each route, grouped by address. Tags group them by area: Cast, Casting, Props, Item files, Mic plot and so on |
| `components.schemas` | The shapes of bodies, named after their zod schemas in `packages/shared` |
| `security` at the top | The token is needed everywhere, except where an operation sets `security: []` |
| `x-permission` | Who may use the route: `anyone signed in`, `admins`, or admins plus `anyOf` these permissions |
| `responses` | Every status the route's handler gives, and the refusal bodies. A response with no `content` has an empty body |

Most fields are checked by name and type. Rules that look at several fields at once can't be said in JSON Schema, so they're in the operation's description instead: "only an ensemble has several people", or "no more carriers than the quantity".

## Worked examples

These use the made-up names of the demo show. `$APP` is the app's address and `$TOKEN` a token from your own sign-in; neither ever goes in the repository. To try the API with nothing at stake, run `pnpm demo`, whose API runs at `http://127.0.0.1:3190` on made-up data, with no sign-in or token.

### Read the cast

```bash
curl -H "Authorization: Bearer $TOKEN" "$APP/api/productions/2027/cast"
```

```json
{
  "productionId": "2027",
  "members": [
    {
      "id": 7,
      "firstName": "Wren",
      "lastName": "Thistledown",
      "section": "scouts",
      "group": "12th Nowhere",
      "revision": 2
    }
  ]
}
```

The production id is its year. Ask `GET /api/productions` for the list rather than assuming one: the highest year is the one everyone opens.

### Save a note, and handle someone else saving first

Anything two people might edit at once carries a `revision`. Send the revision you read, and a change based on an older one is refused rather than overwriting someone's work.

```bash
curl -X PUT "$APP/api/productions/2027/items/itm-01/props-notes" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text": "Treasure chest needs a new hinge", "revision": 3}'
```

- **`200`** gives the saved note, now at revision 4.
- **`409`** means someone saved first. Fetch the notes again, show the person what's there now, and let them decide.
- **`403`** with a `department` field means the account lacks the permission. With a `productions` field it means the production isn't the newest.

### Upload a file

Files don't pass through the API. `POST …/scenery-uploads` with the file's name and size answers with a `url` and `fields`. Send those, then the file, as `multipart/form-data` to that `url`, within 5 minutes and up to 100 MB. `…/scenery-file-link?name=…` gives a link that opens or downloads a file for 5 minutes. Anyone holding that link can use it, so it's never kept or shared.

## When something is refused

| Status | From | Means |
|---|---|---|
| `400` | handler | The body or query doesn't fit, or breaks a rule. Usually an empty body; a few carry a `message` or `error` |
| `401` | API Gateway | No valid token |
| `403` | API | Past production, or not permitted. Bodies say which: `productions` or `department`, or just a `message` for admin-only routes. Past production is checked first |
| `404` | handler | No such thing, or a malformed id. A change to an item not in the latest running order is a `404` too |
| `409` | handler | Someone else saved first, or a name or channel is already taken. Running order and mic plot conflicts include the latest state |
| `429` | API Gateway | Too many requests: the whole API is limited to 20 a second (burst 40), and recording usage to 5 a second (burst 10) |
| `500` or `503` | API Gateway | A request failed or took over 10 seconds. A casting change can answer `500` after it was saved: reload before trying again |

Every API response is sent with `Cache-Control: no-store`, as it can hold cast data.

## Running locally

`pnpm dev` and `pnpm demo` serve the same handlers from a small local server, which isn't what's hosted. There it listens only on `127.0.0.1`, has no sign-in and acts as an admin. Writes must be `Content-Type: application/json`, and a request with another site's `Origin` is refused. It takes the sidebar's "Local role" switch through an `x-local-access` header, which the hosted API ignores. Item files are served from `/api/local-files/`, which exists only locally, so neither is in the spec. The local server also limits a request's body to 256 KB.

## Keeping the spec up to date

```bash
pnpm api:spec
```

`pnpm check` fails if `docs/api/openapi.json` differs from what this command writes, or if a route has no entry, so a change to the routes, permissions or schemas needs a regenerated file in the same commit. Commit the result; don't edit it by hand. Biome skips the file, because it would reformat what the command writes and the check compares it byte for byte.

Where each part comes from:

| Part | Source |
|---|---|
| Routes | `routeKeys` in `packages/shared/src/api-routes.ts` |
| Who may use a route, and 403 refusals | `needOf`, `departments` and `isChangeWithinProduction` in the same file |
| Shapes | The zod schemas in `packages/shared`, by their export names |
| Which schemas a route uses, its summary, and its handler's refusals | `routeDocs` in `tooling/src/openapi-routes.ts` |

`routeDocs` is typed by route, so a new route fails the typecheck until it's described. It can't check that a handler's refusals are described correctly, so change that entry when you change a handler's statuses.

`info.version` isn't the release number, or the file would change on every release. `GET /api/health` reports the running one.
