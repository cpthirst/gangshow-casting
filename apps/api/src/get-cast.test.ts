import { CastList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import { createGetCast } from "./get-cast.ts";

const request = (productionId: string) => ({ pathParameters: { productionId } });

describe("GET cast handler", () => {
  it("returns 200 with the production's cast, satisfying the shared schema", async () => {
    const handler = createGetCast(inMemoryCastStore([aCastList([aCastMember(1), aCastMember(2)])]));

    const res = await handler(request("2027"));

    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(CastList.parse(JSON.parse(res.body ?? "")).members).toHaveLength(2);
  });

  it("returns 404 for a production with no cast", async () => {
    const handler = createGetCast(inMemoryCastStore([aCastList([aCastMember(1)])]));

    expect((await handler(request("1999"))).statusCode).toBe(404);
  });

  it("returns 404 for a malformed production id", async () => {
    const handler = createGetCast(inMemoryCastStore());

    expect((await handler(request("../etc"))).statusCode).toBe(404);
  });
});
