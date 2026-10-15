import { describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import { createDeleteCastMember } from "./delete-cast-member.ts";

const request = (castId: string, revision: string | undefined, productionId = "2027") => ({
  pathParameters: { productionId, castId },
  ...(revision === undefined ? {} : { queryStringParameters: { revision } }),
});

function setUp() {
  const store = inMemoryCastStore([aCastList([aCastMember(1), aCastMember(12, { revision: 4 })])]);
  return { store, handler: createDeleteCastMember(store) };
}

const ids = async (store: ReturnType<typeof setUp>["store"]) =>
  (await store.list("2027"))?.members.map((m) => m.id);

describe("delete cast member handler", () => {
  it("returns 204 and removes the member", async () => {
    const { store, handler } = setUp();

    const res = await handler(request("12", "4"));

    expect(res.statusCode).toBe(204);
    expect(res.body).toBeUndefined();
    expect(await ids(store)).toEqual([1]);
  });

  it("returns 409 for a stale revision, removing nothing", async () => {
    const { store, handler } = setUp();

    expect((await handler(request("12", "3"))).statusCode).toBe(409);
    expect(await ids(store)).toEqual([1, 12]);
  });

  it.each([
    ["an unknown member", request("99", "1")],
    ["a production with no cast list", request("12", "4", "1999")],
    ["a malformed production id", request("12", "4", "../etc")],
  ])("returns 404 for %s", async (_case, event) => {
    const { handler } = setUp();

    expect((await handler(event)).statusCode).toBe(404);
  });

  it.each([
    ["no revision", request("12", undefined)],
    ["a non-numeric revision", request("12", "four")],
    ["a non-numeric cast id", request("twelve", "4")],
  ])("returns 400 for %s, removing nothing", async (_case, event) => {
    const { store, handler } = setUp();

    expect((await handler(event)).statusCode).toBe(400);
    expect(await ids(store)).toEqual([1, 12]);
  });
});
