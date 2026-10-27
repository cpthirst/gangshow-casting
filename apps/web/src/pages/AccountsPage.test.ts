import type { AccountSummary, CreatedAccount } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { ACCOUNTS_PATH } from "@/utils/accounts.ts";
import AccountsPage from "./AccountsPage.vue";

enableAutoUnmount(afterEach);

// Made-up usernames only (CLAUDE.md safeguarding).
const account = (username: string, flags: Partial<AccountSummary> = {}): AccountSummary => ({
  username,
  access: ["casting"],
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
// The access cell reads as the access it shows, without its button or hints.
const rows = (wrapper: Page) =>
  wrapper.findAll("tbody tr[data-username]").map((row) =>
    row.findAll("td:not(.actions)").map((cell) => {
      const access = cell.find("[data-test=access]");
      return access.exists() ? access.text() : cell.text();
    }),
  );

/** The tick box labelled with the name, such as "Stage", in the form. */
const tickBox = (form: ReturnType<Page["get"]>, name: string) =>
  form
    .findAll("label")
    .find((label) => label.text() === name)
    ?.get<HTMLInputElement>("input[type=checkbox]");

/** Each tick box in the form's access group, by its label, and whether it's ticked. */
const ticksIn = (form: ReturnType<Page["get"]>) =>
  form
    .findAll("fieldset label")
    .map((label) => [label.text(), label.get<HTMLInputElement>("input").element.checked]);

async function create(wrapper: Page, username: string, ticked: string[] = []) {
  await wrapper.get("[data-test=add-account]").trigger("click");
  await wrapper.get("input[name=username]").setValue(username);
  const form = wrapper.get("[data-test=create-account]");
  for (const name of ticked) await tickBox(form, name)?.setValue(true);
  await form.trigger("submit");
  await flushPromises();
}

const posts = (fetchMock: ReturnType<typeof serve>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

describe("Accounts page", () => {
  // As on pnpm dev: everyone acts as an admin.
  beforeEach(useLocalSignIn);
  afterEach(() => vi.unstubAllGlobals());

  it("lists every account alphabetically, showing each one's access and which are disabled", async () => {
    serve([
      account("alex", { access: "admin" }),
      account("sam"),
      account("kim", { access: ["tech", "stage"] }),
      account("jo", { access: [] }),
      account("lee", { enabled: false }),
    ]);

    const wrapper = await openPage();

    expect(wrapper.findAll("thead th:not(.actions)").map((th) => th.text())).toEqual([
      "Username",
      "Access",
      "Status",
    ]);
    expect(rows(wrapper)).toEqual([
      ["alex", "Admin", "Enabled"],
      ["jo", "Read-only", "Enabled"],
      ["kim", "Stage, Tech", "Enabled"],
      ["lee", "Casting", "Disabled"],
      ["sam", "Casting", "Enabled"],
    ]);
    // The old role names are gone (production-props FR7).
    expect(wrapper.text()).not.toContain("Team Member");
  });

  it("marks admins and disabled accounts with a badge, so they stand out", async () => {
    serve([
      account("pat", { access: "admin" }),
      account("sam"),
      account("lee", { enabled: false }),
    ]);

    const wrapper = await openPage();

    expect(wrapper.findAll("tbody .badge").map((badge) => badge.text())).toEqual([
      "Disabled",
      "Admin",
    ]);
  });

  it("labels each account's access and status, for the card layout on phones", async () => {
    serve([account("pat")]);

    const wrapper = await openPage();

    expect(wrapper.findAll("tbody td").map((cell) => cell.attributes("data-label"))).toEqual([
      "Actions",
      "Username",
      "Access",
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
      account: account("jo", { access: [] }),
      temporaryPassword: "Made-up-temp-1",
    };

    it("starts the new account with Admin and every permission unticked, saying it will be read-only", async () => {
      serve([]);
      const wrapper = await openPage();

      await wrapper.get("[data-test=add-account]").trigger("click");

      const form = wrapper.get("[data-test=create-account]");
      expect(form.get("fieldset legend").text()).toBe("Access");
      expect(ticksIn(form)).toEqual([
        ["Admin", false],
        ["Casting", false],
        ["Stage", false],
        ["Tech", false],
        ["Wardrobe", false],
      ]);
      expect(form.get("[data-test=read-only-hint]").text()).toBe(
        "With nothing ticked, the account will be read-only.",
      );
      // Screen readers hear it on each tick box, as it says what leaving them all means.
      const hintId = form.get("[data-test=read-only-hint]").attributes("id");
      expect(hintId).toBeTruthy();
      expect(
        form.findAll("fieldset input").map((input) => input.attributes("aria-describedby")),
      ).toEqual(Array(5).fill(hintId));
    });

    it("stops saying it will be read-only once a permission is ticked", async () => {
      serve([]);
      const wrapper = await openPage();
      await wrapper.get("[data-test=add-account]").trigger("click");
      const form = wrapper.get("[data-test=create-account]");

      await tickBox(form, "Tech")?.setValue(true);

      expect(form.find("[data-test=read-only-hint]").exists()).toBe(false);
      expect(form.find("fieldset input[aria-describedby]").exists()).toBe(false);
    });

    it("creates a read-only account when nothing is ticked", async () => {
      const fetchMock = serve([account("sam")], () => json(joCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      expect(posts(fetchMock).map(([, init]) => init?.body)).toEqual([
        JSON.stringify({ username: "jo", access: [] }),
      ]);
      expect(rows(wrapper)).toEqual([
        ["jo", "Read-only", "Enabled"],
        ["sam", "Casting", "Enabled"],
      ]);
    });

    it("sends the ticked permissions, then lists the account with them and shows its password once", async () => {
      const patCreated = {
        account: account("pat", { access: ["stage", "tech"] }),
        temporaryPassword: "Made-up-temp-2",
      };
      const fetchMock = serve([], () => json(patCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "pat", ["Tech", "Stage"]);

      expect(posts(fetchMock).map(([, init]) => init?.body)).toEqual([
        JSON.stringify({ username: "pat", access: ["stage", "tech"] }),
      ]);
      expect(rows(wrapper)).toEqual([["pat", "Stage, Tech", "Enabled"]]);
      expect(wrapper.get("[data-test=temporary-password]").text()).toBe("Made-up-temp-2");
    });

    it("creates an account with only Wardrobe ticked, listing it with Wardrobe", async () => {
      const chrisCreated = {
        account: account("chris", { access: ["wardrobe"] }),
        temporaryPassword: "Made-up-temp-4",
      };
      const fetchMock = serve([], () => json(chrisCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "chris", ["Wardrobe"]);

      expect(posts(fetchMock).map(([, init]) => init?.body)).toEqual([
        JSON.stringify({ username: "chris", access: ["wardrobe"] }),
      ]);
      expect(rows(wrapper)).toEqual([["chris", "Wardrobe", "Enabled"]]);
    });

    it("creates an Admin when Admin is ticked, whatever was ticked before it", async () => {
      const chrisCreated = {
        account: account("chris", { access: "admin" }),
        temporaryPassword: "Made-up-temp-3",
      };
      const fetchMock = serve([], () => json(chrisCreated, 201));
      const wrapper = await openPage();
      await wrapper.get("[data-test=add-account]").trigger("click");
      const form = wrapper.get("[data-test=create-account]");
      await tickBox(form, "Stage")?.setValue(true);

      await tickBox(form, "Admin")?.setValue(true);
      // Admin is everything, so the permissions can't be ticked alongside it.
      expect(tickBox(form, "Stage")?.attributes("disabled")).toBeDefined();
      await form.get("input[name=username]").setValue("chris");
      await form.trigger("submit");
      await flushPromises();

      expect(posts(fetchMock).map(([, init]) => init?.body)).toEqual([
        JSON.stringify({ username: "chris", access: "admin" }),
      ]);
      expect(rows(wrapper)).toEqual([["chris", "Admin", "Enabled"]]);
    });

    it("starts with nothing ticked again each time the form opens", async () => {
      serve([]);
      const wrapper = await openPage();
      await wrapper.get("[data-test=add-account]").trigger("click");
      await tickBox(wrapper.get("[data-test=create-account]"), "Admin")?.setValue(true);
      await tickBox(wrapper.get("[data-test=create-account]"), "Casting")?.setValue(true);
      await wrapper.get("[data-test=cancel]").trigger("click");

      await wrapper.get("[data-test=add-account]").trigger("click");

      expect(ticksIn(wrapper.get("[data-test=create-account]"))).toEqual([
        ["Admin", false],
        ["Casting", false],
        ["Stage", false],
        ["Tech", false],
        ["Wardrobe", false],
      ]);
    });

    it("sends the username and the access, nothing else", async () => {
      const fetchMock = serve([], () => json(joCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      expect(posts(fetchMock)).toEqual([
        [
          ACCOUNTS_PATH,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "jo", access: [] }),
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
      expect(rows(wrapper)).toEqual([["sam", "Casting", "Enabled"]]);
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

  describe("changing an account", () => {
    type Answer = () => Response;
    /** The API: GET lists the accounts; other requests get the answer for "METHOD path". */
    function serveChanges(accounts: AccountSummary[], answers: Record<string, Answer>) {
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        const answer = answers[`${init?.method ?? "GET"} ${url}`];
        return answer ? answer() : json({ accounts });
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }
    const changes = (fetchMock: ReturnType<typeof serveChanges>) =>
      fetchMock.mock.calls.filter(([, init]) => init?.method !== undefined);
    const button = (wrapper: Page, name: string) => wrapper.get(`button[aria-label="${name}"]`);
    // stubGlobal, as on the Cast page: the outer afterEach unstubs it.
    const confirmWith = (answer: boolean) => {
      const confirm = vi.fn().mockReturnValue(answer);
      vi.stubGlobal("confirm", confirm);
      return confirm;
    };

    describe("resetting a password", () => {
      const samReset: CreatedAccount = {
        account: account("sam"),
        temporaryPassword: "Made-up-temp-2",
      };

      it("shows the new temporary password once, saying they'll choose their own", async () => {
        confirmWith(true);
        serveChanges([account("sam")], {
          "POST /api/accounts/sam/password": () => json(samReset),
        });
        const wrapper = await openPage();

        await button(wrapper, "Reset sam's password").trigger("click");
        await flushPromises();

        const notice = wrapper.get("[data-test=created-account]");
        expect(notice.get("[data-test=temporary-password]").text()).toBe("Made-up-temp-2");
        expect(notice.text()).toContain("Pass this temporary password to sam");
        expect(notice.text()).toContain("sam chooses a new password when they next sign in.");
        expect(document.activeElement).toBe(notice.element);
      });

      it("tells screen readers, and keeps focus on the row once the password's passed on", async () => {
        confirmWith(true);
        serveChanges([account("sam")], {
          "POST /api/accounts/sam/password": () => json(samReset),
        });
        const wrapper = await openPage();
        await button(wrapper, "Reset sam's password").trigger("click");
        await flushPromises();

        await wrapper.get("[data-test=password-passed-on]").trigger("click");

        expect(wrapper.get("[data-test=announcement]").text()).toBe("sam's password reset.");
        expect(document.activeElement).toBe(button(wrapper, "Reset sam's password").element);
      });

      it("asks first, saying they'll be signed out everywhere, and does nothing if not", async () => {
        const confirm = confirmWith(false);
        const fetchMock = serveChanges([account("sam")], {});
        const wrapper = await openPage();

        await button(wrapper, "Reset sam's password").trigger("click");
        await flushPromises();

        expect(confirm).toHaveBeenCalledWith(
          "Reset sam's password? They'll be signed out on every device, and need the new temporary password to sign in.",
        );
        expect(changes(fetchMock)).toEqual([]);
      });

      it("says when the password couldn't be reset", async () => {
        confirmWith(true);
        serveChanges([account("sam")], {
          "POST /api/accounts/sam/password": () => json({}, 500),
        });
        const wrapper = await openPage();

        await button(wrapper, "Reset sam's password").trigger("click");
        await flushPromises();

        expect(wrapper.get(".notice[role=alert]").text()).toBe(
          "Couldn't reset sam's password. Try again.",
        );
      });
    });

    describe("disabling and enabling", () => {
      it("asks first, then disables the account, sending enabled false", async () => {
        const confirm = confirmWith(true);
        const fetchMock = serveChanges([account("sam")], {
          "PUT /api/accounts/sam/enabled": () => json(account("sam", { enabled: false })),
        });
        const wrapper = await openPage();

        await button(wrapper, "Disable sam").trigger("click");
        await flushPromises();

        expect(confirm).toHaveBeenCalledWith(
          "Disable sam? They'll be signed out on every device within 5 minutes, and can't sign in until an admin enables them again.",
        );
        expect(changes(fetchMock)).toEqual([
          [
            "/api/accounts/sam/enabled",
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ enabled: false }),
            },
          ],
        ]);
        expect(rows(wrapper)).toEqual([["sam", "Casting", "Disabled"]]);
        expect(wrapper.get("[data-test=announcement]").text()).toBe("sam disabled.");
      });

      it("names each action in its tooltip", async () => {
        serveChanges([account("sam"), account("lee", { enabled: false })], {});
        const wrapper = await openPage();

        expect(button(wrapper, "Reset sam's password").attributes("data-tooltip")).toBe(
          "Reset password",
        );
        expect(button(wrapper, "Disable sam").attributes("data-tooltip")).toBe("Disable account");
        expect(button(wrapper, "Enable lee").attributes("data-tooltip")).toBe("Enable account");
      });

      it("keeps focus in the row: on Enable once disabled, and on Disable once enabled", async () => {
        confirmWith(true);
        let enabled = true;
        vi.stubGlobal(
          "fetch",
          vi.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method === "PUT") enabled = !enabled;
            return init?.method === "PUT"
              ? json(account("sam", { enabled }))
              : json({ accounts: [account("sam")] });
          }),
        );
        const wrapper = await openPage();

        await button(wrapper, "Disable sam").trigger("click");
        await flushPromises();
        expect(document.activeElement).toBe(button(wrapper, "Enable sam").element);

        await button(wrapper, "Enable sam").trigger("click");
        await flushPromises();
        expect(document.activeElement).toBe(button(wrapper, "Disable sam").element);
      });

      it("keeps focus on the row's button when the change fails", async () => {
        confirmWith(true);
        serveChanges([account("sam")], { "PUT /api/accounts/sam/enabled": () => json({}, 500) });
        const wrapper = await openPage();

        await button(wrapper, "Disable sam").trigger("click");
        await flushPromises();

        expect(document.activeElement).toBe(button(wrapper, "Disable sam").element);
      });

      it("won't offer to disable the signed-in admin's own account, saying why", async () => {
        await signInAs(["admin"], "pat");
        serveChanges([account("pat", { access: "admin" }), account("sam")], {});
        const wrapper = await openPage();

        const own = button(wrapper, "Disable pat");
        expect(own.attributes("disabled")).toBeDefined();
        expect(own.attributes("data-tooltip")).toBe("You can't disable your own account");
        // Phones show no tooltips, so the reason is on the page too.
        const why = wrapper.get(`#${own.attributes("aria-describedby")}`);
        expect(why.text()).toBe("You can't disable your own account");
        expect(button(wrapper, "Disable sam").attributes("disabled")).toBeUndefined();
        expect(button(wrapper, "Disable sam").attributes("aria-describedby")).toBeUndefined();
      });

      it("leaves the account alone if the admin doesn't confirm", async () => {
        confirmWith(false);
        const fetchMock = serveChanges([account("sam")], {});
        const wrapper = await openPage();

        await button(wrapper, "Disable sam").trigger("click");
        await flushPromises();

        expect(changes(fetchMock)).toEqual([]);
        expect(rows(wrapper)).toEqual([["sam", "Casting", "Enabled"]]);
      });

      it("enables a disabled account straight away", async () => {
        const confirm = confirmWith(true);
        serveChanges([account("sam", { enabled: false })], {
          "PUT /api/accounts/sam/enabled": () => json(account("sam")),
        });
        const wrapper = await openPage();

        await button(wrapper, "Enable sam").trigger("click");
        await flushPromises();

        expect(confirm).not.toHaveBeenCalled();
        expect(rows(wrapper)).toEqual([["sam", "Casting", "Enabled"]]);
        expect(wrapper.find('button[aria-label="Disable sam"]').exists()).toBe(true);
      });

      it("says an admin can't disable their own account", async () => {
        confirmWith(true);
        serveChanges([account("pat", { access: "admin" })], {
          "PUT /api/accounts/pat/enabled": () =>
            json({ message: "You can't disable your own account." }, 409),
        });
        const wrapper = await openPage();

        await button(wrapper, "Disable pat").trigger("click");
        await flushPromises();

        expect(wrapper.get(".notice[role=alert]").text()).toBe(
          "You can't disable your own account.",
        );
        expect(rows(wrapper)).toEqual([["pat", "Admin", "Enabled"]]);
      });

      it("says when the account couldn't be disabled", async () => {
        confirmWith(true);
        serveChanges([account("sam")], { "PUT /api/accounts/sam/enabled": () => json({}, 500) });
        const wrapper = await openPage();

        await button(wrapper, "Disable sam").trigger("click");
        await flushPromises();

        expect(wrapper.get(".notice[role=alert]").text()).toBe("Couldn't disable sam. Try again.");
        expect(rows(wrapper)).toEqual([["sam", "Casting", "Enabled"]]);
      });
    });

    it("shows the latest list when the account has gone", async () => {
      confirmWith(true);
      let accounts = [account("sam"), account("lee")];
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method !== "PUT") return json({ accounts });
        accounts = [account("lee")];
        return json({}, 404);
      });
      vi.stubGlobal("fetch", fetchMock);
      const wrapper = await openPage();

      await button(wrapper, "Disable sam").trigger("click");
      await flushPromises();

      expect(wrapper.get(".notice[role=alert]").text()).toBe(
        "sam no longer has an account. Showing the latest list.",
      );
      expect(rows(wrapper)).toEqual([["lee", "Casting", "Enabled"]]);
    });

    it("says only admins can change accounts when the API refuses", async () => {
      confirmWith(true);
      serveChanges([account("sam")], { "PUT /api/accounts/sam/enabled": () => json({}, 403) });
      const wrapper = await openPage();

      await button(wrapper, "Disable sam").trigger("click");
      await flushPromises();

      expect(wrapper.get(".notice[role=alert]").text()).toBe("Only admins can change accounts.");
    });

    describe("changing an account's access", () => {
      const openEditor = async (wrapper: Page, username: string) => {
        await button(wrapper, `Change ${username}'s access`).trigger("click");
      };
      const editor = (wrapper: Page) => wrapper.get("[data-test=access-form]");
      const box = (wrapper: Page, name: string) =>
        editor(wrapper)
          .findAll("label")
          .find((label) => label.text() === name)
          ?.get<HTMLInputElement>("input[type=checkbox]");
      const tick = async (wrapper: Page, name: string, ticked = true) => {
        await box(wrapper, name)?.setValue(ticked);
      };
      const save = async (wrapper: Page) => {
        await editor(wrapper).trigger("submit");
        await flushPromises();
      };
      const put = (access: unknown) => ({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access }),
      });

      it("offers Admin and each permission as a labelled group of tick boxes, ticked as the account is", async () => {
        serveChanges([account("kim", { access: ["stage", "tech"] })], {});
        const wrapper = await openPage();

        await openEditor(wrapper, "kim");

        expect(editor(wrapper).get("fieldset legend").text()).toBe("Access for kim");
        const ticks = editor(wrapper)
          .findAll("label")
          .map((label) => [label.text(), label.get<HTMLInputElement>("input").element.checked]);
        expect(ticks).toEqual([
          ["Admin", false],
          ["Casting", false],
          ["Stage", true],
          ["Tech", true],
          ["Wardrobe", false],
        ]);
        expect(document.activeElement).toBe(box(wrapper, "Admin")?.element);
        // Across the whole row, as the Add account form is, not squeezed into one cell.
        expect(editor(wrapper).element.closest("td")?.getAttribute("colspan")).toBe("4");
      });

      it("confirms first, saying what they'll be able to change and that they'll be signed out, then shows the new access", async () => {
        const confirm = confirmWith(true);
        const fetchMock = serveChanges([account("kim", { access: ["stage", "tech"] })], {
          "PUT /api/accounts/kim/access": () =>
            json(account("kim", { access: ["casting", "stage", "tech"] })),
        });
        const wrapper = await openPage();

        await openEditor(wrapper, "kim");
        await tick(wrapper, "Casting");
        await save(wrapper);

        expect(confirm).toHaveBeenCalledWith(
          "Change kim's access to Casting, Stage, Tech? When they next sign in, they'll be able to change casting, and the Stage and Tech pages. kim will be signed out on every device.",
        );
        expect(changes(fetchMock)).toEqual([
          ["/api/accounts/kim/access", put(["casting", "stage", "tech"])],
        ]);
        expect(rows(wrapper)).toEqual([["kim", "Casting, Stage, Tech", "Enabled"]]);
        expect(wrapper.find("[data-test=access-form]").exists()).toBe(false);
        expect(wrapper.get("[data-test=announcement]").text()).toBe(
          "kim now has Casting, Stage, Tech.",
        );
        expect(document.activeElement).toBe(button(wrapper, "Change kim's access").element);
      });

      it("gives an account Wardrobe alone, confirming they'll be able to change the Wardrobe page", async () => {
        const confirm = confirmWith(true);
        const fetchMock = serveChanges([account("sam")], {
          "PUT /api/accounts/sam/access": () => json(account("sam", { access: ["wardrobe"] })),
        });
        const wrapper = await openPage();

        await openEditor(wrapper, "sam");
        await tick(wrapper, "Casting", false);
        await tick(wrapper, "Wardrobe");
        await save(wrapper);

        expect(confirm).toHaveBeenCalledWith(
          "Change sam's access to Wardrobe? When they next sign in, they'll be able to change the Wardrobe page. sam will be signed out on every device.",
        );
        expect(changes(fetchMock)).toEqual([["/api/accounts/sam/access", put(["wardrobe"])]]);
        expect(rows(wrapper)).toEqual([["sam", "Wardrobe", "Enabled"]]);
      });

      it("makes an account read-only when every permission is unticked, saying they'll only view the show", async () => {
        const confirm = confirmWith(true);
        const fetchMock = serveChanges([account("sam")], {
          "PUT /api/accounts/sam/access": () => json(account("sam", { access: [] })),
        });
        const wrapper = await openPage();

        await openEditor(wrapper, "sam");
        await tick(wrapper, "Casting", false);
        await save(wrapper);

        expect(confirm).toHaveBeenCalledWith(
          "Make sam read-only? When they next sign in, they'll only be able to view the show. sam will be signed out on every device.",
        );
        expect(changes(fetchMock)).toEqual([["/api/accounts/sam/access", put([])]]);
        expect(rows(wrapper)).toEqual([["sam", "Read-only", "Enabled"]]);
      });

      it("makes an account an Admin, saying what admins can do, and later gives it permissions instead", async () => {
        const confirm = confirmWith(true);
        const fetchMock = serveChanges([account("sam")], {
          "PUT /api/accounts/sam/access": () => json(null),
        });
        const wrapper = await openPage();

        await openEditor(wrapper, "sam");
        await tick(wrapper, "Admin");
        // Admin is everything, so the permissions can't be ticked alongside it.
        expect(box(wrapper, "Stage")?.attributes("disabled")).toBeDefined();
        await save(wrapper);
        expect(rows(wrapper)).toEqual([["sam", "Admin", "Enabled"]]);

        await openEditor(wrapper, "sam");
        await tick(wrapper, "Admin", false);
        await tick(wrapper, "Casting");
        await tick(wrapper, "Stage");
        await save(wrapper);

        expect(confirm.mock.calls).toEqual([
          [
            "Make sam an Admin? When they next sign in, they'll be able to change everything, manage accounts, delete cast members and save running orders. sam will be signed out on every device.",
          ],
          [
            "Change sam's access to Casting, Stage? When they next sign in, they'll be able to change casting, and the Stage page. sam will be signed out on every device.",
          ],
        ]);
        expect(changes(fetchMock).map(([, init]) => init?.body)).toEqual([
          JSON.stringify({ access: "admin" }),
          JSON.stringify({ access: ["casting", "stage"] }),
        ]);
        expect(rows(wrapper)).toEqual([["sam", "Casting, Stage", "Enabled"]]);
      });

      it("closes without asking or saving when the access is unchanged, so no one is signed out", async () => {
        const confirm = confirmWith(true);
        const fetchMock = serveChanges([account("kim", { access: ["stage", "tech"] })], {});
        const wrapper = await openPage();

        await openEditor(wrapper, "kim");
        await tick(wrapper, "Tech", false);
        await tick(wrapper, "Tech");
        await save(wrapper);

        expect(confirm).not.toHaveBeenCalled();
        expect(changes(fetchMock)).toEqual([]);
        expect(wrapper.find("[data-test=access-form]").exists()).toBe(false);
        expect(rows(wrapper)).toEqual([["kim", "Stage, Tech", "Enabled"]]);
        expect(document.activeElement).toBe(button(wrapper, "Change kim's access").element);
      });

      it("changes nothing if the admin cancels the confirmation", async () => {
        confirmWith(false);
        const fetchMock = serveChanges([account("kim", { access: ["stage"] })], {});
        const wrapper = await openPage();

        await openEditor(wrapper, "kim");
        await tick(wrapper, "Casting");
        await save(wrapper);

        expect(changes(fetchMock)).toEqual([]);
        expect(rows(wrapper)).toEqual([["kim", "Stage", "Enabled"]]);
      });

      it.each([
        [
          "Cancel",
          (wrapper: Page) => editor(wrapper).get("[data-test=cancel-access]").trigger("click"),
        ],
        ["Escape", (wrapper: Page) => editor(wrapper).trigger("keydown", { key: "Escape" })],
      ])("closes the tick boxes on %s, changing nothing", async (_case, close) => {
        const fetchMock = serveChanges([account("kim", { access: ["stage"] })], {});
        const wrapper = await openPage();
        await openEditor(wrapper, "kim");
        await tick(wrapper, "Casting");

        await close(wrapper);

        expect(wrapper.find("[data-test=access-form]").exists()).toBe(false);
        expect(changes(fetchMock)).toEqual([]);
        expect(rows(wrapper)).toEqual([["kim", "Stage", "Enabled"]]);
        expect(document.activeElement).toBe(button(wrapper, "Change kim's access").element);
      });

      it("won't let the signed-in admin change their own access, saying why", async () => {
        await signInAs(["admin"], "alex");
        serveChanges(
          [account("alex", { access: "admin" }), account("sam", { access: "admin" })],
          {},
        );
        const wrapper = await openPage();

        const own = button(wrapper, "Change alex's access");
        expect(own.classes()).toContain("icon-button");
        expect(own.element.closest("td")?.classList.contains("actions")).toBe(true);
        expect(own.attributes("data-tooltip")).toBe("You can't change your own access");
        expect(button(wrapper, "Change sam's access").attributes("data-tooltip")).toBe(
          "Change access",
        );
        expect(own.attributes("disabled")).toBeDefined();
        expect(own.attributes("aria-describedby")).toBeDefined();
        const why = wrapper.get(`#${own.attributes("aria-describedby")}`);
        expect(why.text()).toBe("You can't change your own access");
        expect(button(wrapper, "Change sam's access").attributes("disabled")).toBeUndefined();
      });

      it("shows why the API refused, such as keeping the only admin, leaving the access as it was", async () => {
        confirmWith(true);
        serveChanges([account("pat", { access: "admin" })], {
          "PUT /api/accounts/pat/access": () =>
            json({ message: "pat is the only enabled admin, so they stay an admin." }, 409),
        });
        const wrapper = await openPage();

        await openEditor(wrapper, "pat");
        await tick(wrapper, "Admin", false);
        await tick(wrapper, "Casting");
        await save(wrapper);

        expect(wrapper.get(".notice[role=alert]").text()).toBe(
          "pat is the only enabled admin, so they stay an admin.",
        );
        expect(rows(wrapper)).toEqual([["pat", "Admin", "Enabled"]]);
      });

      it("says when the access couldn't be changed", async () => {
        confirmWith(true);
        serveChanges([account("sam")], { "PUT /api/accounts/sam/access": () => json({}, 500) });
        const wrapper = await openPage();

        await openEditor(wrapper, "sam");
        await tick(wrapper, "Admin");
        await save(wrapper);

        expect(wrapper.get(".notice[role=alert]").text()).toBe(
          "Couldn't change sam's access. Try again.",
        );
        expect(rows(wrapper)).toEqual([["sam", "Casting", "Enabled"]]);
      });

      it("keeps the access button still while another change is open", async () => {
        serveChanges([account("sam")], {});
        const wrapper = await openPage();

        await wrapper.get("[data-test=add-account]").trigger("click");

        expect(button(wrapper, "Change sam's access").attributes("disabled")).toBeDefined();
      });
    });
  });
});
