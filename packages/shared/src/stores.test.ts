import { describe, expect, it } from "vitest";
import { mayChangeStore, storeIds, storeOf, stores, storeTitle } from "./stores.ts";

describe("the stores", () => {
  it("are Scenery's, Props' and Wardrobe's, in that order, each titled by its department", () => {
    expect(storeIds.map(storeTitle)).toEqual(["Scenery stores", "Props stores", "Wardrobe stores"]);
  });

  it.each(["sfx", "mic-plot", "../scenery", undefined])("have none for %j", (id) => {
    expect(storeOf(id)).toBeUndefined();
  });

  it("are each changed by their own department's permission, never Director's or Tech's", () => {
    const changers = (store: (typeof storeIds)[number]) =>
      (["casting", "stage", "tech", "wardrobe", "director"] as const).filter((permission) =>
        mayChangeStore([permission], store),
      );

    expect(storeIds.map(changers)).toEqual([["stage"], ["stage"], ["wardrobe"]]);
    expect(storeIds.every((store) => mayChangeStore("admin", store))).toBe(true);
    expect(mayChangeStore([], "scenery")).toBe(false);
  });

  it("each state the rule against photos of cast members (ADR 0010)", () => {
    expect(storeIds.map((store) => stores[store].uploadRule)).toEqual([
      "Scenery and set images only: no photos of cast members.",
      "Props images only: no photos of cast members.",
      "Costume designs and images only: no photos of cast members.",
    ]);
  });
});
