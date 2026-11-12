import { type Costume, SaveCostumeRequest } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json } from "@/app.fixture.ts";
import { saveCostumePath } from "@/services/production.ts";
import {
  aCastMember,
  alexMorgan,
  aRole,
  captainHook,
  pirateCast,
  pirates,
  smee,
} from "@/utils/casting.fixture.ts";
import { alexAsHook, costumeFieldsOf, costumeFormField } from "@/utils/costumes.fixture.ts";
import ItemCostumes from "./ItemCostumes.vue";

enableAutoUnmount(afterEach);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** A stand-in API that saves each costume sent, or answers with the response given. Every
 *  save's body is recorded as sent, before it is read. */
function apiSaves(answer?: () => Promise<Response>) {
  const saves: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== saveCostumePath("opening-number") || init?.method !== "PUT") {
        return new Response(null, { status: 404 });
      }
      saves.push(JSON.parse(String(init.body)));
      const sent = SaveCostumeRequest.parse(JSON.parse(String(init.body)));
      return answer ? answer() : json({ itemId: "opening-number", ...sent });
    }),
  );
  return saves;
}

const openCostumes = ({
  roles = [captainHook(), pirates],
  itemId = "opening-number",
  costumes = [] as Costume[],
  canChange = true,
} = {}) => {
  const wrapper: VueWrapper = mount(ItemCostumes, {
    props: {
      roles,
      cast: pirateCast,
      itemId,
      costumes,
      canChange,
      "onUpdate:costumes": (saved: Costume[]) => wrapper.setProps({ costumes: saved }),
    },
    attachTo: document.body,
  });
  return wrapper;
};

/** Each row as read: the role, then who wears it or the uncast marker. */
const rows = (wrapper: VueWrapper) =>
  wrapper.findAll("[data-test=costume]").map((row) => row.text().replace(/\s+/g, " "));

