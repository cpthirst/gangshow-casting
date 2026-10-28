import { describe } from "vitest";
import { behavesAsAUsageStore } from "./usage-store.contract.ts";
import { inMemoryUsageStore } from "./usage-store.ts";

describe("in-memory usage store", () => {
  behavesAsAUsageStore(inMemoryUsageStore);
});
