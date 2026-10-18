import type { AccountSummary, CreatedAccount } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNTS_PATH } from "../accounts.ts";
import { signInAs } from "../sign-in.fixture.ts";
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
  wrapper
    .findAll("tbody tr")
    .map((row) => row.findAll("td:not(.actions)").map((cell) => cell.text()));

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

    expect(wrapper.findAll("thead th:not(.actions)").map((th) => th.text())).toEqual([
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
      "Actions",
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
          "Disable sam? They'll be signed out on every device within the hour, and can't sign in until an admin enables them again.",
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
        expect(rows(wrapper)).toEqual([["sam", "Team member", "Disabled"]]);
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
        serveChanges([account("pat", { admin: true }), account("sam")], {});
        const wrapper = await openPage();

        const own = button(wrapper, "Disable pat");
        expect(own.attributes("disabled")).toBeDefined();
        expect(own.attributes("data-tooltip")).toBe("You can't disable your own account");
        expect(button(wrapper, "Disable sam").attributes("disabled")).toBeUndefined();
      });

      it("leaves the account alone if the admin doesn't confirm", async () => {
        confirmWith(false);
        const fetchMock = serveChanges([account("sam")], {});
        const wrapper = await openPage();

        await button(wrapper, "Disable sam").trigger("click");
        await flushPromises();

        expect(changes(fetchMock)).toEqual([]);
        expect(rows(wrapper)).toEqual([["sam", "Team member", "Enabled"]]);
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
        expect(rows(wrapper)).toEqual([["sam", "Team member", "Enabled"]]);
        expect(wrapper.find('button[aria-label="Disable sam"]').exists()).toBe(true);
      });

      it("says an admin can't disable their own account", async () => {
        confirmWith(true);
        serveChanges([account("pat", { admin: true })], {
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
        expect(rows(wrapper)).toEqual([["sam", "Team member", "Enabled"]]);
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
      expect(rows(wrapper)).toEqual([["lee", "Team member", "Enabled"]]);
    });

    it("says only admins can change accounts when the API refuses", async () => {
      confirmWith(true);
      serveChanges([account("sam")], { "PUT /api/accounts/sam/enabled": () => json({}, 403) });
      const wrapper = await openPage();

      await button(wrapper, "Disable sam").trigger("click");
      await flushPromises();

      expect(wrapper.get(".notice[role=alert]").text()).toBe("Only admins can change accounts.");
    });

    describe("making an account an admin, or not", () => {
      it("asks first, saying they'll be signed out and what they'll be able to do, then shows them as an admin", async () => {
        const confirm = confirmWith(true);
        const fetchMock = serveChanges([account("sam")], {
          "PUT /api/accounts/sam/admin": () => json(account("sam", { admin: true })),
        });
        const wrapper = await openPage();

        await button(wrapper, "Make sam an admin").trigger("click");
        await flushPromises();

        expect(confirm).toHaveBeenCalledWith(
          "Make sam an admin? They'll be signed out on every device, and can manage accounts, delete cast members and save running orders when they sign back in.",
        );
        expect(changes(fetchMock)).toEqual([
          [
            "/api/accounts/sam/admin",
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ admin: true }),
            },
          ],
        ]);
        expect(rows(wrapper)).toEqual([["sam", "Admin", "Enabled"]]);
        expect(wrapper.get("[data-test=announcement]").text()).toBe("sam is now an admin.");
        expect(document.activeElement).toBe(button(wrapper, "Remove sam's admin role").element);
      });

      it("asks first, saying they'll be signed out, then shows them as a team member", async () => {
        const confirm = confirmWith(true);
        serveChanges([account("sam", { admin: true })], {
          "PUT /api/accounts/sam/admin": () => json(account("sam")),
        });
        const wrapper = await openPage();

        await button(wrapper, "Remove sam's admin role").trigger("click");
        await flushPromises();

        expect(confirm).toHaveBeenCalledWith(
          "Remove admin from sam? They'll be signed out on every device, and can sign back in as a team member.",
        );
        expect(rows(wrapper)).toEqual([["sam", "Team member", "Enabled"]]);
        expect(wrapper.get("[data-test=announcement]").text()).toBe("sam is no longer an admin.");
        expect(document.activeElement).toBe(button(wrapper, "Make sam an admin").element);
      });

      it("changes nothing if the admin doesn't confirm", async () => {
        confirmWith(false);
        const fetchMock = serveChanges([account("sam")], {});
        const wrapper = await openPage();

        await button(wrapper, "Make sam an admin").trigger("click");
        await flushPromises();

        expect(changes(fetchMock)).toEqual([]);
        expect(rows(wrapper)).toEqual([["sam", "Team member", "Enabled"]]);
      });

      it("names each action in its tooltip", async () => {
        serveChanges([account("sam"), account("pat", { admin: true })], {});
        const wrapper = await openPage();

        expect(button(wrapper, "Make sam an admin").attributes("data-tooltip")).toBe("Make admin");
        expect(button(wrapper, "Remove pat's admin role").attributes("data-tooltip")).toBe(
          "Remove admin",
        );
      });

      it("says an admin can't remove their own admin role", async () => {
        confirmWith(true);
        serveChanges([account("pat", { admin: true })], {
          "PUT /api/accounts/pat/admin": () =>
            json({ message: "You can't remove your own admin role." }, 409),
        });
        const wrapper = await openPage();

        await button(wrapper, "Remove pat's admin role").trigger("click");
        await flushPromises();

        expect(wrapper.get(".notice[role=alert]").text()).toBe(
          "You can't remove your own admin role.",
        );
        expect(rows(wrapper)).toEqual([["pat", "Admin", "Enabled"]]);
        expect(document.activeElement).toBe(button(wrapper, "Remove pat's admin role").element);
      });

      it("won't offer to remove the signed-in admin's own role, saying why", async () => {
        await signInAs(["admin"], "pat");
        serveChanges([account("pat", { admin: true }), account("sam", { admin: true })], {});
        const wrapper = await openPage();

        const own = button(wrapper, "Remove pat's admin role");
        expect(own.attributes("disabled")).toBeDefined();
        expect(own.attributes("data-tooltip")).toBe("You can't remove your own admin role");
        expect(button(wrapper, "Remove sam's admin role").attributes("disabled")).toBeUndefined();
      });

      it("says when the role couldn't be changed", async () => {
        confirmWith(true);
        serveChanges([account("sam")], { "PUT /api/accounts/sam/admin": () => json({}, 500) });
        const wrapper = await openPage();

        await button(wrapper, "Make sam an admin").trigger("click");
        await flushPromises();

        expect(wrapper.get(".notice[role=alert]").text()).toBe(
          "Couldn't make sam an admin. Try again.",
        );
      });
    });
  });
});

describe("Accounts page icons", () => {
  it("gives the admin actions shield icons, unlike Disable's", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(json({ accounts: [account("pat", { admin: true }), account("sam")] })),
    );
    useLocalSignIn();
    const wrapper = await openPage();
    const iconOf = (name: string) =>
      wrapper.get(`button[aria-label="${name}"] svg`).attributes("data-icon");

    expect([iconOf("Make sam an admin"), iconOf("Remove pat's admin role")]).toEqual([
      "user-shield",
      "shield-halved",
    ]);
    expect(iconOf("Disable sam")).toBe("user-slash");
    vi.unstubAllGlobals();
  });
});
