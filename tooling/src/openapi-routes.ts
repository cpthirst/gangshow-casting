// What the API's route list and zod schemas can't say about each route: which schemas it
// takes and answers with, and when its handler refuses. Routes, permissions and the shapes
// themselves are read from @app/shared by openapi.ts, and never restated here. Typed by
// RouteKey, so a new route that isn't described here fails the typecheck.
import {
  AccountList,
  AccountSummary,
  AddRoleRefusal,
  AddRoleRequest,
  AllocateMicRequest,
  CastingGridExportRequest,
  CastList,
  CastMember,
  CastMemberDetails,
  Costume,
  CostumeList,
  CreatedAccount,
  type DepartmentId,
  departmentIds,
  departments,
  FolderId,
  HealthResponse,
  ItemFileCounts,
  ItemFileLink,
  ItemFileList,
  ItemFileName,
  ItemFileUpload,
  ItemFileUploadRequest,
  ItemMicPlot,
  ItemNote,
  ItemNoteList,
  MicPlotList,
  NewAccount,
  NewProduction,
  ProductionList,
  Prop,
  PropDetails,
  PropList,
  RecordUsageRequest,
  Role,
  RoleList,
  type RouteKey,
  RunningOrder,
  SaveCostumeRequest,
  SaveItemNoteRequest,
  SaveRunningOrderRequest,
  SetAccess,
  SetEnabled,
  UpdateCastMemberRequest,
  UpdateRoleRequest,
  UsageQuery,
  UsageSummary,
} from "@app/shared";
import { z } from "zod";

/** A refusal the app shows as it is (messageResponse in apps/api/src/http/json.ts). */
export const Message = z.strictObject({ message: z.string() });

/** A change needing a department's permission, refused (ReadOnlyRefusal in @app/shared). */
export const DepartmentRefusal = z.strictObject({
  message: z.string(),
  department: z.enum(departmentIds),
});

/** A refusal: what it means, and the body it carries when it isn't empty. */
export type Refusal = { description: string; body?: z.ZodType };

export interface RouteDoc {
  tag: string;
  summary: string;
  /** Rules a client needs that a JSON Schema can't hold. */
  description?: string;
  query?: Record<string, { schema: z.ZodType; required: boolean; description: string }>;
  /** The {itemId} rule, where the handler holds it to a narrower one than a running-order item. */
  itemId?: z.ZodType;
  request?: z.ZodType;
  success: { status: 200 | 201 | 204; description: string; body?: z.ZodType; file?: string };
  /** Only what this route's handler adds: openapi.ts adds the refusals every route shares. */
  refusals?: Partial<Record<"400" | "403" | "404" | "409", Refusal>>;
}

const plain = (description: string): Refusal => ({ description });
const NOT_VALID = plain("The body doesn't fit the schema.");
const NOT_IN_ORDER = plain("The item isn't in the latest saved running order.");
const STALE = plain("Someone else saved first: the revision sent is out of date.");
const NO_SUCH_ACCOUNT = plain("There's no account with that username.");
const NAME_TAKEN = "or the item already has a role of that name";

const ok = (description: string, body?: z.ZodType): RouteDoc["success"] =>
  body ? { status: 200, description, body } : { status: 200, description };
const created = (description: string, body: z.ZodType): RouteDoc["success"] => ({
  status: 201,
  description,
  body,
});
const noContent = (description: string): RouteDoc["success"] => ({ status: 204, description });

const revisionQuery = {
  revision: {
    schema: CastMember.shape.revision,
    required: true,
    description: "The revision the removal is based on.",
  },
};
const fileName = (description: string) => ({
  name: { schema: ItemFileName, required: true, description },
});

const nounOf = (department: DepartmentId) => departments[department].noun;

const listNotes = (department: DepartmentId): RouteDoc => ({
  tag: "Item notes",
  summary: `Every item's ${nounOf(department)} notes`,
  success: ok("The notes. An item with none may be left out.", ItemNoteList),
});

