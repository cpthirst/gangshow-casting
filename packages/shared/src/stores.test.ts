import { describe, expect, it } from "vitest";
import { storeIds, storeOf, storeTitle } from "./stores.ts";

describe("the stores", () => {
  it("are Scenery's, Props' and Wardrobe's, in that order, each titled by its department", () => {
    expect(storeIds.map(storeTitle)).toEqual(["Scenery stores", "Props stores", "Wardrobe stores"]);
  });

  it.each(["sfx", "mic-plot", "../scenery", undefined])("have none for %j", (id) => {
    expect(storeOf(id)).toBeUndefined();
  });
});
