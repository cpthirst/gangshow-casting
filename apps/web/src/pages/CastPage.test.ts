import {
  type CastList,
  type CastMember,
  CastMemberDetails,
  type Role,
  UpdateCastMemberRequest,
} from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ROLES_PATH } from "../roles.ts";
import CastPage from "./CastPage.vue";

enableAutoUnmount(afterEach);

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
let nextId = 1;
const aMember = (
  firstName: string,
  lastName: string,
  details: Partial<CastMember> = {},
): CastMember => ({
  id: nextId++,
  firstName,
  lastName,
  section: "scouts",
  group: "1st Somewhere",
  revision: 1,
  ...details,
});
const aCast = (members: CastMember[]): CastList => ({ productionId: "2027", members });

function serve(list: CastList) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(list)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openPage() {
  const wrapper = mount(CastPage, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

type Page = Awaited<ReturnType<typeof openPage>>;
// The data cells of each row (the last cell holds the row's action buttons).
const rows = (wrapper: Page) =>
  wrapper
    .findAll("tbody tr")
    .map((row) => row.findAll("td:not(.actions)").map((cell) => cell.text()));
const names = (wrapper: Page) => rows(wrapper).map(([first, last]) => `${first} ${last}`);

describe("Cast page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists every cast member with their name, section, group and notes", async () => {
    serve(
      aCast([
        aMember("Sam", "Example", {
          section: "scouts",
          group: "1st Somewhere",
          singing: "Strong alto",
          acting: "Comic timing",
        }),
        aMember("Alex", "Sample", { section: "explorers", group: "Riverside ESU" }),
      ]),
    );

    const wrapper = await openPage();

    expect(wrapper.findAll("thead th:not(.actions)").map((th) => th.text())).toEqual([
      "First name",
      "Last name",
      "Section",
      "Group",
      "Singing",
      "Acting",
    ]);
    expect(rows(wrapper)).toEqual([
      ["Sam", "Example", "Scouts", "1st Somewhere", "Strong alto", "Comic timing"],
      ["Alex", "Sample", "Explorers", "Riverside ESU", "", ""],
    ]);
  });

  it("fetches the 2027 cast", async () => {
    const fetchMock = serve(aCast([aMember("Sam", "Example")]));

    await openPage();

    expect(fetchMock).toHaveBeenCalledWith("/api/productions/2027/cast");
  });

  it("sorts by last name, then first name", async () => {
    serve(aCast([aMember("Ben", "Carter"), aMember("Zoe", "Adams"), aMember("Amy", "Carter")]));

    const wrapper = await openPage();

    expect(names(wrapper)).toEqual(["Zoe Adams", "Amy Carter", "Ben Carter"]);
  });

  it("sorts names the way people expect, ignoring case and accents", async () => {
    serve(aCast([aMember("Max", "evans"), aMember("Ada", "Éclair"), aMember("Ivy", "Dunn")]));

    const wrapper = await openPage();

    expect(names(wrapper)).toEqual(["Ivy Dunn", "Ada Éclair", "Max evans"]);
  });

  it("shows how many cast members there are", async () => {
    serve(aCast([aMember("Sam", "Example"), aMember("Alex", "Sample"), aMember("Jo", "Other")]));

    const wrapper = await openPage();

    expect(wrapper.get("[data-test=count]").text()).toBe("3 cast members");
  });

  it("says '1 cast member' for one", async () => {
    serve(aCast([aMember("Sam", "Example")]));

    const wrapper = await openPage();

    expect(wrapper.get("[data-test=count]").text()).toBe("1 cast member");
  });

  it("shows a missing section as not set and a missing group as blank", async () => {
    serve(aCast([aMember("Alex", "Sample", { section: null, group: "" })]));

    const wrapper = await openPage();

    expect(rows(wrapper)).toEqual([["Alex", "Sample", "Not set", "", "", ""]]);
  });

  it("shows blank notes for members saved before notes existed", async () => {
    // Saved before ADR 0014: no singing or acting keys at all.
    serve(
      aCast([
        { id: 1, firstName: "Alex", lastName: "Sample", section: null, group: "", revision: 1 },
      ]),
    );

    const wrapper = await openPage();

    expect(rows(wrapper)).toEqual([["Alex", "Sample", "Not set", "", "", ""]]);
  });

  it("leaves blank note cells truly empty, so phone cards drop their lines", async () => {
    serve(aCast([aMember("Sam", "Example")]));

    const wrapper = await openPage();

    // The card hides a line with CSS :empty, which any whitespace would defeat.
    for (const label of ["Singing", "Acting"]) {
      expect(wrapper.get(`td[data-label=${label}]`).element.innerHTML).toBe("");
    }
  });

  it("says there are no cast members yet when none are saved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("No cast members yet");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("says the cast list couldn't be loaded when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("Couldn't load the cast list");
  });

  it("treats an off-contract response as a load failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ x: 1 }))));

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("Couldn't load the cast list");
  });

  describe("row buttons", () => {
    it("puts the icons in the first column, like the Running order and Items pages", async () => {
      serve(aCast([aMember("Sam", "Example")]));

      const wrapper = await openPage();

      expect(wrapper.findAll("thead th").map((th) => th.text())[0]).toBe("Actions");
      const firstCell = wrapper.get("tbody tr td");
      expect(firstCell.find("button[aria-label='Edit Sam Example']").exists()).toBe(true);
      expect(firstCell.find("button[aria-label='Delete Sam Example']").exists()).toBe(true);
    });

    it("uses icon buttons like the Running order, each named and explained", async () => {
      serve(aCast([aMember("Sam", "Example")]));

      const wrapper = await openPage();

      const edit = wrapper.get("button[aria-label='Edit Sam Example']");
      const remove = wrapper.get("button[aria-label='Delete Sam Example']");
      expect(edit.classes()).toContain("icon-button");
      expect(edit.get("svg[aria-hidden=true]").attributes("data-icon")).toBe("pen");
      expect(edit.text()).toBe("");
      expect(edit.attributes("data-tooltip")).toBe("Edit details");
      expect(remove.classes()).toContain("icon-button");
      expect(remove.get("svg[aria-hidden=true]").attributes("data-icon")).toBe("trash-can");
      expect(remove.text()).toBe("");
      expect(remove.attributes("data-tooltip")).toBe("Delete from the cast");
    });

    it("labels each cell, so small screens can show the list as cards", async () => {
      serve(aCast([aMember("Sam", "Example")]));

      const wrapper = await openPage();

      const labels = wrapper.findAll("tbody td").map((td) => td.attributes("data-label"));
      expect(labels).toEqual([
        "Actions",
        "First name",
        "Last name",
        "Section",
        "Group",
        "Singing",
        "Acting",
      ]);
    });
  });

  describe("filtering", () => {
    const cast = () =>
      aCast([
        aMember("Sam", "Example", { section: "scouts" }),
        aMember("Samira", "Sample", { section: "explorers" }),
        aMember("Alex", "Other", { section: "explorers" }),
        aMember("Zoë", "Smith", { section: null }),
      ]);
    const firstName = (wrapper: Page) => wrapper.get("input[name=firstName]");
    const lastName = (wrapper: Page) => wrapper.get("input[name=lastName]");
    const section = (wrapper: Page) => wrapper.get("select[name=section]");

    it("filters by first name", async () => {
      serve(cast());
      const wrapper = await openPage();

      await firstName(wrapper).setValue("sam");

      expect(names(wrapper)).toEqual(["Sam Example", "Samira Sample"]);
    });

    it("filters by last name, ignoring case", async () => {
      serve(cast());
      const wrapper = await openPage();

      await lastName(wrapper).setValue("SAMP");

      expect(names(wrapper)).toEqual(["Samira Sample"]);
    });

    it("matches names regardless of accents", async () => {
      serve(cast());
      const wrapper = await openPage();

      await firstName(wrapper).setValue("zoe");

      expect(names(wrapper)).toEqual(["Zoë Smith"]);
    });

    it("filters by section, including members with no section", async () => {
      serve(cast());
      const wrapper = await openPage();

      await section(wrapper).setValue("explorers");
      expect(names(wrapper)).toEqual(["Alex Other", "Samira Sample"]);

      await section(wrapper).setValue("not-set");
      expect(names(wrapper)).toEqual(["Zoë Smith"]);
    });

    it("offers All, Scouts, Explorers, Network and Not set", async () => {
      serve(cast());
      const wrapper = await openPage();

      expect(
        section(wrapper)
          .findAll("option")
          .map((o) => o.text()),
      ).toEqual(["All", "Scouts", "Explorers", "Network", "Not set"]);
    });

    it("combines filters", async () => {
      serve(cast());
      const wrapper = await openPage();

      await firstName(wrapper).setValue("sam");
      await section(wrapper).setValue("scouts");

      expect(names(wrapper)).toEqual(["Sam Example"]);
    });

    it("shows matches out of the total, in a live region for screen readers", async () => {
      serve(cast());
      const wrapper = await openPage();

      await section(wrapper).setValue("explorers");

      const count = wrapper.get("[data-test=count]");
      expect(count.text()).toBe("2 of 4 cast members");
      expect(count.attributes("role")).toBe("status");
    });

    it("says when nothing matches", async () => {
      serve(cast());
      const wrapper = await openPage();

      await firstName(wrapper).setValue("nobody");

      expect(wrapper.text()).toContain("No cast members match these filters");
      expect(wrapper.find("table").exists()).toBe(false);
    });

    it("clears every filter in one go", async () => {
      serve(cast());
      const wrapper = await openPage();
      await firstName(wrapper).setValue("sam");
      await section(wrapper).setValue("scouts");

      await wrapper.get("button[data-test=clear-filters]").trigger("click");

      expect(firstName(wrapper).element).toHaveProperty("value", "");
      expect(lastName(wrapper).element).toHaveProperty("value", "");
      expect(section(wrapper).element).toHaveProperty("value", "all");
      expect(names(wrapper)).toHaveLength(4);
      expect(wrapper.get("[data-test=count]").text()).toBe("4 cast members");
    });

    it("moves focus to the first name filter after clearing, so keyboard users keep their place", async () => {
      serve(cast());
      const wrapper = await openPage();
      await section(wrapper).setValue("scouts");

      await wrapper.get("button[data-test=clear-filters]").trigger("click");

      expect(document.activeElement).toBe(firstName(wrapper).element);
    });

    it("filters by first name, last name and section only, not by the notes", async () => {
      serve(cast());
      const wrapper = await openPage();

      const fields = wrapper.findAll("form.cast-filters :is(input, select)");
      expect(fields.map((field) => field.attributes("name"))).toEqual([
        "firstName",
        "lastName",
        "section",
      ]);
    });

    it("labels each filter for screen readers", async () => {
      serve(cast());
      const wrapper = await openPage();

      for (const field of [firstName(wrapper), lastName(wrapper), section(wrapper)]) {
        const id = field.attributes("id");
        expect(wrapper.find(`label[for="${id}"]`).exists()).toBe(true);
      }
    });
  });

  describe("adding a cast member", () => {
    let posts: unknown[] = [];
    // A stand-in for the API: serves the list and adds members with the next id.
    function api(initial: CastList) {
      const list = { ...initial, members: [...initial.members] };
      posts = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) => {
          if (init?.method !== "POST") return new Response(JSON.stringify(list));
          const details = CastMemberDetails.parse(JSON.parse(String(init.body)));
          posts.push(details);
          const member = {
            ...details,
            id: Math.max(0, ...list.members.map((m) => m.id)) + 1,
            revision: 1,
          };
          list.members.push(member);
          return new Response(JSON.stringify(member), { status: 201 });
        }),
      );
    }

    const cast = () => aCast([aMember("Sam", "Example"), aMember("Alex", "Sample")]);
    async function openForm(wrapper: Page) {
      await wrapper.get("button[data-test=add-member]").trigger("click");
      await flushPromises();
      return wrapper.get("form[data-test=cast-member-form]");
    }
    async function save(wrapper: Page) {
      await wrapper.get("form[data-test=cast-member-form]").trigger("submit");
      await flushPromises();
    }
    async function fill(form: ReturnType<Page["get"]>, values: Record<string, string>) {
      for (const [name, value] of Object.entries(values)) {
        await form.get(`[name=${name}]`).setValue(value);
      }
    }

    it("adds a cast member in surname order and updates the count", async () => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);

      await fill(form, {
        firstName: "Jo",
        lastName: "Newcomer",
        section: "scouts",
        group: "1st Somewhere",
      });
      await save(wrapper);

      expect(names(wrapper)).toEqual(["Sam Example", "Jo Newcomer", "Alex Sample"]);
      expect(rows(wrapper)[1]).toEqual(["Jo", "Newcomer", "Scouts", "1st Somewhere", "", ""]);
      expect(wrapper.get("[data-test=count]").text()).toBe("3 cast members");
      expect(wrapper.find("form[data-test=cast-member-form]").exists()).toBe(false);
    });

    it("leaves section, group and notes optional", async () => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);

      await fill(form, { firstName: "Jo", lastName: "Newcomer" });
      await save(wrapper);

      expect(rows(wrapper)[1]).toEqual(["Jo", "Newcomer", "Not set", "", "", ""]);
    });

    it("adds someone with Singing and Acting notes, shown in their columns", async () => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);

      await fill(form, {
        firstName: "Jo",
        lastName: "Newcomer",
        singing: "Strong alto, can solo",
        acting: "Comic timing",
      });
      await save(wrapper);

      expect(posts[0]).toMatchObject({ singing: "Strong alto, can solo", acting: "Comic timing" });
      expect(rows(wrapper)[1]).toEqual([
        "Jo",
        "Newcomer",
        "Not set",
        "",
        "Strong alto, can solo",
        "Comic timing",
      ]);
    });

    it.each([
      ["first name", { lastName: "Newcomer" }, "firstName", "Enter a first name"],
      ["last name", { firstName: "Jo" }, "lastName", "Enter a last name"],
    ])("requires a %s, explaining next to the field", async (_f, values, field, message) => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);

      await fill(form, values);
      await save(wrapper);

      const input = wrapper.get(`form[data-test=cast-member-form] [name=${field}]`);
      expect(input.attributes("aria-invalid")).toBe("true");
      expect(wrapper.get(`[id="${input.attributes("aria-describedby")}"]`).text()).toBe(message);
      expect(posts).toHaveLength(0);
      expect(rows(wrapper)).toHaveLength(2);
    });

    it.each([
      [
        "a first name",
        "firstName",
        "x".repeat(41),
        "Keep the first name to 40 characters or fewer",
      ],
      ["a group", "group", "x".repeat(61), "Keep the group to 60 characters or fewer"],
      [
        "a Singing note",
        "singing",
        "x".repeat(101),
        "Keep the singing note to 100 characters or fewer",
      ],
      [
        "an Acting note",
        "acting",
        "x".repeat(101),
        "Keep the acting note to 100 characters or fewer",
      ],
    ])("refuses %s over the limit", async (_f, field, value, message) => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);

      await fill(form, { firstName: "Jo", lastName: "Newcomer", [field]: value });
      await save(wrapper);

      const input = wrapper.get(`form[data-test=cast-member-form] [name=${field}]`);
      expect(wrapper.get(`[id="${input.attributes("aria-describedby")}"]`).text()).toBe(message);
      expect(posts).toHaveLength(0);
    });

    it("adds nobody when cancelled", async () => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);
      await fill(form, { firstName: "Jo", lastName: "Newcomer" });

      await form.get("button[data-test=cancel]").trigger("click");
      await flushPromises();

      expect(wrapper.find("form[data-test=cast-member-form]").exists()).toBe(false);
      expect(rows(wrapper)).toHaveLength(2);
      expect(posts).toHaveLength(0);
    });

    it("keeps the form and says so when the add fails", async () => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);
      await fill(form, { firstName: "Jo", lastName: "Newcomer" });
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await save(wrapper);

      expect(wrapper.text()).toContain("Couldn't add the cast member. Try again.");
      expect(wrapper.find("form[data-test=cast-member-form]").exists()).toBe(true);
      expect(rows(wrapper)).toHaveLength(2);
    });

    it("reloads the list, rather than saying it failed, when the add saved but its reply is unreadable", async () => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);
      await fill(form, { firstName: "Jo", lastName: "Newcomer" });
      const afterSave = aCast([...cast().members, aMember("Jo", "Newcomer", { section: null })]);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) =>
          init?.method === "POST"
            ? new Response("not the member", { status: 201 })
            : new Response(JSON.stringify(afterSave)),
        ),
      );

      await save(wrapper);

      expect(wrapper.text()).not.toContain("Couldn't add the cast member");
      expect(names(wrapper)).toContain("Jo Newcomer");
      expect(wrapper.find("form[data-test=cast-member-form]").exists()).toBe(false);
    });

    it("announces the new member and returns focus to the Add button", async () => {
      api(cast());
      const wrapper = await openPage();
      const form = await openForm(wrapper);

      expect(document.activeElement).toBe(form.get("[name=firstName]").element);

      await fill(form, { firstName: "Jo", lastName: "Newcomer" });
      await save(wrapper);

      expect(wrapper.get("[data-test=announcement]").text()).toBe("Jo Newcomer added.");
      expect(document.activeElement).toBe(wrapper.get("button[data-test=add-member]").element);
    });
  });

  describe("deleting a cast member", () => {
    let deletes: string[] = [];
    // A stand-in for the API: serves the list and the roles, and deletes at the right revision.
    function api(initial: CastList, roles: Role[] = []) {
      const list = { ...initial, members: [...initial.members] };
      deletes = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          if (url === ROLES_PATH)
            return new Response(JSON.stringify({ productionId: "2027", roles }));
          if (init?.method !== "DELETE") return new Response(JSON.stringify(list));
          deletes.push(url);
          const { pathname, searchParams } = new URL(url, "http://localhost");
          const id = Number(pathname.split("/").at(-1));
          const member = list.members.find((m) => m.id === id);
          if (!member) return new Response(null, { status: 404 });
          if (String(member.revision) !== searchParams.get("revision")) {
            return new Response(null, { status: 409 });
          }
          list.members = list.members.filter((m) => m.id !== id);
          return new Response(null, { status: 204 });
        }),
      );
      return list;
    }

    const sam = () => aMember("Sam", "Example", { revision: 4 });
    const cast = (members: CastMember[] = [sam(), aMember("Alex", "Sample")]) => aCast(members);
    const deleteButton = (wrapper: Page, name: string) =>
      wrapper.get(`button[aria-label="Delete ${name}"]`);
    async function deleteMember(wrapper: Page, name: string) {
      await deleteButton(wrapper, name).trigger("click");
      await flushPromises();
    }

    it("asks first, naming the person", async () => {
      api(cast());
      const confirm = vi.fn().mockReturnValue(false);
      vi.stubGlobal("confirm", confirm);
      const wrapper = await openPage();

      await deleteMember(wrapper, "Sam Example");

      expect(confirm).toHaveBeenCalledWith(
        "Delete Sam Example from the cast? This can't be undone.",
      );
    });

    const castIn = (memberId: number, count: number): Role[] =>
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        itemId: "pirate-sketch",
        name: `Role ${i + 1}`,
        size: "lead",
        castMemberIds: [memberId],
        revision: 1,
      }));

    it.each([
      [2, "They'll be removed from 2 roles."],
      [1, "They'll be removed from 1 role."],
    ])("says how many roles they'll be removed from (%i)", async (count, sentence) => {
      const member = sam();
      api(cast([member, aMember("Alex", "Sample")]), castIn(member.id, count));
      const confirm = vi.fn().mockReturnValue(false);
      vi.stubGlobal("confirm", confirm);
      const wrapper = await openPage();

      await deleteMember(wrapper, "Sam Example");

      expect(confirm).toHaveBeenCalledWith(
        `Delete Sam Example from the cast? ${sentence} This can't be undone.`,
      );
    });

    it("doesn't count other people's roles", async () => {
      const member = sam();
      api(cast([member, aMember("Alex", "Sample")]), castIn(member.id + 1000, 2));
      const confirm = vi.fn().mockReturnValue(false);
      vi.stubGlobal("confirm", confirm);
      const wrapper = await openPage();

      await deleteMember(wrapper, "Sam Example");

      expect(confirm).toHaveBeenCalledWith(
        "Delete Sam Example from the cast? This can't be undone.",
      );
    });

    it("still warns about roles when they can't be counted", async () => {
      api(cast());
      const answer = vi.mocked(fetch).getMockImplementation();
      vi.mocked(fetch).mockImplementation(async (url, init) =>
        url === ROLES_PATH
          ? new Response(null, { status: 500 })
          : (answer?.(url, init) ?? new Response(null)),
      );
      const confirm = vi.fn().mockReturnValue(false);
      vi.stubGlobal("confirm", confirm);
      const wrapper = await openPage();

      await deleteMember(wrapper, "Sam Example");

      expect(confirm).toHaveBeenCalledWith(
        "Delete Sam Example from the cast? They'll be removed from any roles they're in. This can't be undone.",
      );
    });

    it("removes them for good once confirmed", async () => {
      const member = sam();
      api(cast([member, aMember("Alex", "Sample")]));
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const wrapper = await openPage();

      await deleteMember(wrapper, "Sam Example");

      expect(names(wrapper)).toEqual(["Alex Sample"]);
      expect(wrapper.get("[data-test=count]").text()).toBe("1 cast member");
      expect(deletes).toEqual([`/api/productions/2027/cast/${member.id}?revision=4`]);

      wrapper.unmount();
      const reloaded = await openPage();
      expect(names(reloaded)).toEqual(["Alex Sample"]);
    });

    it("keeps them when the confirmation is cancelled", async () => {
      api(cast());
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
      const wrapper = await openPage();

      await deleteMember(wrapper, "Sam Example");

      expect(names(wrapper)).toEqual(["Sam Example", "Alex Sample"]);
      expect(deletes).toHaveLength(0);
    });

    it("shows the latest list when someone else changed them first", async () => {
      const list = api(cast());
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const wrapper = await openPage();
      // Someone else edits Sam after the page loaded.
      list.members = list.members.map((m) =>
        m.firstName === "Sam" ? { ...m, lastName: "Changed", revision: 5 } : m,
      );

      await deleteMember(wrapper, "Sam Example");

      expect(wrapper.text()).toContain(
        "Someone else changed this cast member. Showing the latest list.",
      );
      expect(names(wrapper)).toEqual(["Sam Changed", "Alex Sample"]);
    });

    it("shows the latest list when someone else already deleted them", async () => {
      const list = api(cast());
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const wrapper = await openPage();
      list.members = list.members.filter((m) => m.firstName !== "Sam");

      await deleteMember(wrapper, "Sam Example");

      expect(wrapper.text()).toContain(
        "Someone else changed this cast member. Showing the latest list.",
      );
      expect(names(wrapper)).toEqual(["Alex Sample"]);
    });

    it("still explains the conflict when the latest list turns out to be empty", async () => {
      const list = api(cast([sam()]));
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const wrapper = await openPage();
      list.members = [];
      vi.mocked(fetch).mockImplementation(async (_url, init) =>
        init?.method === "DELETE"
          ? new Response(null, { status: 404 })
          : new Response(null, { status: 404 }),
      );

      await deleteMember(wrapper, "Sam Example");

      expect(wrapper.text()).toContain("No cast members yet");
      expect(wrapper.text()).toContain(
        "Someone else changed this cast member. Showing the latest list.",
      );
    });

    it("clears an old message once a later change succeeds", async () => {
      const list = api(cast());
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const wrapper = await openPage();
      list.members = list.members.filter((m) => m.firstName !== "Sam");
      await deleteMember(wrapper, "Sam Example");

      await deleteMember(wrapper, "Alex Sample");

      expect(wrapper.text()).not.toContain("Someone else changed this cast member");
    });

    it("says so when the delete fails, keeping them on the list", async () => {
      api(cast());
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const wrapper = await openPage();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await deleteMember(wrapper, "Sam Example");

      expect(wrapper.text()).toContain("Couldn't delete Sam Example. Try again.");
      expect(names(wrapper)).toEqual(["Sam Example", "Alex Sample"]);
    });

    it("announces the deletion and keeps keyboard focus on the page", async () => {
      api(cast());
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const wrapper = await openPage();

      await deleteMember(wrapper, "Sam Example");

      expect(wrapper.get("[data-test=announcement]").text()).toBe("Sam Example deleted.");
      expect(document.activeElement).toBe(wrapper.get("button[data-test=add-member]").element);
    });
  });

  describe("editing a cast member", () => {
    let puts: { url: string; body: UpdateCastMemberRequest }[] = [];
    // A stand-in for the API: serves the list and applies updates at the right revision.
    function api(initial: CastList) {
      const list = { ...initial, members: [...initial.members] };
      puts = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          if (init?.method !== "PUT") return new Response(JSON.stringify(list));
          const body = UpdateCastMemberRequest.parse(JSON.parse(String(init.body)));
          puts.push({ url, body });
          const id = Number(url.split("/").at(-1));
          const member = list.members.find((m) => m.id === id);
          if (!member) return new Response(null, { status: 404 });
          if (member.revision !== body.revision) return new Response(null, { status: 409 });
          const { revision, ...details } = body;
          const updated = { ...details, id, revision: revision + 1 };
          list.members = list.members.map((m) => (m.id === id ? updated : m));
          return new Response(JSON.stringify(updated));
        }),
      );
      return list;
    }

    const sam = () =>
      aMember("Sam", "Example", { section: "scouts", group: "1st Somewhere", revision: 3 });
    const cast = () => aCast([sam(), aMember("Alex", "Sample", { section: "explorers" })]);
    const form = (wrapper: Page) => wrapper.get("form[data-test=cast-member-form]");
    async function openEdit(wrapper: Page, name: string) {
      await wrapper.get(`button[aria-label="Edit ${name}"]`).trigger("click");
      await flushPromises();
      return form(wrapper);
    }
    async function save(wrapper: Page) {
      await form(wrapper).trigger("submit");
      await flushPromises();
    }

    it("saves new details to the row", async () => {
      api(cast());
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");

      await edit.get("[name=section]").setValue("explorers");
      await edit.get("[name=group]").setValue("Riverside ESU");
      await save(wrapper);

      expect(rows(wrapper)[0]).toEqual(["Sam", "Example", "Explorers", "Riverside ESU", "", ""]);
      expect(puts[0]?.body).toEqual({
        firstName: "Sam",
        lastName: "Example",
        section: "explorers",
        group: "Riverside ESU",
        singing: "",
        acting: "",
        revision: 3,
      });
      expect(wrapper.find("form[data-test=cast-member-form]").exists()).toBe(false);
    });

    it("saves edited notes to the row", async () => {
      api(aCast([aMember("Jo", "Newcomer", { singing: "Strong alto, can solo", revision: 2 })]));
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Jo Newcomer");

      expect(edit.get<HTMLInputElement>("[name=singing]").element.value).toBe(
        "Strong alto, can solo",
      );
      await edit.get("[name=singing]").setValue("Alto, harmonies");
      await save(wrapper);

      expect(puts[0]?.body).toMatchObject({ singing: "Alto, harmonies", revision: 2 });
      expect(rows(wrapper)[0]?.[4]).toBe("Alto, harmonies");
    });

    it("refuses a note over 100 characters when editing, saving nothing", async () => {
      api(cast());
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");

      await edit.get("[name=acting]").setValue("x".repeat(101));
      await save(wrapper);

      const input = form(wrapper).get("[name=acting]");
      expect(input.attributes("aria-invalid")).toBe("true");
      expect(wrapper.get(`[id="${input.attributes("aria-describedby")}"]`).text()).toBe(
        "Keep the acting note to 100 characters or fewer",
      );
      expect(puts).toHaveLength(0);
    });

    it("shows every field but the ID as editable, with the ID shown", async () => {
      const member = sam();
      api(aCast([member]));
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");

      expect(edit.get("[data-test=member-id]").text()).toBe(`ID ${member.id}`);
      expect(edit.find("[name=id]").exists()).toBe(false);
      expect(edit.get<HTMLInputElement>("[name=firstName]").element.value).toBe("Sam");
      expect(edit.get<HTMLInputElement>("[name=lastName]").element.value).toBe("Example");
      expect(edit.get<HTMLSelectElement>("[name=section]").element.value).toBe("scouts");
      expect(edit.get<HTMLInputElement>("[name=group]").element.value).toBe("1st Somewhere");
    });

    it("moves a renamed member to their new place in the list", async () => {
      api(cast());
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");

      await edit.get("[name=lastName]").setValue("Toms");
      await save(wrapper);

      expect(names(wrapper)).toEqual(["Alex Sample", "Sam Toms"]);
    });

    it("explains invalid details and saves nothing", async () => {
      api(cast());
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");

      await edit.get("[name=firstName]").setValue("");
      await save(wrapper);

      const input = form(wrapper).get("[name=firstName]");
      expect(wrapper.get(`[id="${input.attributes("aria-describedby")}"]`).text()).toBe(
        "Enter a first name",
      );
      expect(puts).toHaveLength(0);
      expect(rows(wrapper)[0]).toEqual(["Sam", "Example", "Scouts", "1st Somewhere", "", ""]);
    });

    it("leaves the member unchanged when cancelled", async () => {
      api(cast());
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");
      await edit.get("[name=group]").setValue("Somewhere Else");

      await edit.get("button[data-test=cancel]").trigger("click");
      await flushPromises();

      expect(rows(wrapper)[0]).toEqual(["Sam", "Example", "Scouts", "1st Somewhere", "", ""]);
      expect(puts).toHaveLength(0);
    });

    const conflictMessage = "Someone else changed this cast member. Showing the latest list.";

    it("shows the latest details when someone else edited them first", async () => {
      const list = api(cast());
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");
      await edit.get("[name=group]").setValue("My Group");
      list.members = list.members.map((m) =>
        m.firstName === "Sam" ? { ...m, group: "Changed Group", revision: 4 } : m,
      );

      await save(wrapper);

      expect(wrapper.text()).toContain(conflictMessage);
      expect(rows(wrapper)[0]).toEqual(["Sam", "Example", "Scouts", "Changed Group", "", ""]);
      expect(wrapper.find("form[data-test=cast-member-form]").exists()).toBe(false);
    });

    it("shows the latest list when someone else deleted them first", async () => {
      const list = api(cast());
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");
      await edit.get("[name=group]").setValue("My Group");
      list.members = list.members.filter((m) => m.firstName !== "Sam");

      await save(wrapper);

      expect(wrapper.text()).toContain(conflictMessage);
      expect(names(wrapper)).toEqual(["Alex Sample"]);
    });

    it("keeps the form and says so when the save fails", async () => {
      api(cast());
      const wrapper = await openPage();
      await openEdit(wrapper, "Sam Example");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await save(wrapper);

      expect(wrapper.text()).toContain("Couldn't save the changes. Try again.");
      expect(wrapper.find("form[data-test=cast-member-form]").exists()).toBe(true);
    });

    it("announces the change and returns focus to the member's Edit button", async () => {
      api(cast());
      const wrapper = await openPage();
      const edit = await openEdit(wrapper, "Sam Example");
      await edit.get("[name=group]").setValue("Riverside ESU");

      await save(wrapper);

      expect(wrapper.get("[data-test=announcement]").text()).toBe("Sam Example updated.");
      expect(document.activeElement).toBe(
        wrapper.get('button[aria-label="Edit Sam Example"]').element,
      );
    });

    it("holds off other changes while a form is open", async () => {
      api(cast());
      const wrapper = await openPage();
      await openEdit(wrapper, "Sam Example");

      const disabled = (selector: string) =>
        wrapper.get(selector).attributes("disabled") !== undefined;
      expect(disabled("button[data-test=add-member]")).toBe(true);
      expect(disabled('button[aria-label="Edit Alex Sample"]')).toBe(true);
      expect(disabled('button[aria-label="Delete Alex Sample"]')).toBe(true);
    });
  });
});
