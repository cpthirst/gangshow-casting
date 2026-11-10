// `pnpm api:spec`: writes docs/api/openapi.json from the shared route list, permissions and
// zod schemas, and the per-route notes in openapi-routes.ts. A test in the gate fails when the
// committed file differs from this file's output.
import { writeFileSync } from "node:fs";
import * as shared from "@app/shared";
import {
  CastMember,
  departments,
  isChangeWithinProduction,
  needOf,
  PastProductionRefusal,
  ProductionId,
  Prop,
  Role,
  type RouteKey,
  RunningOrderItem,
  routeKeys,
  SignInConfig,
  Username,
} from "@app/shared";
import { z } from "zod";
import {
  DepartmentRefusal,
  Message,
  type Refusal,
  type RouteDoc,
  routeDocs,
} from "./openapi-routes.ts";

export const SPEC_FILE = "docs/api/openapi.json";

type JsonSchema = Record<string, unknown> & { required?: string[] };

interface Response {
  description: string;
  content?: Record<string, unknown>;
}

interface Parameter {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  schema: unknown;
}

interface Permission {
  who: string;
  anyOf?: string[];
}

interface Operation {
  tags?: string[];
  summary: string;
  description?: string;
  security?: unknown[];
  "x-permission": Permission;
  parameters?: Parameter[];
  requestBody?: unknown;
  responses: Record<string, Response | { $ref: string }>;
}

const SCHEMAS = "#/components/schemas/";
const ref = (name: string) => ({ $ref: `${SCHEMAS}${name}` });
const json = (schema: unknown) => ({ "application/json": { schema } });

// Every named schema, so a component takes the name its export already has.
const named = new Map<unknown, string>(
  Object.entries({ ...shared, DepartmentRefusal, Message })
    .filter(([, value]) => value instanceof z.ZodType)
    .map(([name, schema]) => [schema, name]),
);

function nameOf(schema: z.ZodType) {
  const name = named.get(schema);
  if (name === undefined) throw new Error("A documented schema isn't exported by @app/shared");
  return name;
}

const docs = Object.values(routeDocs);
const refusalBodies = docs.flatMap(({ refusals = {} }) =>
  Object.values(refusals).flatMap(({ body }) => (body ? [body] : [])),
);
const requests = new Set(docs.flatMap(({ request }) => (request ? [request] : [])));
const responses = new Set([
  ...docs.flatMap(({ success }) => (success.body ? [success.body] : [])),
  ...refusalBodies,
  PastProductionRefusal,
  DepartmentRefusal,
  Message,
  SignInConfig,
]);

const options = (io: "input" | "output") =>
  ({
    io,
    target: "draft-2020-12",
    unrepresentable: "any",
    uri: (id: string) => `${SCHEMAS}${id}`,
    override({ jsonSchema }) {
      // Zod's date-time regex says nothing the format doesn't; its integer cap isn't a rule.
      if (jsonSchema.format === "date-time") delete jsonSchema.pattern;
      if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) delete jsonSchema.maximum;
      // Each half of an intersection carries properties the other forbids otherwise.
      for (const part of jsonSchema.allOf ?? []) delete part.additionalProperties;
    },
  }) satisfies Parameters<typeof z.toJSONSchema>[1];

/** Each schema with a name, for one side of the conversation: a request's defaults are
 *  optional, a response's are always there. */
function componentsFor(io: "input" | "output") {
  const registry = z.registry<{ id: string }>();
  for (const schema of new Set([...requests, ...responses])) {
    registry.add(schema, { id: nameOf(schema) });
  }
  return z.toJSONSchema(registry, options(io)).schemas;
}

function schemaComponents() {
  const sent = componentsFor("input");
  const answered = componentsFor("output");
  const requestNames = new Set([...requests].map(nameOf));
  const entries = Object.keys(answered)
    .toSorted()
    .map((name): [string, JsonSchema] => {
      const {
        $schema: _dialect,
        $id: _id,
        ...schema
      } = requestNames.has(name) ? (sent[name] ?? {}) : (answered[name] ?? {});
      return [name, schema];
    });
  return Object.fromEntries(entries);
}

const inlineSchema = (schema: z.ZodType) => {
  const { $schema: _dialect, ...plain } = z.toJSONSchema(schema, options("input"));
  return plain;
};

const pathSchemas: Record<string, z.ZodType> = {
  productionId: ProductionId,
  itemId: RunningOrderItem.shape.id,
  castId: CastMember.shape.id,
  roleId: Role.shape.id,
  propId: Prop.shape.id,
  username: Username,
};

function pathParameters(path: string, doc: RouteDoc): Parameter[] {
  return [...path.matchAll(/\{(\w+)\}/g)].flatMap(([, name = ""]) => {
    const schema = (name === "itemId" && doc.itemId) || pathSchemas[name];
    if (!schema) throw new Error(`No schema for the path parameter ${name}`);
    return [{ name, in: "path", required: true, schema: inlineSchema(schema) }];
  });
}

function queryParameters({ query = {} }: RouteDoc): Parameter[] {
  return Object.entries(query).map(([name, { schema, required, description }]) => ({
    name,
    in: "query",
    required,
    description,
    schema: inlineSchema(schema),
  }));
}