const saveNotes = (department: DepartmentId): RouteDoc => ({
  tag: "Item notes",
  summary: `Save one item's ${nounOf(department)} notes`,
  description: 'The text is trimmed, and "" clears the notes. Send revision 0 for a first save.',
  request: SaveItemNoteRequest,
  success: ok("The saved notes.", ItemNote),
  refusals: { "400": NOT_VALID, "404": NOT_IN_ORDER, "409": STALE },
});

const listFiles = (department: DepartmentId): RouteDoc => ({
  tag: "Item files",
  summary: `List an item's ${nounOf(department)} files`,
  itemId: FolderId,
  success: ok("The files, as file storage holds them now.", ItemFileList),
});

const fileLink = (department: DepartmentId): RouteDoc => ({
  tag: "Item files",
  summary: `A short-lived link to one ${nounOf(department)} file`,
  description: "The link lasts 5 minutes and needs no token, so never share or store it.",
  query: fileName("The file to link to."),
  itemId: FolderId,
  success: ok("The link.", ItemFileLink),
  refusals: {
    "400": plain("The name isn't one a file can have."),
    "404": plain("The file isn't there."),
  },
});

const removeFile = (department: DepartmentId): RouteDoc => ({
  tag: "Item files",
  summary: `Delete one ${nounOf(department)} file for good`,
  query: fileName("The file to delete."),
  itemId: FolderId,
  success: noContent("Deleted."),
  refusals: {
    "400": plain("The name isn't one a file can have."),
    "404": plain("The file is already gone."),
  },
});

const uploadFile = (department: DepartmentId): RouteDoc => ({
  tag: "Item files",
  summary: `Get a form for uploading one ${nounOf(department)} file`,
  description:
    "Answers with where to POST the file: send the fields, then the file, as multipart/form-data. The file goes straight to file storage, up to 100 MB, within 5 minutes.",
  itemId: FolderId,
  request: ItemFileUploadRequest,
  success: ok("Where to send the file.", ItemFileUpload),
  refusals: {
    "400": NOT_VALID,
    "404": NOT_IN_ORDER,
    "409": plain("The item has a file of that name, and replace wasn't true."),
  },
});

const countFiles = (department: DepartmentId): RouteDoc => ({
  tag: "Item files",
  summary: `How many ${nounOf(department)} files each item has`,
  success: ok("The counts, by item id. An item with none may be left out.", ItemFileCounts),
});

const PRODUCTION = "/api/productions/{productionId}";
const ITEM = `${PRODUCTION}/items/{itemId}`;

