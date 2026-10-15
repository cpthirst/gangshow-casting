import { CastMember } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import { createUpdateCastMember } from "./update-cast-member.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const changes = {
  firstName: "Sam",
  lastName: "Example",
  section: "explorers",
  group: "Riverside ESU",
};

const request = (castId: string, body: unknown, productionId = "2027") => ({
  pathParameters: { productionId, castId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function setUp() {
  const store = inMemoryCastStore([aCastList([aCastMember(12, { revision: 4 })])]);
  return { store, handler: createUpdateCastMember(store) };
}

const member12 = async (store: ReturnType<typeof setUp>["store"]) =>
  (await store.list("2027"))?.members.find((m) => m.id === 12);

describe("update cast member handler", () => {
  it("returns 200 with the updated member at the next revision", async () => {
    const { store, handler } = setUp();

    const res = await handler(request("12", { ...changes, revision: 4 }));

    expect(res.statusCode).toBe(200);
    expect(CastMember.parse(JSON.parse(res.body ?? ""))).toEqual({
      ...changes,
      id: 12,
      revision: 5,
    });
    expect((await member12(store))?.section).toBe("explorers");
  });

  it("returns 409 for a stale revision, saving nothing", async () => {
    const { store, handler } = setUp();

    expect((await handler(request("12", { ...changes, revision: 3 }))).statusCode).toBe(409);
    expect((await member12(store))?.revision).toBe(4);
  });

  it.each([
    ["an unknown member", request("99", { ...changes, revision: 1 })],
    ["a production with no cast list", request("12", { ...changes, revision: 4 }, "1999")],
  ])("returns 404 for %s, saving nothing", async (_case, event) => {
    const { store, handler } = setUp();

    expect((await handler(event)).statusCode).toBe(404);
    expect(await member12(store)).toEqual(aCastMember(12, { revision: 4 }));
  });

  it.each([
    ["an empty last name", request("12", { ...changes, lastName: "", revision: 4 })],
    ["a changed id", request("12", { ...changes, id: 99, revision: 4 })],
    ["no revision", request("12", changes)],
    ["a non-numeric cast id", request("twelve", { ...changes, revision: 4 })],
    ["malformed JSON", request("12", "{not json")],
  ])("returns 400 for %s, saving nothing", async (_case, event) => {
    const { store, handler } = setUp();

    expect((await handler(event)).statusCode).toBe(400);
    expect((await member12(store))?.revision).toBe(4);
  });
});