function permissionOf(key: string): Permission {
  const need = needOf(key);
  if (need === undefined) return { who: "anyone signed in" };
  if (need === "admin") return { who: "admins" };
  return {
    who: "admins, or any of these permissions",
    anyOf: [...departments[need].permissions],
  };
}

const needsLine = ({ who, anyOf }: Permission) =>
  `**Needs:** ${who}${anyOf ? `: ${anyOf.join(", ")}` : ""}.`;

/** A response standing for several refusals of one status. */
function responseOf(refusals: Refusal[]): Response {
  const bodies = [...new Set(refusals.flatMap(({ body }) => (body ? [ref(nameOf(body))] : [])))];
  const description = refusals.map((refusal) => refusal.description).join(" Or: ");
  const [only] = bodies;
  if (only === undefined) return { description };
  return {
    description: refusals.some(({ body }) => !body)
      ? `${description} Some have no body.`
      : description,
    content: json(bodies.length === 1 ? only : { oneOf: bodies }),
  };
}

function refusalsOf(key: RouteKey, doc: RouteDoc): Refusal[] {
  const list: Refusal[] = [];
  if (isChangeWithinProduction(key)) {
    list.push({
      description:
        "The production isn't the newest. Past productions are view only, for admins too.",
      body: PastProductionRefusal,
    });
  }
  const need = needOf(key);
  if (need === "admin") list.push({ description: "Only admins can do this.", body: Message });
  else if (need) {
    list.push({
      description: "The caller has no permission for this department.",
      body: DepartmentRefusal,
    });
  }
  const own = doc.refusals?.["403"];
  if (own) list.push(own);
  return list;
}

function responsesOf(key: RouteKey, doc: RouteDoc) {
  const { success, refusals = {} } = doc;
  const responses: Operation["responses"] = {};
  const content = success.body
    ? json(ref(nameOf(success.body)))
    : success.file
      ? { [success.file]: { schema: { type: "string", format: "binary" } } }
      : undefined;
  responses[success.status] = { description: success.description, ...(content ? { content } : {}) };
  responses[401] = { $ref: "#/components/responses/Unauthorized" };
  const notFound: Refusal[] = [
    ...(key.includes("{productionId}")
      ? [{ description: "The production id isn't well formed." }]
      : []),
    ...(key.includes("{itemId}") ? [{ description: "The item id isn't well formed." }] : []),
    ...(refusals["404"] ? [refusals["404"]] : []),
  ];
  const byStatus: [string, Refusal[]][] = [
    ["400", refusals["400"] ? [refusals["400"]] : []],
    ["403", refusalsOf(key, doc)],
    ["404", notFound],
    ["409", refusals["409"] ? [refusals["409"]] : []],
  ];
  for (const [status, list] of byStatus) {
    if (list.length > 0) responses[status] = responseOf(list);
  }
  return responses;
}

function operationOf(key: RouteKey, path: string): Operation {
  const doc = routeDocs[key];
  const permission = permissionOf(key);
  const parameters = [...pathParameters(path, doc), ...queryParameters(doc)];
  return {
    tags: [doc.tag],
    summary: doc.summary,
    description: [needsLine(permission), doc.description].filter(Boolean).join(" "),
    "x-permission": permission,
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(doc.request
      ? { requestBody: { required: true, content: json(ref(nameOf(doc.request))) } }
      : {}),
    responses: responsesOf(key, doc),
  };
}

function apiPaths() {
  const paths: Record<string, Record<string, Operation>> = {};
  for (const key of routeKeys) {
    const [method = "", path = ""] = key.split(" ");
    paths[path] = { ...paths[path], [method.toLowerCase()]: operationOf(key, path) };
  }
  return paths;
}

// Static, not an API route: the pages read it before anyone can sign in, and it holds only
// the public settings a sign-in page needs.
const signInSettings: Operation = {
  tags: ["Sign-in"],
  summary: "The public settings the pages need to start signing in",
  description: "A static file written by the deploy, beside the pages. It needs no token.",
  security: [],
  "x-permission": { who: "anyone" },
  responses: { 200: { description: "The settings.", content: json(ref("SignInConfig")) } },
};

export function openApiSpec() {
  const paths: Record<string, Record<string, Operation>> = {
    ...apiPaths(),
    "/config.json": { get: signInSettings },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "iCUE API",
      // The release isn't stated, or the spec would change on every release:
      // GET /api/health reports the running one.
      version: "see GET /api/health",
      description:
        "The Chester Gang Show's show management API. Generated from the code by `pnpm api:spec`: see docs/api/README.md. Every /api route needs the team's sign-in token.",
    },
    servers: [{ url: "/", description: "The app's own address" }],
    security: [{ teamSignIn: [] }],
    paths,
    components: {
      securitySchemes: {
        teamSignIn: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "An access token from the team's Cognito user pool, sent as `Authorization: Bearer <token>`. It lasts 5 minutes. Its `cognito:groups` claim says what the account may do, and its `username` claim who they are.",
        },
      },
      responses: {
        Unauthorized: {
          description: "No valid token. Answered by API Gateway, before the API runs.",
          content: json(ref("Message")),
        },
      },
      schemas: schemaComponents(),
    },
  };
}

/** The spec as the committed file holds it. */
export const renderedSpec = () => `${JSON.stringify(openApiSpec(), null, 2)}\n`;

if (import.meta.main) {
  writeFileSync(new URL(`../../${SPEC_FILE}`, import.meta.url), renderedSpec());
}