export const routeDocs: Record<RouteKey, RouteDoc> = {
  "GET /api/health": {
    tag: "Health",
    summary: "Whether the API is up, and its version",
    success: ok("The API is up.", HealthResponse),
  },
  "GET /api/accounts": {
    tag: "Accounts",
    summary: "Every account in the team",
    success: ok("The accounts.", AccountList),
  },
  "POST /api/accounts": {
    tag: "Accounts",
    summary: "Create an account with a temporary password",
    description: "The temporary password is answered once, and never stored.",
    request: NewAccount,
    success: created("The account, and its temporary password.", CreatedAccount),
    refusals: {
      "400": {
        description:
          "The body doesn't fit the schema. Only a bad username carries a message; anything else has no body.",
        body: Message,
      },
      "409": { description: "That username is already taken.", body: Message },
    },
  },
  "POST /api/accounts/{username}/password": {
    tag: "Accounts",
    summary: "Reset a password, and sign the account out everywhere",
    success: ok("The account, and its new temporary password.", CreatedAccount),
    refusals: { "404": NO_SUCH_ACCOUNT },
  },
  "PUT /api/accounts/{username}/enabled": {
    tag: "Accounts",
    summary: "Disable or enable an account",
    description: "Disabling signs the account out everywhere.",
    request: SetEnabled,
    success: ok("The account as it is now.", AccountSummary),
    refusals: {
      "400": NOT_VALID,
      "403": plain("Disabling, with a token that names no username."),
      "404": NO_SUCH_ACCOUNT,
      "409": { description: "An admin can't disable their own account.", body: Message },
    },
  },
  "PUT /api/accounts/{username}/access": {
    tag: "Accounts",
    summary: "Change what an account may do",
    description: "Signs the account out everywhere, so it applies at their next sign-in.",
    request: SetAccess,
    success: ok("The account as it is now.", AccountSummary),
    refusals: {
      "400": NOT_VALID,
      "403": plain("A token that names no username."),
      "404": NO_SUCH_ACCOUNT,
      "409": {
        description:
          "An admin can't change their own access, and the only enabled admin stays one.",
        body: Message,
      },
    },
  },
  "GET /api/productions": {
    tag: "Productions",
    summary: "Every production, by year",
    description: "The newest year is the one everyone opens, and the only one that can change.",
    success: ok("The productions.", ProductionList),
  },
  "POST /api/productions": {
    tag: "Productions",
    summary: "Start a new, empty production",
    request: NewProduction,
    success: created("The updated list.", ProductionList),
    refusals: {
      "400": {
        description:
          "The body doesn't fit the schema (no body), or the year isn't four digits later than the newest (with a message).",
        body: Message,
      },
    },
  },
  [`DELETE ${PRODUCTION}`]: {
    tag: "Productions",
    summary: "Delete a past production for good",
    description:
      "Marks it first, then deletes its files and data, then its place in the list. Repeat the request to finish one that stopped part way.",
    success: ok("The updated list.", ProductionList),
    refusals: {
      "400": { description: "The newest production can't be deleted.", body: Message },
      "404": plain("No such production."),
    },
  },
  [`GET ${PRODUCTION}/running-order`]: {
    tag: "Running order",
    summary: "The latest saved running order",
    success: ok("The latest version.", RunningOrder),
    refusals: { "404": plain("The production has no running order.") },
  },
  [`POST ${PRODUCTION}/running-order/versions`]: {
    tag: "Running order",
    summary: "Apply one change and save the next version",
    description:
      "Every kept item must be listed once, and any item left out is removed, with everything kept for it: its roles, notes, props, mics and files.",
    request: SaveRunningOrderRequest,
    success: created("The new version.", RunningOrder),
    refusals: {
      "400": plain(
        "The body doesn't fit the schema, or the change doesn't fit the latest version.",
      ),
      "404": plain("The production has no running order."),
      "409": {
        description: "Someone else saved first: this is the latest version.",
        body: RunningOrder,
      },
    },
  },
  [`GET ${PRODUCTION}/cast`]: {
    tag: "Cast",
    summary: "The production's cast list",
    success: ok("The cast.", CastList),
    refusals: { "404": plain("The production has no cast list.") },
  },
  [`POST ${PRODUCTION}/cast`]: {
    tag: "Cast",
    summary: "Add a cast member",
    description: "Strict: any field the schema doesn't name is refused, not dropped.",
    request: CastMemberDetails,
    success: created("The new cast member.", CastMember),
    refusals: { "400": NOT_VALID, "404": plain("The production has no cast list.") },
  },
  [`PUT ${PRODUCTION}/cast/{castId}`]: {
    tag: "Cast",
    summary: "Replace a cast member's details",
    request: UpdateCastMemberRequest,
    success: ok("The updated cast member.", CastMember),
    refusals: {
      "400": plain("The id isn't a positive whole number, or the body doesn't fit the schema."),
      "404": plain("No such cast member."),
      "409": STALE,
    },
  },
  [`DELETE ${PRODUCTION}/cast/{castId}`]: {
    tag: "Cast",
    summary: "Remove a cast member for good",
    description: "Takes them out of every role, every prop they carried and every mic they had.",
    query: revisionQuery,
    success: noContent("Removed."),
    refusals: {
      "400": plain("The id or revision isn't a positive whole number."),
      "404": plain("No such cast member."),
      "409": STALE,
    },
  },
  [`GET ${PRODUCTION}/roles`]: {
    tag: "Casting",
    summary: "Every role in the production",
    success: ok("The roles.", RoleList),
  },
  [`POST ${ITEM}/roles`]: {
    tag: "Casting",
    summary: "Add a role to an item",
    description:
      "Only an ensemble can have several people. Nobody can be listed twice, and everyone must be in this production's cast.",
    request: AddRoleRequest,
    success: created("The new role.", Role),
    refusals: {
      "400": {
        description: `The body doesn't fit the schema, or names someone not in the cast (no body), ${NAME_TAKEN} (with the refusal).`,
        body: AddRoleRefusal,
      },
      "404": NOT_IN_ORDER,
    },
  },
  [`PUT ${PRODUCTION}/roles/{roleId}`]: {
    tag: "Casting",
    summary: "Replace a role's name, size and cast",
    description:
      "Only an ensemble can have several people. Anyone taken out stops carrying its props, and loses their mic in the item if they're in no other role there.",
    request: UpdateRoleRequest,
    success: ok("The updated role.", Role),
    refusals: {
      "400": {
        description: `The body doesn't fit the schema, or names someone not in the cast (no body), ${NAME_TAKEN} (with the refusal).`,
        body: AddRoleRefusal,
      },
      "404": plain("No such role."),
      "409": STALE,
    },
  },
  [`DELETE ${PRODUCTION}/roles/{roleId}`]: {
    tag: "Casting",
    summary: "Remove a role for good",
    query: revisionQuery,
    success: noContent("Removed."),
    refusals: {
      "400": plain("The revision isn't a positive whole number."),
      "404": plain("No such role."),
      "409": STALE,
    },
  },
  [`POST ${PRODUCTION}/casting-grid/export`]: {
    tag: "Casting",
    summary: "Turn the grid sent into an Excel file",
    description:
      "Changes nothing stored, so every role may use it, on any production. Every row needs one cell per item.",
    request: CastingGridExportRequest,
    success: {
      status: 200,
      description: "The Excel file.",
      file: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    refusals: { "400": NOT_VALID },
  },
  [`GET ${PRODUCTION}/item-notes`]: listNotes("casting"),
  [`PUT ${ITEM}/notes`]: saveNotes("casting"),
  [`GET ${PRODUCTION}/props`]: {
    tag: "Props",
    summary: "Every item's props",
    success: ok("The props, in no particular order.", PropList),
  },
  [`POST ${ITEM}/props`]: {
    tag: "Props",
    summary: "Add a prop to an item",
    description:
      "Each role must be one of the item's, each carrier in one of those roles, and there can be no more carriers than the quantity.",
    request: PropDetails,
    success: created("The new prop.", Prop),
    refusals: {
      "400": plain("The body doesn't fit the schema, or names a role or carrier not in the item."),
      "404": NOT_IN_ORDER,
    },
  },
  [`PUT ${PRODUCTION}/props/{propId}`]: {
    tag: "Props",
    summary: "Replace a prop's name, quantity, roles and carriers",
    request: PropDetails,
    success: ok("The updated prop.", Prop),
    refusals: {
      "400": plain("The body doesn't fit the schema, or names a role or carrier not in the item."),
      "404": plain("No such prop."),
    },
  },
  [`DELETE ${PRODUCTION}/props/{propId}`]: {
    tag: "Props",
    summary: "Remove a prop for good",
    success: noContent("Removed."),
    refusals: { "404": plain("No such prop.") },
  },
  [`GET ${PRODUCTION}/props-notes`]: listNotes("props"),
  [`PUT ${ITEM}/props-notes`]: saveNotes("props"),
  [`GET ${ITEM}/scenery-files`]: listFiles("scenery"),
  [`GET ${ITEM}/scenery-file-link`]: fileLink("scenery"),
  [`DELETE ${ITEM}/scenery-files`]: removeFile("scenery"),
  [`POST ${ITEM}/scenery-uploads`]: uploadFile("scenery"),
  [`GET ${PRODUCTION}/scenery-file-counts`]: countFiles("scenery"),
  [`GET ${PRODUCTION}/scenery-notes`]: listNotes("scenery"),
  [`PUT ${ITEM}/scenery-notes`]: saveNotes("scenery"),
  [`GET ${ITEM}/sfx-files`]: listFiles("sfx"),
  [`GET ${ITEM}/sfx-file-link`]: fileLink("sfx"),
  [`DELETE ${ITEM}/sfx-files`]: removeFile("sfx"),
  [`POST ${ITEM}/sfx-uploads`]: uploadFile("sfx"),
  [`GET ${PRODUCTION}/sfx-file-counts`]: countFiles("sfx"),
  [`GET ${PRODUCTION}/sfx-notes`]: listNotes("sfx"),
  [`PUT ${ITEM}/sfx-notes`]: saveNotes("sfx"),
  [`GET ${ITEM}/wardrobe-files`]: listFiles("wardrobe"),
  [`GET ${ITEM}/wardrobe-file-link`]: fileLink("wardrobe"),
  [`DELETE ${ITEM}/wardrobe-files`]: removeFile("wardrobe"),
  [`POST ${ITEM}/wardrobe-uploads`]: uploadFile("wardrobe"),
  [`GET ${PRODUCTION}/wardrobe-file-counts`]: countFiles("wardrobe"),
  [`GET ${PRODUCTION}/wardrobe-notes`]: listNotes("wardrobe"),
  [`PUT ${ITEM}/wardrobe-notes`]: saveNotes("wardrobe"),
  [`GET ${PRODUCTION}/costumes`]: {
    tag: "Costumes",
    summary: "What everyone wears in every item",
    success: ok(
      "The costumes, in no particular order. A row nobody has filled in isn't listed.",
      CostumeList,
    ),
  },
  [`PUT ${ITEM}/costumes`]: {
    tag: "Costumes",
    summary: "Save what one cast member wears in one of the item's roles",
    description: "All three fields are saved together; emptying all three removes the row.",
    request: SaveCostumeRequest,
    success: ok("The saved costume.", Costume),
    refusals: {
      "400": plain(
        "The body doesn't fit the schema, the role isn't in the item, or the cast member isn't in the role.",
      ),
      "404": NOT_IN_ORDER,
    },
  },
  [`GET ${PRODUCTION}/mic-plot`]: {
    tag: "Mic plot",
    summary: "Every item's mic channels",
    success: ok("The mic plot. An item with no channels given out may be left out.", MicPlotList),
  },
  [`PUT ${ITEM}/mic-plot`]: {
    tag: "Mic plot",
    summary: "Give a channel to someone cast in the item, or free it",
    description: "Send castMemberId null to free the channel.",
    request: AllocateMicRequest,
    success: ok("The item's mic plot.", ItemMicPlot),
    refusals: {
      "400": plain(
        "The body doesn't fit the schema, the person isn't cast in the item, or the channel can't be given to them: someone else had it in the item before, in the same half, or it was kept against that rule and can only be cleared.",
      ),
      "404": NOT_IN_ORDER,
      "409": {
        description: "They're already on another of the item's channels: the plot as it is now.",
        body: ItemMicPlot,
      },
    },
  },
  [`GET ${PRODUCTION}/mic-plot-notes`]: listNotes("mic-plot"),
  [`PUT ${ITEM}/mic-plot-notes`]: saveNotes("mic-plot"),
  "POST /api/usage": {
    tag: "Usage",
    summary: "Record one thing the caller did",
    description: "Who comes from the sign-in, never the body.",
    request: RecordUsageRequest,
    success: noContent("Recorded."),
    refusals: { "400": NOT_VALID, "403": plain("The token names no username.") },
  },
  "GET /api/usage": {
    tag: "Usage",
    summary: "Who has used the app, and how, in a period",
    query: {
      days: {
        schema: UsageQuery.shape.days,
        required: false,
        description: "How many days back.",
      },
    },
    success: ok("The summary.", UsageSummary),
    refusals: { "400": plain("days isn't 7, 30 or 90.") },
  },
};
