import type { CastMember, ItemGang } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import RoleForm from "./RoleForm.vue";

enableAutoUnmount(afterEach);

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const member = (id: number, lastName: string, section: CastMember["section"]): CastMember => ({
  id,
  firstName: "Sam",
  lastName,
  section,
  group: "",
  revision: 1,
});
const cast = [
  member(1, "Example", "cubs"),
  member(2, "Sample", "scouts"),
  member(3, "Newcomer", null),
];

function formFor(gang: ItemGang) {
  return mount(RoleForm, {
    props: {
      saving: false,
      error: "",
      taken: { itemTitle: "", names: [] },
      cast,
      inOtherRoles: [],
      gang,
    },
  });
}

async function offeredFor(wrapper: ReturnType<typeof formFor>, size: string, typed: string) {
  await wrapper.get("select[name=size]").setValue(size);
  await wrapper.get("input[name=castMember]").setValue(typed);
  await flushPromises();
  return wrapper.findAll("[role=option] .choice-name").map((name) => name.text());
}

describe("the role form's cast search", () => {
  it.each([
    ["junior", ["Sam Example"]],
    ["senior", ["Sam Newcomer", "Sam Sample"]],
    ["both", ["Sam Example", "Sam Newcomer", "Sam Sample"]],
  ] as const)("in a %s item, offers %j", async (gang, names) => {
    expect((await offeredFor(formFor(gang), "lead", "Sam")).sort()).toEqual(names);
  });

  it.each(["lead", "ensemble"])("follows the item's gang for a %s role", async (size) => {
    expect(await offeredFor(formFor("junior"), size, "Sam")).toEqual(["Sam Example"]);
  });

  it("adds only the item's gang with Add all cast", async () => {
    const wrapper = formFor("junior");
    await wrapper.get("select[name=size]").setValue("ensemble");

    await wrapper.get("[data-test=add-all-cast]").trigger("click");

    expect(wrapper.findAll("[data-test=member]").map((m) => m.text())).toEqual(["Sam Example"]);
  });
});
