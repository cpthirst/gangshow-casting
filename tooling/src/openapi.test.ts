import { readFileSync } from "node:fs";
import { departments, FolderId, needOf, routeKeys } from "@app/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { openApiSpec, renderedSpec, SPEC_FILE } from "./openapi.ts";

const spec = openApiSpec();
const { paths } = spec;

const route = (key: string) => {
  const [method = "", path = ""] = key.split(" ");
  const operation = paths[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`The spec has no ${key}`);
  return operation;
};

const documented = Object.entries(paths).flatMap(([path, methods]) =>
  Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
);

const refsIn = (value: unknown): string[] => {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) =>
    key === "$ref" && typeof inner === "string" ? [inner] : refsIn(inner),
  );
};

describe("the API's OpenAPI description", () => {
  it.each(routeKeys)("documents %s", (key) => {
    expect(route(key).summary).toBeTruthy();
  });

  it("documents only the route list and the public sign-in settings", () => {
    expect(documented.toSorted()).toEqual([...routeKeys, "GET /config.json"].toSorted());
  });

  it("matches the committed file, which pnpm api:spec rewrites", () => {
    const committed = readFileSync(new URL(`../../${SPEC_FILE}`, import.meta.url), "utf8");
    expect(committed).toBe(renderedSpec());
  });

  it("asks for the team's sign-in on every API route, and nowhere says otherwise", () => {
    expect(spec.security).toEqual([{ teamSignIn: [] }]);
    const open = documented.filter((key) => route(key).security?.length === 0);
    expect(open).toEqual(["GET /config.json"]);
  });

  it.each(routeKeys)("answers 401 to %s without a token", (key) => {
    expect(route(key).responses["401"]).toBeDefined();
  });

  it.each(routeKeys)("declares every path parameter of %s", (key) => {
    const declared = (route(key).parameters ?? []).filter(({ in: place }) => place === "path");
    const named = [...key.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
    expect(declared.map(({ name }) => name)).toEqual(named);
    expect(declared.every(({ required }) => required)).toBe(true);
  });

  it("resolves every reference", () => {
    const schemas = Object.keys(spec.components.schemas);
    const responses = Object.keys(spec.components.responses);
    const known = [
      ...schemas.map((name) => `#/components/schemas/${name}`),
      ...responses.map((name) => `#/components/responses/${name}`),
    ];
    expect([...new Set(refsIn(spec))].filter((ref) => !known.includes(ref))).toEqual([]);
  });

  it("takes who may use each route from the shared permissions", () => {
    const wrong = routeKeys.filter((key) => {
      const { who, anyOf } = route(key)["x-permission"];
      const need = needOf(key);
      const expected = need && need !== "admin" ? departments[need].permissions : undefined;
      return !who || JSON.stringify(anyOf) !== JSON.stringify(expected);
    });
    expect(wrong).toEqual([]);
    expect(route("GET /config.json")["x-permission"].anyOf).toBeUndefined();
  });

  it("answers 404 on every item route, for an item id that isn't well formed", () => {
    const items = routeKeys.filter((key) => key.includes("{itemId}"));
    const notFound = (key: string) => JSON.stringify(route(key).responses["404"] ?? "");
    expect(items.filter((key) => !/item id/i.test(notFound(key)))).toEqual([]);
  });

  it("holds a file route's item id to the shared folder-id rule", () => {
    const { $schema: _dialect, ...folderId } = z.toJSONSchema(FolderId);
    const files = routeKeys.filter((key) => /\{itemId\}\/\w+-(files|file-link|uploads)$/.test(key));
    expect(files).not.toEqual([]);
    for (const key of files) {
      const itemId = route(key).parameters?.find(({ name }) => name === "itemId");
      expect(itemId?.schema).toEqual(folderId);
    }
  });

  it("never uses one schema as both a request and a response", () => {
    const sent = new Set(refsIn(documented.map((key) => route(key).requestBody)));
    const answered = refsIn(documented.map((key) => route(key).responses));
    expect(answered.filter((ref) => sent.has(ref))).toEqual([]);
  });

  it("describes both refusals of a department's change", () => {
    const refused = route("PUT /api/productions/{productionId}/props/{propId}").responses["403"];
    expect(JSON.stringify(refused)).toContain("PastProductionRefusal");
    expect(JSON.stringify(refused)).toContain("DepartmentRefusal");
  });

  it("doesn't call a read refused for a past production", () => {
    expect(route("GET /api/productions/{productionId}/props").responses["403"]).toBeUndefined();
  });

  it("gives the success and refusals a handler answers", () => {
    const removeRole = route("DELETE /api/productions/{productionId}/roles/{roleId}");
    expect(Object.keys(removeRole.responses).toSorted()).toEqual([
      "204",
      "400",
      "401",
      "403",
      "404",
      "409",
    ]);
    expect(removeRole.requestBody).toBeUndefined();
    expect(removeRole.parameters?.map(({ name }) => name)).toContain("revision");
  });

  it("keeps a request's defaulted fields optional and a response's required", () => {
    const { schemas } = spec.components;
    expect(schemas.PropDetails?.required).toEqual(["name"]);
    expect(schemas.Prop?.required).toContain("quantity");
  });

  it("gives the export a file, not JSON", () => {
    const exported = route("POST /api/productions/{productionId}/casting-grid/export");
    expect(exported.responses["200"]).toHaveProperty([
      "content",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
  });
});
