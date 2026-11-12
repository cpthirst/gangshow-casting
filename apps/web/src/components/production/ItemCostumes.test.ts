import { enableAutoUnmount, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import {
  aCastMember,
  aRole,
  captainHook,
  pirateCast,
  pirates,
  smee,
} from "@/utils/casting.fixture.ts";
import ItemCostumes from "./ItemCostumes.vue";

enableAutoUnmount(afterEach);

const openCostumes = (roles = [captainHook(), pirates], itemId = "opening-number") =>
  mount(ItemCostumes, { props: { roles, cast: pirateCast, itemId } });

/** Each row as read: the role, then who wears it or the uncast marker. */
const rows = (wrapper: VueWrapper) =>
  wrapper.findAll("[data-test=costume]").map((row) => row.text().replace(/\s+/g, " "));

describe("An item's Costumes section", () => {
  it("is a section named by its heading", () => {
    const wrapper = openCostumes();

    expect(wrapper.get("section").attributes("aria-labelledby")).toBe(
      wrapper.get("h2").attributes("id"),
    );
  });

  it("lists a row per cast member in each role, with the role's name and the cast member's", () => {
    const wrapper = openCostumes();

    expect(rows(wrapper)).toEqual([
      "Captain Hook (Alex Morgan)",
      "Pirates (Jo Brown)",
      "Pirates (Kim Lee)",
      "Pirates (Sam Patel)",
    ]);
  });

  it("gives an uncast role one row marked Uncast, with no cast member and nothing to edit", () => {
    const wrapper = openCostumes([smee]);

    const row = wrapper.get("[data-test=costume]");
    expect(row.get("[data-test=role-name]").text()).toBe("Smee");
    expect(row.get("[data-test=uncast]").text()).toBe("Uncast");
    expect(row.find("[data-test=cast]").exists()).toBe(false);
    expect(row.find("button").exists()).toBe(false);
    expect(rows(wrapper)).toHaveLength(1);
  });

  it("says nobody is cast in the item yet when it has no roles, and lists no rows", () => {
    const wrapper = openCostumes([captainHook()], "interval-music");

    expect(wrapper.get("[data-test=no-costumes]").text()).toBe("Nobody is cast in this item yet.");
    expect(rows(wrapper)).toEqual([]);
  });

  it("shows a name as text, never as markup", () => {
    const marked = aCastMember(9, { firstName: "<b>Jo", lastName: "Brown" });
    const wrapper = mount(ItemCostumes, {
      props: {
        roles: [aRole(9, "opening-number", [marked.id], { name: "<i>Hook" })],
        cast: [marked],
        itemId: "opening-number",
      },
    });

    expect(rows(wrapper)).toEqual(["<i>Hook (<b>Jo Brown)"]);
    expect(wrapper.find("[data-test=costume] b, [data-test=costume] i").exists()).toBe(false);
  });
});