/** A cast row, or its form while in edit, found by whose it is. */
const rowOf = (wrapper: VueWrapper, name: string) => {
  const row = wrapper
    .findAll("[data-test=costume]")
    .find((found) => found.find(`[aria-label="Edit ${name}"]`).exists());
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

const pencil = (wrapper: VueWrapper, name: string) =>
  wrapper.get(`button[aria-label="Edit ${name}"]`);

const formOf = (wrapper: VueWrapper) => wrapper.get("form");

/** A field of the open form, by its label. */
const fieldLabelled = (wrapper: VueWrapper, label: string) =>
  costumeFormField(formOf(wrapper), label);

async function editAlex(wrapper: VueWrapper) {
  await pencil(wrapper, "Alex Morgan as Captain Hook").trigger("click");
}

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
    const wrapper = openCostumes({ roles: [smee] });

    const row = wrapper.get("[data-test=costume]");
    expect(row.get("[data-test=role-name]").text()).toBe("Smee");
    expect(row.get("[data-test=uncast]").text()).toBe("Uncast");
    expect(row.find("[data-test=cast]").exists()).toBe(false);
    expect(row.find("button").exists()).toBe(false);
    expect(rows(wrapper)).toHaveLength(1);
  });

  it("says nobody is cast in the item yet when it has no roles, and lists no rows", () => {
    const wrapper = openCostumes({ roles: [captainHook()], itemId: "interval-music" });

    expect(wrapper.get("[data-test=no-costumes]").text()).toBe("Nobody is cast in this item yet.");
    expect(rows(wrapper)).toEqual([]);
  });

  it("shows names and costume text as text, never as markup", () => {
    const marked = aCastMember(9, { firstName: "<b>Jo", lastName: "Brown" });
    const role = aRole(9, "opening-number", [marked.id], { name: "<i>Hook" });
    const wrapper = mount(ItemCostumes, {
      props: {
        roles: [role],
        cast: [marked],
        itemId: "opening-number",
        costumes: [{ ...alexAsHook, roleId: 9, castMemberId: 9, fromWardrobe: "<s>Coat" }],
        canChange: false,
      },
    });

    expect(rows(wrapper)[0]).toContain("<i>Hook (<b>Jo Brown)");
    expect(rows(wrapper)[0]).toContain("<s>Coat");
    expect(wrapper.find("[data-test=costume] b, [data-test=costume] i, s").exists()).toBe(false);
  });

  describe("each row's fields", () => {
    it("shows From Wardrobe, From Cast Member and Notes with the row's text", () => {
      const wrapper = openCostumes({ costumes: [alexAsHook], canChange: false });

      expect(costumeFieldsOf(wrapper.get("[data-test=costume]"))).toEqual([
        ["From Wardrobe", "Red coat, hook"],
        ["From Cast Member", "Black shoes"],
        ["Notes", "Hem the coat"],
      ]);
    });

    it("shows only the role and name for a row nobody has filled in, and leaves out an empty field", () => {
      const wrapper = openCostumes({
        costumes: [{ ...alexAsHook, fromCastMember: "", notes: "" }],
      });

      expect(rows(wrapper)[1]).toBe("Pirates (Jo Brown)");
      expect(costumeFieldsOf(rowOf(wrapper, "Alex Morgan as Captain Hook"))).toEqual([
        ["From Wardrobe", "Red coat, hook"],
      ]);
    });
  });

  describe("changing a row", () => {
    it("gives every cast row a pencil, named for whose row it is, when the viewer can change costumes", () => {
      const wrapper = openCostumes({ roles: [captainHook(), pirates, smee] });

      expect(wrapper.findAll("[data-test=costume] button[data-test=edit]")).toHaveLength(4);
      expect(wrapper.find('button[aria-label="Edit Jo Brown as Pirates"]').exists()).toBe(true);
    });

    it("gives no pencils to someone who can't change costumes", () => {
      const wrapper = openCostumes({ canChange: false });

      expect(wrapper.find("button").exists()).toBe(false);
    });

    it("turns the row into one form for all three fields, holding its text, with the first field focused", async () => {
      const wrapper = openCostumes({ costumes: [alexAsHook] });

      await editAlex(wrapper);

      const form = formOf(wrapper);
      expect(form.attributes("aria-label")).toBe("Edit Alex Morgan as Captain Hook");
      expect(fieldLabelled(wrapper, "From Wardrobe").element.value).toBe("Red coat, hook");
      expect(fieldLabelled(wrapper, "From Cast Member").element.value).toBe("Black shoes");
      expect(fieldLabelled(wrapper, "Notes").element.value).toBe("Hem the coat");
      expect(form.findAll("button").map((button) => button.text())).toEqual(["Save", "Cancel"]);
      expect(document.activeElement).toBe(fieldLabelled(wrapper, "From Wardrobe").element);
    });

    it("says beside the fields that sizes and measurements don't go here", async () => {
      const wrapper = openCostumes();

      await editAlex(wrapper);

      expect(formOf(wrapper).get("[data-test=costume-rule]").text()).toBe(
        "Garments only: no sizes or measurements.",
      );
    });

    it("saves all three fields with one Save, showing it's saving, then the row's new text, and announces it", async () => {
      let answer: (res: Response) => void = () => {};
      const saves = apiSaves(() => new Promise((resolve) => (answer = resolve)));
      const wrapper = openCostumes();
      await editAlex(wrapper);

      await fieldLabelled(wrapper, "From Wardrobe").setValue("Red coat, hook");
      await fieldLabelled(wrapper, "From Cast Member").setValue("Black shoes");
      await fieldLabelled(wrapper, "Notes").setValue("Hem the coat");
      await formOf(wrapper).trigger("submit");

      expect(formOf(wrapper).get("button[type=submit]").attributes()).toHaveProperty("disabled");
      answer(json(alexAsHook));
      await flushPromises();

      expect(saves).toEqual([
        {
          roleId: alexAsHook.roleId,
          castMemberId: alexMorgan.id,
          fromWardrobe: "Red coat, hook",
          fromCastMember: "Black shoes",
          notes: "Hem the coat",
        },
      ]);
      expect(wrapper.find("form").exists()).toBe(false);
      expect(costumeFieldsOf(rowOf(wrapper, "Alex Morgan as Captain Hook"))).toEqual([
        ["From Wardrobe", "Red coat, hook"],
        ["From Cast Member", "Black shoes"],
        ["Notes", "Hem the coat"],
      ]);
      expect(wrapper.get("[role=status]").text()).toBe("Costume saved.");
      expect(wrapper.emitted("update:costumes")?.at(-1)).toEqual([[alexAsHook]]);
    });

    it("keeps the form, with what was typed, when a save fails", async () => {
      apiSaves(async () => new Response(null, { status: 500 }));
      const wrapper = openCostumes();
      await editAlex(wrapper);

      await fieldLabelled(wrapper, "Notes").setValue("Hem the coat");
      await formOf(wrapper).trigger("submit");
      await flushPromises();

      expect(fieldLabelled(wrapper, "Notes").element.value).toBe("Hem the coat");
      expect(formOf(wrapper).get("[role=alert]").text()).toBe(
        "Couldn't save the costume. Try again.",
      );
    });

    it.each([
      [
        "Cancel",
        (wrapper: VueWrapper) => formOf(wrapper).get("[data-test=cancel]").trigger("click"),
      ],
      [
        "Escape",
        (wrapper: VueWrapper) =>
          fieldLabelled(wrapper, "From Wardrobe").trigger("keydown", { key: "Escape" }),
      ],
    ])(
      "puts the row back unchanged on %s, saving nothing and focusing its pencil",
      async (_how, cancel) => {
        const saves = apiSaves();
        const wrapper = openCostumes({ costumes: [alexAsHook] });
        await editAlex(wrapper);
        await fieldLabelled(wrapper, "From Wardrobe").setValue("Blue coat");

        await cancel(wrapper);
        await flushPromises();

        expect(wrapper.find("form").exists()).toBe(false);
        expect(costumeFieldsOf(rowOf(wrapper, "Alex Morgan as Captain Hook"))[0]).toEqual([
          "From Wardrobe",
          "Red coat, hook",
        ]);
        expect(saves).toEqual([]);
        expect(document.activeElement).toBe(pencil(wrapper, "Alex Morgan as Captain Hook").element);
      },
    );

    it("keeps one row in edit at a time, dropping the other's unsaved typing", async () => {
      const wrapper = openCostumes({ costumes: [alexAsHook] });
      await editAlex(wrapper);
      await fieldLabelled(wrapper, "From Wardrobe").setValue("Blue coat");

      await pencil(wrapper, "Jo Brown as Pirates").trigger("click");

      expect(wrapper.findAll("form")).toHaveLength(1);
      expect(formOf(wrapper).attributes("aria-label")).toBe("Edit Jo Brown as Pirates");
      expect(costumeFieldsOf(rowOf(wrapper, "Alex Morgan as Captain Hook"))[0]).toEqual([
        "From Wardrobe",
        "Red coat, hook",
      ]);

      await editAlex(wrapper);

      expect(fieldLabelled(wrapper, "From Wardrobe").element.value).toBe("Red coat, hook");
    });

    it("says how many characters are left near the limit, under the field it counts", async () => {
      const wrapper = openCostumes();
      await editAlex(wrapper);
      const notes = fieldLabelled(wrapper, "Notes");

      await notes.setValue("x".repeat(451));

      const count = formOf(wrapper).get(`#${notes.attributes("aria-describedby")}`);
      expect(count.text()).toBe("49 characters left");
      expect(fieldLabelled(wrapper, "From Wardrobe").attributes()).not.toHaveProperty(
        "aria-describedby",
      );
    });

    it("refuses to save a field over 500 characters, keeping the text and saying so", async () => {
      const saves = apiSaves();
      const wrapper = openCostumes();
      await editAlex(wrapper);
      const tooLong = "x".repeat(501);

      await fieldLabelled(wrapper, "From Wardrobe").setValue(tooLong);
      await formOf(wrapper).trigger("submit");
      await flushPromises();

      const field = fieldLabelled(wrapper, "From Wardrobe");
      expect(field.element.value).toBe(tooLong);
      expect(field.attributes("aria-invalid")).toBe("true");
      const described = (field.attributes("aria-describedby") ?? "").split(" ");
      expect(described.map((id) => formOf(wrapper).get(`#${id}`).text())).toEqual([
        "1 character too many",
        "From Wardrobe can be up to 500 characters.",
      ]);
      expect(saves).toEqual([]);
    });
  });
});
