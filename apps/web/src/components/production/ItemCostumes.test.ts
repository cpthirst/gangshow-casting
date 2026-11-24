import { type Costume, SaveCostumeRequest } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json } from "@/app.fixture.ts";
import {
  cancelConfirmation,
  confirmation,
  goAhead,
} from "@/components/common/ConfirmDialog.fixture.ts";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import { saveCostumePath } from "@/services/production.ts";
import {
  aCastMember,
  alexMorgan,
  aRole,
  captainHook,
  chrisEvans,
  joBrown,
  kimLee,
  pirateCast,
  pirates,
  sailors,
  samPatel,
  smee,
} from "@/utils/casting.fixture.ts";
import {
  alexAsHook,
  costumeFieldsOf,
  costumeFormField,
  costumeSavedFrom,
} from "@/utils/costumes.fixture.ts";
import { costumeCopiesOf, costumeRowsOf } from "@/utils/costumes.ts";
import ItemCostumes from "./ItemCostumes.vue";

enableAutoUnmount(afterEach);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** A stand-in API that saves each costume sent, or answers with the response given for its
 *  body. Every save's body is recorded as sent, before it is read. */
function apiSaves(answer?: (body: SaveCostumeRequest) => Promise<Response>) {
  const saves: SaveCostumeRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== saveCostumePath("opening-number") || init?.method !== "PUT") {
        return new Response(null, { status: 404 });
      }
      const body = SaveCostumeRequest.parse(JSON.parse(String(init.body)));
      saves.push(body);
      return answer ? answer(body) : json(costumeSavedFrom("opening-number", init.body));
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

  describe("following the casting", () => {
    it("shows a recast role's new cast member with empty fields, and the old one's text nowhere", () => {
      const wrapper = openCostumes({ roles: [captainHook(chrisEvans)], costumes: [alexAsHook] });

      expect(rows(wrapper)).toEqual(["Captain Hook (Chris Evans)"]);
      expect(wrapper.text()).not.toContain("Red coat, hook");
    });

    it("shows a cast member's text again when they're recast into the role", async () => {
      const wrapper = openCostumes({ roles: [captainHook(chrisEvans)], costumes: [alexAsHook] });

      await wrapper.setProps({ roles: [captainHook()] });

      expect(costumeFieldsOf(rowOf(wrapper, "Alex Morgan as Captain Hook"))[0]).toEqual([
        "From Wardrobe",
        "Red coat, hook",
      ]);
    });

    it("shows no rows for a role removed from the item", () => {
      const joAsPirate = {
        ...alexAsHook,
        roleId: pirates.id,
        castMemberId: joBrown.id,
        fromWardrobe: "Sash",
      };
      const wrapper = openCostumes({ roles: [captainHook()], costumes: [alexAsHook, joAsPirate] });

      expect(rows(wrapper)).toEqual([expect.stringMatching(/^Captain Hook \(Alex Morgan\)/)]);
      expect(wrapper.text()).not.toContain("Sash");
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
      // Save first and Cancel last; any copy buttons between are the copy tests'.
      const buttons = form.findAll("button").map((button) => button.text());
      expect([buttons[0], buttons.at(-1)]).toEqual(["Save", "Cancel"]);
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
          revision: 0,
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

    it("sends the revision the row was saved at, so a stale save can be refused", async () => {
      const saves = apiSaves();
      const wrapper = openCostumes({ costumes: [{ ...alexAsHook, revision: 3 }] });
      await editAlex(wrapper);

      await formOf(wrapper).trigger("submit");
      await flushPromises();

      expect(saves).toEqual([expect.objectContaining({ revision: 3 })]);
    });

    it("refuses a save someone else saved first, showing their text in the form to edit again", async () => {
      // Made-up: dee saved From Wardrobe "Blue coat" since kit opened the row.
      const blueCoat = { ...alexAsHook, fromWardrobe: "Blue coat", revision: 2 };
      apiSaves(async () => json(blueCoat, 409));
      const wrapper = openCostumes({ costumes: [alexAsHook] });
      await editAlex(wrapper);

      await fieldLabelled(wrapper, "From Wardrobe").setValue("Red coat, hook");
      await formOf(wrapper).trigger("submit");
      await flushPromises();

      expect(formOf(wrapper).get("[role=alert]").text()).toBe(
        "Someone else saved this costume first. Here it is now; your changes weren't saved.",
      );
      expect(fieldLabelled(wrapper, "From Wardrobe").element.value).toBe("Blue coat");
      expect(wrapper.emitted("update:costumes")?.at(-1)).toEqual([[blueCoat]]);

      const saves = apiSaves();
      await fieldLabelled(wrapper, "From Wardrobe").setValue("Blue coat, hook");
      await formOf(wrapper).trigger("submit");
      await flushPromises();

      expect(saves).toEqual([
        expect.objectContaining({ fromWardrobe: "Blue coat, hook", revision: 2 }),
      ]);
      expect(wrapper.find("form").exists()).toBe(false);
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

  describe("copying a row's costume", () => {
    const roles = [captainHook(), pirates, sailors];
    /** What kit types into Jo Brown's row before copying it. */
    const joTyped = { fromWardrobe: "Striped top", fromCastMember: "Black boots", notes: "Hem it" };
    // Made-up: Kim's row was filled in before.
    const kimsOld: Costume = {
      itemId: "opening-number",
      roleId: pirates.id,
      castMemberId: kimLee.id,
      fromWardrobe: "Old shirt",
      fromCastMember: "",
      notes: "Needs a belt",
      revision: 1,
    };

    async function editJo(wrapper: VueWrapper) {
      mount(ConfirmDialog, { attachTo: document.body });
      await pencil(wrapper, "Jo Brown as Pirates").trigger("click");
      await fieldLabelled(wrapper, "From Wardrobe").setValue(joTyped.fromWardrobe);
      await fieldLabelled(wrapper, "From Cast Member").setValue(joTyped.fromCastMember);
      await fieldLabelled(wrapper, "Notes").setValue(joTyped.notes);
    }

    const buttonsOf = (wrapper: VueWrapper) =>
      formOf(wrapper)
        .findAll("button")
        .map((button) => button.text());

    async function choose(wrapper: VueWrapper, label: string) {
      const button = formOf(wrapper)
        .findAll("button")
        .find((found) => found.text() === label);
      if (!button) throw new Error(`no ${label} button`);
      await button.trigger("click");
      await flushPromises();
    }

    const copied = (saves: SaveCostumeRequest[]) =>
      saves.map(({ castMemberId, fromWardrobe, fromCastMember, notes, revision }) => [
        castMemberId,
        fromWardrobe,
        fromCastMember,
        notes,
        revision,
      ]);

    it("offers Copy to the role's type and Copy to all between Save and Cancel", async () => {
      const wrapper = openCostumes({ roles });
      await editJo(wrapper);

      expect(buttonsOf(wrapper)).toEqual(["Save", "Copy to Ensemble", "Copy to all", "Cancel"]);
    });

    it("asks first, saying it overwrites, and copies nothing when cancelled", async () => {
      const saves = apiSaves();
      const wrapper = openCostumes({ roles });
      await editJo(wrapper);

      await choose(wrapper, "Copy to Ensemble");

      const [toEnsemble] = costumeCopiesOf(costumeRowsOf(roles, pirateCast, "opening-number"), {
        role: pirates,
        member: joBrown,
      });
      expect(confirmation()).toEqual({
        question: toEnsemble?.question,
        buttons: ["Copy", "Cancel"],
      });
      await cancelConfirmation();
      expect(saves).toEqual([]);
      expect(fieldLabelled(wrapper, "From Wardrobe").element.value).toBe("Striped top");
    });

    it("saves the row, then overwrites the others of its type, each keeping its notes", async () => {
      const saves = apiSaves();
      const wrapper = openCostumes({ roles, costumes: [kimsOld] });
      await editJo(wrapper);

      await choose(wrapper, "Copy to Ensemble");
      await goAhead();

      expect(copied(saves)).toEqual([
        [joBrown.id, "Striped top", "Black boots", "Hem it", 0],
        [kimLee.id, "Striped top", "Black boots", "Needs a belt", 1],
        [samPatel.id, "Striped top", "Black boots", "", 0],
        [chrisEvans.id, "Striped top", "Black boots", "", 0],
      ]);
      expect(wrapper.find("form").exists()).toBe(false);
      expect(costumeFieldsOf(rowOf(wrapper, "Kim Lee as Pirates"))).toEqual([
        ["From Wardrobe", "Striped top"],
        ["From Cast Member", "Black boots"],
        ["Notes", "Needs a belt"],
      ]);
      expect(costumeFieldsOf(rowOf(wrapper, "Alex Morgan as Captain Hook"))).toEqual([]);
      expect(wrapper.get("[role=status]").text()).toBe("Costume copied to 3 others.");
    });

    it("copies to every other cast row with Copy to all", async () => {
      const saves = apiSaves();
      const wrapper = openCostumes({ roles });
      await editJo(wrapper);

      await choose(wrapper, "Copy to all");
      await goAhead();

      expect(
        copied(saves).map(([castMemberId, fromWardrobe]) => [castMemberId, fromWardrobe]),
      ).toEqual([
        [joBrown.id, "Striped top"],
        [alexMorgan.id, "Striped top"],
        [kimLee.id, "Striped top"],
        [samPatel.id, "Striped top"],
        [chrisEvans.id, "Striped top"],
      ]);
    });

    it("keeps the form open while copying, Escape included, so a row it misses is said", async () => {
      let answer: (res: Response) => void = () => {};
      apiSaves(() => new Promise((resolve) => (answer = resolve)));
      const wrapper = openCostumes({ roles });
      await editJo(wrapper);

      await choose(wrapper, "Copy to Ensemble");
      await goAhead();
      await formOf(wrapper).trigger("keydown", { key: "Escape" });

      expect(wrapper.find("form").exists()).toBe(true);
      answer(new Response(null, { status: 500 }));
    });

    it("refuses a field over the limit before asking", async () => {
      const saves = apiSaves();
      const wrapper = openCostumes({ roles });
      await editJo(wrapper);
      await fieldLabelled(wrapper, "From Wardrobe").setValue("x".repeat(501));

      await choose(wrapper, "Copy to Ensemble");

      expect(confirmation()).toBeUndefined();
      expect(formOf(wrapper).text()).toContain("From Wardrobe can be up to 500 characters.");
      expect(saves).toEqual([]);
    });

    it("copies nothing when someone else saved the row first", async () => {
      const theirs = { ...kimsOld, castMemberId: joBrown.id, fromWardrobe: "Blue coat" };
      const saves = apiSaves(async () => json(theirs, 409));
      const wrapper = openCostumes({ roles });
      await editJo(wrapper);

      await choose(wrapper, "Copy to Ensemble");
      await goAhead();

      expect(saves).toHaveLength(1);
      expect(formOf(wrapper).get("[role=alert]").text()).toBe(
        "Someone else saved this costume first. Here it is now; your changes weren't saved.",
      );
    });

    it("leaves a row someone else saved first as they saved it, and says it wasn't copied", async () => {
      // Made-up: dee saved Sam's row since kit opened the page.
      const samsNew = { ...kimsOld, castMemberId: samPatel.id, fromWardrobe: "Sam's own shirt" };
      apiSaves(async (body) =>
        body.castMemberId === samPatel.id
          ? json(samsNew, 409)
          : json(costumeSavedFrom("opening-number", JSON.stringify(body))),
      );
      const wrapper = openCostumes({ roles });
      await editJo(wrapper);

      await choose(wrapper, "Copy to Ensemble");
      await goAhead();

      expect(formOf(wrapper).get("[role=alert]").text()).toBe(
        "Couldn't copy to 1 costume. Try again.",
      );
      expect(costumeFieldsOf(rowOf(wrapper, "Sam Patel as Pirates"))).toContainEqual([
        "From Wardrobe",
        "Sam's own shirt",
      ]);
      for (const copiedTo of ["Kim Lee as Pirates", "Chris Evans as Sailors"]) {
        expect(costumeFieldsOf(rowOf(wrapper, copiedTo))).toContainEqual([
          "From Wardrobe",
          "Striped top",
        ]);
      }
    });
  });
});
