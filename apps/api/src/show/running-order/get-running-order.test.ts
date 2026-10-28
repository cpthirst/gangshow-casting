import { RunningOrder } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createGetRunningOrder } from "./get-running-order.ts";
import { aRunningOrder } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";

const request = (productionId: string) => ({ pathParameters: { productionId } });

describe("GET running order handler", () => {
  it("returns 200 with the latest version, satisfying the shared schema", async () => {
    const handler = createGetRunningOrder(
      inMemoryRunningOrderStore([aRunningOrder(5), aRunningOrder(6)]),
    );

    const res = await handler(request("2027"));

    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(RunningOrder.parse(JSON.parse(res.body ?? "")).version).toBe(6);
  });

  it("returns 404 for a production with nothing stored", async () => {
    const handler = createGetRunningOrder(inMemoryRunningOrderStore([aRunningOrder(6)]));

    const res = await handler(request("1999"));

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for a malformed production id", async () => {
    const handler = createGetRunningOrder(inMemoryRunningOrderStore());

    const res = await handler(request("../etc"));

    expect(res.statusCode).toBe(404);
  });
});
