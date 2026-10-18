import type { AccountSummary, CreatedAccount } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNTS_PATH } from "../accounts.ts";
import { useLocalSignIn } from "../sign-in.ts";
import AccountsPage from "./AccountsPage.vue";

enableAutoUnmount(afterEach);

// Made-up usernames only (CLAUDE.md safeguarding).
const account = (username: string, flags: Partial<AccountSummary> = {}): AccountSummary => ({
  username,
  admin: false,
  enabled: true,
  ...flags,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** The API: GET lists the accounts; POST answers with `created`. */
function serve(accounts: AccountSummary[], created: () => Response = () => json({}, 500)) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST" ? created() : json({ accounts }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openPage() {
  const wrapper = mount(AccountsPage, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

type Page = Awaited<ReturnType<typeof openPage>>;
const rows = (wrapper: Page) =>
  wrapper.findAll("tbody tr").map((row) => row.findAll("td").map((cell) => cell.text()));

async function create(wrapper: Page, username: string) {
  await wrapper.get("[data-test=add-account]").trigger("click");
  await wrapper.get("input[name=username]").setValue(username);
  await wrapper.get("[data-test=create-account]").trigger("submit");
  await flushPromises();
}

const posts = (fetchMock: ReturnType<typeof serve>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

describe("Accounts page", () => {
  // As on pnpm dev: everyone acts as an admin.
  beforeEach(useLocalSignIn);
  afterEach(() => vi.unstubAllGlobals());

  it("lists every account alphabetically, showing which are admins and which are disabled", async () => {
    serve([account("pat", { admin: true }), account("sam"), account("lee", { enabled: false })]);

    const wrapper = await openPage();

    expect(wrapper.findAll("thead th").map((th) => th.text())).toEqual([
      "Username",
      "Role",
      "Status",
    ]);
    expect(rows(wrapper)).toEqual([
      ["lee", "Team member", "Disabled"],
      ["pat", "Admin", "Enabled"],
      ["sam", "Team member", "Enabled"],
    ]);
  });

  it("marks admins and disabled accounts with a badge, so they stand out", async () => {
    serve([account("pat", { admin: true }), account("sam"), account("lee", { enabled: false })]);

    const wrapper = await openPage();

    expect(wrapper.findAll("tbody .badge").map((badge) => badge.text())).toEqual([
      "Disabled",
      "Admin",
    ]);
  });

  it("labels each account's role and status, for the card layout on phones", async () => {
    serve([account("pat")]);

    const wrapper = await openPage();

    expect(wrapper.findAll("tbody td").map((cell) => cell.attributes("data-label"))).toEqual([
      "Username",
      "Role",
      "Status",
    ]);
  });

  it("says when there are no accounts yet", async () => {
    serve([]);

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("No accounts yet.");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("sorts usernames ignoring case", async () => {
    serve([account("Sam"), account("alex"), account("Lee")]);

    const wrapper = await openPage();

    expect(rows(wrapper).map(([username]) => username)).toEqual(["alex", "Lee", "Sam"]);
  });

  it("fetches the accounts from the API", async () => {
    const fetchMock = serve([]);

    await openPage();

    expect(fetchMock).toHaveBeenCalledWith("/api/accounts");
  });

  it("says when the accounts can't be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 500)));

    const wrapper = await openPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the accounts.");
  });

  it("says only admins can see accounts when the API refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 403)));

    const wrapper = await openPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Only admins can see accounts.");
    expect(wrapper.find("[data-test=add-account]").exists()).toBe(false);
  });

  describe("adding an account", () => {
    it("opens the form from Add account, ready to type a username", async () => {
      serve([]);
      const wrapper = await openPage();

      expect(wrapper.find("[data-test=create-account]").exists()).toBe(false);
      await wrapper.get("[data-test=add-account]").trigger("click");

      const form = wrapper.get("[data-test=create-account]");
      expect(form.attributes("aria-label")).toBe("Add an account");
      expect(document.activeElement).toBe(wrapper.get("input[name=username]").element);
    });

    it.each([
      [
        "Cancel",
        (form: ReturnType<Page["get"]>) => form.get("[data-test=cancel]").trigger("click"),
      ],
      ["Escape", (form: ReturnType<Page["get"]>) => form.trigger("keydown", { key: "Escape" })],
    ])("closes the form on %s, adding nothing", async (_case, close) => {
      const fetchMock = serve([]);
      const wrapper = await openPage();
      await wrapper.get("[data-test=add-account]").trigger("click");
      await wrapper.get("input[name=username]").setValue("jo");

      await close(wrapper.get("[data-test=create-account]"));

      expect(wrapper.find("[data-test=create-account]").exists()).toBe(false);
      expect(document.activeElement).toBe(wrapper.get("[data-test=add-account]").element);
      expect(posts(fetchMock)).toEqual([]);
    });

    const joCreated: CreatedAccount = {
      account: account("jo"),
      temporaryPassword: "Made-up-temp-1",
    };

    it("adds it to the list, not an admin and enabled", async () => {
      serve([account("sam")], () => json(joCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      expect(rows(wrapper)).toEqual([
        ["jo", "Team member", "Enabled"],
        ["sam", "Team member", "Enabled"],
      ]);
    });

    it("sends just the username", async () => {
      const fetchMock = serve([], () => json(joCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      expect(posts(fetchMock)).toEqual([
        [
          ACCOUNTS_PATH,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "jo" }),
          },
        ],
      ]);
    });

    it("shows the temporary password once, to pass on, saying they'll choose their own", async () => {
      serve([], () => json(joCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      const created = wrapper.get("[data-test=created-account]");
      expect(created.get("[data-test=temporary-password]").text()).toBe("Made-up-temp-1");
      expect(created.text()).toContain("Pass this temporary password to jo");
      expect(created.text()).toContain("It won't be shown again.");
      expect(created.text()).toContain("jo chooses a new password when they first sign in.");
    });

    it("hides the password again once they say they've passed it on", async () => {
      serve([], () => json(joCreated, 201));
      const wrapper = await openPage();
      await create(wrapper, "jo");

      await wrapper.get("[data-test=password-passed-on]").trigger("click");

      expect(wrapper.find("[data-test=created-account]").exists()).toBe(false);
      expect(wrapper.text()).not.toContain("Made-up-temp-1");
    });

    it("closes the form and moves to the password, read out as an alert", async () => {
      serve([], () => json(joCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      const created = wrapper.get("[data-test=created-account]");
      expect(wrapper.find("[data-test=create-account]").exists()).toBe(false);
      expect(created.attributes("role")).toBe("alert");
      expect(document.activeElement).toBe(created.element);
    });

    it("opens the form empty for the next account", async () => {
      serve([], () => json(joCreated, 201));
      const wrapper = await openPage();
      await create(wrapper, "jo");

      await wrapper.get("[data-test=add-account]").trigger("click");

      expect(wrapper.get<HTMLInputElement>("input[name=username]").element.value).toBe("");
    });

    it("says when a username is already taken, creating nothing", async () => {
      serve([account("sam")], () => json({ message: "That username is already taken." }, 409));
      const wrapper = await openPage();

      await create(wrapper, "Sam");

      expect(wrapper.get(".field-error").text()).toBe("That username is already taken.");
      expect(wrapper.get("input[name=username]").attributes("aria-invalid")).toBe("true");
      expect(rows(wrapper)).toEqual([["sam", "Team member", "Enabled"]]);
      expect(wrapper.find("[data-test=created-account]").exists()).toBe(false);
    });

    it.each([
      ["empty", ""],
      ["with spaces", "jo smith"],
      ["longer than 32 characters", "j".repeat(33)],
    ])("says what a username may be when it's %s, without sending it", async (_case, username) => {
      const fetchMock = serve([]);
      const wrapper = await openPage();

      await create(wrapper, username);

      expect(wrapper.get(".field-error").text()).toBe(
        "A username is 1–32 letters, digits, dots, hyphens or underscores.",
      );
      expect(posts(fetchMock)).toEqual([]);
    });

    it("says when the account couldn't be added", async () => {
      serve([], () => json({}, 500));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      expect(wrapper.get(".form-error").text()).toBe("Couldn't add the account. Try again.");
      expect(rows(wrapper)).toEqual([]);
    });

    it("says only admins can add accounts when the API refuses", async () => {
      serve([], () => json({ message: "Only admins can do this." }, 403));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      expect(wrapper.get(".form-error").text()).toBe("Only admins can add accounts.");
    });
  });
});
