import type { CastList, CastMember } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  const wrapper = mount(CastPage);
  await flushPromises();
  return wrapper;
}

type Page = Awaited<ReturnType<typeof openPage>>;
const rows = (wrapper: Page) =>
  wrapper.findAll("tbody tr").map((row) => row.findAll("td").map((cell) => cell.text()));
const names = (wrapper: Page) => rows(wrapper).map(([first, last]) => `${first} ${last}`);

describe("Cast page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists every cast member with their name, section and group", async () => {
    serve(
      aCast([
        aMember("Sam", "Example", { section: "scouts", group: "1st Somewhere" }),
        aMember("Alex", "Sample", { section: "explorers", group: "Riverside ESU" }),
      ]),
    );

    const wrapper = await openPage();

    expect(wrapper.findAll("thead th").map((th) => th.text())).toEqual([
      "First name",
      "Last name",
      "Section",
      "Group",
    ]);
    expect(rows(wrapper)).toEqual([
      ["Sam", "Example", "Scouts", "1st Somewhere"],
      ["Alex", "Sample", "Explorers", "Riverside ESU"],
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

    expect(rows(wrapper)).toEqual([["Alex", "Sample", "Not set", ""]]);
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
});
