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
  role: "casting",
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
// A cell with a role choice reads as the chosen role.
const rows = (wrapper: Page) =>
  wrapper.findAll("tbody tr").map((row) =>
    row.findAll("td:not(.actions)").map((cell) => {
      const choice = cell.find("select");
      return choice.exists() ? (choice.element.selectedOptions[0]?.text ?? "") : cell.text();
    }),
  );

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

  it("lists every account alphabetically, showing each one's role and which are disabled", async () => {
    serve([
      account("pat", { role: "admin" }),
      account("sam"),
      account("jo", { role: "read-only" }),
      account("lee", { enabled: false }),
    ]);

    const wrapper = await openPage();

    expect(wrapper.findAll("thead th:not(.actions)").map((th) => th.text())).toEqual([
      "Username",
      "Role",
      "Status",
    ]);
    expect(rows(wrapper)).toEqual([
      ["jo", "Read-Only Team Member", "Enabled"],
      ["lee", "Casting Team Member", "Disabled"],
      ["pat", "Admin", "Enabled"],
      ["sam", "Casting Team Member", "Enabled"],
    ]);
    // The old label; the new ones have a capital M.
    expect(wrapper.text()).not.toContain("Team member");
  });

  it("offers the three roles by name in each account's role choice, labelled for screen readers", async () => {
    serve([account("sam")]);

    const wrapper = await openPage();

    const choice = wrapper.get("select[aria-label='Role for sam']");
    expect(choice.findAll("option").map((option) => option.text())).toEqual([
      "Admin",
      "Casting Team Member",
      "Read-Only Team Member",
    ]);
  });

  it("marks admins and disabled accounts with a badge, so they stand out", async () => {
    serve([account("pat", { role: "admin" }), account("sam"), account("lee", { enabled: false })]);

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

    it("adds it to the list as an enabled Casting Team Member", async () => {
      serve([account("sam")], () => json(joCreated, 201));
      const wrapper = await openPage();

      await create(wrapper, "jo");

      expect(rows(wrapper)).toEqual([
        ["jo", "Casting Team Member", "Enabled"],
        ["sam", "Casting Team Member", "Enabled"],
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
      expect(rows(wrapper)).toEqual([["sam", "Casting Team Member", "Enabled"]]);
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
        expect(rows(wrapper)).toEqual([["sam", "Casting Team Member", "Disabled"]]);
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
        serveChanges([account("pat", { role: "admin" }), account("sam")], {});
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
        expect(rows(wrapper)).toEqual([["sam", "Casting Team Member", "Enabled"]]);
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
        expect(rows(wrapper)).toEqual([["sam", "Casting Team Member", "Enabled"]]);
        expect(wrapper.find('button[aria-label="Disable sam"]').exists()).toBe(true);
      });

      it("says an admin can't disable their own account", async () => {
        confirmWith(true);
        serveChanges([account("pat", { role: "admin" })], {
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
        expect(rows(wrapper)).toEqual([["sam", "Casting Team Member", "Enabled"]]);
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
      expect(rows(wrapper)).toEqual([["lee", "Casting Team Member", "Enabled"]]);
    });

    it("says only admins can change accounts when the API refuses", async () => {
      confirmWith(true);
      serveChanges([account("sam")], { "PUT /api/accounts/sam/enabled": () => json({}, 403) });
      const wrapper = await openPage();

      await button(wrapper, "Disable sam").trigger("click");
      await flushPromises();

      expect(wrapper.get(".notice[role=alert]").text()).toBe("Only admins can change accounts.");
    });

    describe("changing an account's role", () => {
      const choice = (wrapper: Page, username: string) =>
        wrapper.get(`select[aria-label="Role for ${username}"]`);
      const choose = async (wrapper: Page, username: string, role: string) => {
        await choice(wrapper, username).setValue(role);
        await flushPromises();
      };

      it("asks first, saying they'll be signed out and can only view, then shows them as read-only", async () => {
        const confirm = confirmWith(true);
        const fetchMock = serveChanges([account("sam")], {
          "PUT /api/accounts/sam/role": () => json(account("sam", { role: "read-only" })),
        });
        const wrapper = await openPage();

        await choose(wrapper, "sam", "read-only");

        expect(confirm).toHaveBeenCalledWith(
          "Make sam a Read-Only Team Member? They'll be signed out on every device, and can only view the show when they sign back in.",
        );
        expect(changes(fetchMock)).toEqual([
          [
            "/api/accounts/sam/role",
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ role: "read-only" }),
            },
          ],
        ]);
        expect(rows(wrapper)).toEqual([["sam", "Read-Only Team Member", "Enabled"]]);
        expect(wrapper.get("[data-test=announcement]").text()).toBe(
          "sam is now a Read-Only Team Member.",
        );
        expect(document.activeElement).toBe(choice(wrapper, "sam").element);
      });

      it("can give every role, each confirmation saying what they'll be able to do", async () => {
        const confirm = confirmWith(true);
        serveChanges([account("jo", { role: "read-only" })], {
          "PUT /api/accounts/jo/role": () => json(null),
        });
        const wrapper = await openPage();

        await choose(wrapper, "jo", "casting");
        expect(rows(wrapper)).toEqual([["jo", "Casting Team Member", "Enabled"]]);
        await choose(wrapper, "jo", "admin");
        expect(rows(wrapper)).toEqual([["jo", "Admin", "Enabled"]]);

        expect(confirm.mock.calls).toEqual([
          [
            "Make jo a Casting Team Member? They'll be signed out on every device, and can change the cast, casting and running order drafts when they sign back in.",
          ],
          [
            "Make jo an Admin? They'll be signed out on every device, and can manage accounts, delete cast members and save running orders when they sign back in.",
          ],
        ]);
      });

      it("changes nothing if the admin doesn't confirm, putting the choice back", async () => {
        confirmWith(false);
        const fetchMock = serveChanges([account("sam")], {});
        const wrapper = await openPage();

        await choose(wrapper, "sam", "admin");

        expect(changes(fetchMock)).toEqual([]);
        expect(rows(wrapper)).toEqual([["sam", "Casting Team Member", "Enabled"]]);
      });

      it("won't let the signed-in admin change their own role, saying why", async () => {
        await signInAs(["admin"], "pat");
        serveChanges([account("pat", { role: "admin" }), account("sam", { role: "admin" })], {});
        const wrapper = await openPage();

        const own = choice(wrapper, "pat");
        expect(own.attributes("disabled")).toBeDefined();
        expect(own.attributes("aria-describedby")).toBeDefined();
        const why = wrapper.get(`#${own.attributes("aria-describedby")}`);
        expect(why.text()).toBe("You can't change your own role");
        expect(choice(wrapper, "sam").attributes("disabled")).toBeUndefined();
      });

      it("shows why the API refused, such as keeping the only admin, and puts the choice back", async () => {
        confirmWith(true);
        serveChanges([account("pat", { role: "admin" })], {
          "PUT /api/accounts/pat/role": () =>
            json({ message: "pat is the only enabled admin, so they stay an admin." }, 409),
        });
        const wrapper = await openPage();

        await choose(wrapper, "pat", "casting");

        expect(wrapper.get(".notice[role=alert]").text()).toBe(
          "pat is the only enabled admin, so they stay an admin.",
        );
        expect(rows(wrapper)).toEqual([["pat", "Admin", "Enabled"]]);
        expect(document.activeElement).toBe(choice(wrapper, "pat").element);
      });

      it("says when the role couldn't be changed", async () => {
        confirmWith(true);
        serveChanges([account("sam")], { "PUT /api/accounts/sam/role": () => json({}, 500) });
        const wrapper = await openPage();

        await choose(wrapper, "sam", "admin");

        expect(wrapper.get(".notice[role=alert]").text()).toBe(
          "Couldn't change sam's role. Try again.",
        );
        expect(rows(wrapper)).toEqual([["sam", "Casting Team Member", "Enabled"]]);
      });

      it("keeps the role choice still while another change is saving", async () => {
        confirmWith(true);
        serveChanges([account("sam")], {});
        const wrapper = await openPage();

        await wrapper.get("[data-test=add-account]").trigger("click");

        expect(choice(wrapper, "sam").attributes("disabled")).toBeDefined();
      });
    });
  });
});
