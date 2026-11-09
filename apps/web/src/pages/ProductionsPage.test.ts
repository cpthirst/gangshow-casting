import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openProduction, openProductionYear, PRODUCTIONS_PATH } from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import ProductionsPage from "./ProductionsPage.vue";

enableAutoUnmount(afterEach);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** The API: GET lists the productions; POST answers with `started`. */
function serve(productions: string[], started: () => Response = () => json({}, 500)) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST" ? started() : json({ productions }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openPage() {
  const wrapper = mount(ProductionsPage, {
    attachTo: document.body,
    global: { stubs: { HelpButton: true } },
  });
  await flushPromises();
  return wrapper;
}

type Page = Awaited<ReturnType<typeof openPage>>;

const years = (wrapper: Page) => wrapper.findAll("tbody tr").map((row) => row.text());

const confirmWith = (answer: boolean) => {
  const confirm = vi.fn().mockReturnValue(answer);
  vi.stubGlobal("confirm", confirm);
  return confirm;
};

const posts = (fetchMock: ReturnType<typeof serve>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

const openForm = (wrapper: Page) => wrapper.get("[data-test=add-production]").trigger("click");

async function start(wrapper: Page, year: string) {
  await openForm(wrapper);
  await wrapper.get("input[name=year]").setValue(year);
  await wrapper.get("[data-test=start-production]").trigger("submit");
  await flushPromises();
}

describe("Productions page", () => {
  beforeEach(() => {
    useLocalSignIn();
    openProduction("2028");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists each production by its year, newest first", async () => {
    serve(["2027", "2029", "2028"]);

    const wrapper = await openPage();

    expect(wrapper.get("h1").text()).toBe("Productions");
    expect(years(wrapper)).toEqual(["2029", "2028", "2027"]);
  });

  it("starts the year typed, lists it and opens it", async () => {
    confirmWith(true);
    const fetchMock = serve(["2027", "2028"], () =>
      json({ productions: ["2027", "2028", "2029"] }, 201),
    );
    const wrapper = await openPage();

    await start(wrapper, "2029");

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe(PRODUCTIONS_PATH);
    expect(post?.[1]?.body).toBe(JSON.stringify({ year: "2029" }));
    expect(years(wrapper)).toEqual(["2029", "2028", "2027"]);
    expect(openProductionYear()).toBe("2029");
    expect(wrapper.find("[data-test=start-production]").exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get("[data-test=add-production]").element);
    expect(wrapper.get("[data-test=announcement]").text()).toBe("Production 2029 started.");
  });

  it("asks first, naming the year, saying everyone moves to it and it can't be undone", async () => {
    const confirm = confirmWith(true);
    serve(["2027", "2028"], () => json({ productions: ["2027", "2028", "2029"] }, 201));
    const wrapper = await openPage();

    await start(wrapper, "2029");

    expect(confirm).toHaveBeenCalledWith(
      "Start production 2029? Everyone will move to 2029, and this can't be undone.",
    );
  });

  it("starts nothing and keeps the open production when the admin cancels", async () => {
    confirmWith(false);
    const fetchMock = serve(["2027", "2028"]);
    const wrapper = await openPage();

    await start(wrapper, "2029");

    expect(posts(fetchMock)).toEqual([]);
    expect(years(wrapper)).toEqual(["2028", "2027"]);
    expect(openProductionYear()).toBe("2028");
    expect(wrapper.get<HTMLInputElement>("input[name=year]").element.value).toBe("2029");
  });

  it.each(["2028", "2026", "next year"])(
    "tells the admin what would do for %j, without asking or sending it",
    async (year) => {
      const confirm = confirmWith(true);
      const fetchMock = serve(["2027", "2028"]);
      const wrapper = await openPage();

      await start(wrapper, year);

      expect(wrapper.get(`[id$="-year-error"]`).text()).toBe(
        "The year must be a four-digit year later than 2028.",
      );
      expect(wrapper.get("input[name=year]").attributes("aria-invalid")).toBe("true");
      expect(confirm).not.toHaveBeenCalled();
      expect(posts(fetchMock)).toEqual([]);
    },
  );

  it("shows the API's refusal and keeps the list and the open production as they were", async () => {
    confirmWith(true);
    const message = "The year must be a four-digit year later than 2029.";
    serve(["2027", "2028"], () => json({ message }, 400));
    const wrapper = await openPage();

    await start(wrapper, "2029");

    expect(wrapper.get(`[id$="-year-error"]`).text()).toBe(message);
    expect(wrapper.find(".form-error").exists()).toBe(false);
    expect(years(wrapper)).toEqual(["2028", "2027"]);
    expect(openProductionYear()).toBe("2028");
  });

  it("says it couldn't start the production when the request fails", async () => {
    confirmWith(true);
    serve(["2027", "2028"], () => json({}, 500));
    const wrapper = await openPage();

    await start(wrapper, "2029");

    expect(wrapper.get(".form-error").text()).toBe("Couldn't start the production. Try again.");
    expect(wrapper.find(`[id$="-year-error"]`).exists()).toBe(false);
    expect(openProductionYear()).toBe("2028");
  });

  it("says when the productions can't be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    const wrapper = await openPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the productions.");
  });

  it("offers no start form to someone who isn't an admin, at its address", async () => {
    await signInAs(["casting", "stage", "tech", "wardrobe", "director"]);
    serve(["2027", "2028"]);

    const wrapper = await openPage();

    expect(years(wrapper)).toEqual(["2028", "2027"]);
    expect(wrapper.find("[data-test=add-production]").exists()).toBe(false);
    expect(wrapper.find("[data-test=start-production]").exists()).toBe(false);
  });

  it("keeps the form closed until Add production opens it, on the Year field", async () => {
    serve(["2027", "2028"]);
    const wrapper = await openPage();

    expect(wrapper.find("[data-test=start-production]").exists()).toBe(false);
    await openForm(wrapper);
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.get("input[name=year]").element);
  });

  it.each([
    ["Cancel", (w: Page) => w.get("[data-test=cancel]").trigger("click")],
    ["Escape", (w: Page) => w.get("input[name=year]").trigger("keydown", { key: "Escape" })],
  ])("closes the form on %s, back on Add production, starting nothing", async (_how, close) => {
    const fetchMock = serve(["2027", "2028"]);
    const wrapper = await openPage();
    await openForm(wrapper);
    await flushPromises();

    await close(wrapper);
    await flushPromises();

    expect(wrapper.find("[data-test=start-production]").exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get("[data-test=add-production]").element);
    expect(posts(fetchMock)).toEqual([]);
  });

  describe("deleting a production", () => {
    /** The API: GET lists the productions; DELETE answers with `deleted`, then lists `after`. */
    function serveDelete(
      list: { productions: string[]; deleting?: string[] },
      deleted: () => Response,
      after = list,
    ) {
      let current = list;
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method !== "DELETE") return json(current);
        current = after;
        return deleted();
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }
    const deletes = (fetchMock: ReturnType<typeof serveDelete>) =>
      fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");
    const deleteButton = (wrapper: Page, year: string) =>
      wrapper.find(`tr[data-year="${year}"] [data-test=delete-production]`);
    async function askToDelete(wrapper: Page, year: string) {
      await deleteButton(wrapper, year).trigger("click");
      await flushPromises();
    }

    it("confirms, naming the year, that it can't be undone, and how long backups last", async () => {
      const confirm = confirmWith(true);
      serveDelete({ productions: ["2027", "2028"] }, () => json({ productions: ["2028"] }));
      const wrapper = await openPage();

      await askToDelete(wrapper, "2027");

      expect(confirm).toHaveBeenCalledWith(
        "Delete production 2027? This can't be undone. Copies stay in backups for up to 7 days.",
      );
    });

    it("deletes the production and stops listing it", async () => {
      confirmWith(true);
      const fetchMock = serveDelete({ productions: ["2027", "2028"] }, () =>
        json({ productions: ["2028"] }),
      );
      const wrapper = await openPage();

      await askToDelete(wrapper, "2027");

      expect(deletes(fetchMock)[0]?.[0]).toBe(`${PRODUCTIONS_PATH}/2027`);
      expect(years(wrapper)).toEqual(["2028"]);
      expect(wrapper.get("[data-test=announcement]").text()).toBe("Production 2027 deleted.");
      expect(document.activeElement).toBe(wrapper.get("[data-test=add-production]").element);
    });

    it("keeps the production when the admin cancels", async () => {
      confirmWith(false);
      const fetchMock = serveDelete({ productions: ["2027", "2028"] }, () => json({}, 500));
      const wrapper = await openPage();

      await askToDelete(wrapper, "2027");

      expect(deletes(fetchMock)).toEqual([]);
      expect(years(wrapper)).toEqual(["2028", "2027"]);
    });

    it("offers no Delete for the newest", async () => {
      serveDelete({ productions: ["2027", "2028"] }, () => json({}, 500));

      const wrapper = await openPage();

      expect(deleteButton(wrapper, "2028").exists()).toBe(false);
      expect(deleteButton(wrapper, "2027").exists()).toBe(true);
    });

    it("has no actions at all with only the one production", async () => {
      serveDelete({ productions: ["2027"] }, () => json({}, 500));

      const wrapper = await openPage();

      expect(wrapper.find("th.actions").exists()).toBe(false);
    });

    it("offers no Delete to someone who isn't an admin", async () => {
      await signInAs(["casting", "stage", "tech", "wardrobe", "director"]);
      serveDelete({ productions: ["2027", "2028"] }, () => json({}, 500));

      const wrapper = await openPage();

      expect(deleteButton(wrapper, "2027").exists()).toBe(false);
    });

    it("shows a delete that stopped part way as not finished, with Delete again", async () => {
      serveDelete({ productions: ["2028"], deleting: ["2027"] }, () => json({}, 500));

      const wrapper = await openPage();

      expect(wrapper.get('tr[data-year="2027"]').text()).toContain("Not finished");
      expect(wrapper.find('tr[data-year="2027"] td[data-label=Status]').exists()).toBe(true);
      expect(wrapper.find('tr[data-year="2028"] td[data-label=Status]').exists()).toBe(false);
      expect(deleteButton(wrapper, "2027").attributes("aria-label")).toBe(
        "Delete production 2027 again",
      );
    });

    it("finishes a delete that stopped part way when it's confirmed again", async () => {
      const confirm = confirmWith(true);
      const fetchMock = serveDelete({ productions: ["2028"], deleting: ["2027"] }, () =>
        json({ productions: ["2028"] }),
      );
      const wrapper = await openPage();

      await askToDelete(wrapper, "2027");

      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Delete production 2027?"));
      expect(deletes(fetchMock)).toHaveLength(1);
      expect(wrapper.find('tr[data-year="2027"]').exists()).toBe(false);
    });

    it("says it didn't finish and shows it as not finished when the delete fails", async () => {
      confirmWith(true);
      serveDelete({ productions: ["2027", "2028"] }, () => json({}, 500), {
        productions: ["2028"],
        deleting: ["2027"],
      });
      const wrapper = await openPage();

      await askToDelete(wrapper, "2027");

      expect(wrapper.get(".form-error").text()).toBe("Couldn't finish deleting 2027. Try again.");
      expect(wrapper.get('tr[data-year="2027"]').text()).toContain("Not finished");
    });

    it("shows the API's refusal in its own words", async () => {
      confirmWith(true);
      const message = "The newest production can't be deleted.";
      serveDelete({ productions: ["2027", "2028"] }, () => json({ message }, 400));
      const wrapper = await openPage();

      await askToDelete(wrapper, "2027");

      expect(wrapper.get(".form-error").text()).toBe(message);
    });

    it("moves the admin to the newest when they delete the production they had open", async () => {
      openProduction("2027");
      confirmWith(true);
      serveDelete({ productions: ["2027", "2028"] }, () => json({ productions: ["2028"] }));
      const wrapper = await openPage();

      await askToDelete(wrapper, "2027");

      expect(openProductionYear()).toBe("2028");
    });
  });
});
