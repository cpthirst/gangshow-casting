import type { CastList, CastMember, Role, RoleList } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { castPath, rolesPath, runningOrderPath } from "@/services/production.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import CastPage from "./CastPage.vue";

// The Cast page asking before a section change takes someone out of roles (junior-cast FR12).
// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).

enableAutoUnmount(afterEach);

const ollie: CastMember = {
  id: 1,
  firstName: "Ollie",
  lastName: "Sample",
  section: "cubs",
  group: "1st Somewhere",
  revision: 1,
};
const chiefBeaver: Role = {
  id: 1,
  itemId: "beaver-bop",
  name: "Chief Beaver",
  size: "lead",
  castMemberIds: [ollie.id],
  revision: 1,
};
const finaleChorus: Role = { ...chiefBeaver, id: 2, itemId: "grand-finale", name: "Chorus" };
const order = aRunningOrder([
  anItem("Beaver Bop", { gang: "junior" }),
  anItem("Grand Finale", { gang: "both" }),
]);

let puts: unknown[];
let confirm: ReturnType<typeof vi.fn>;

/** The stand-in API: Ollie's cast list, their role and the running order, and saves. */
function serve(confirmed: boolean, ollieIn: Role[] = [chiefBeaver]) {
  puts = [];
  confirm = vi.fn().mockReturnValue(confirmed);
  vi.stubGlobal("confirm", confirm);
  const cast: CastList = { productionId: "2027", members: [ollie] };
  const roles: RoleList = { productionId: "2027", roles: ollieIn };
  const answers = new Map<string, unknown>([
    [castPath(), cast],
    [rolesPath(), roles],
    [runningOrderPath(), order],
  ]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method !== "PUT") return new Response(JSON.stringify(answers.get(url)));
      const { revision, ...details } = JSON.parse(String(init.body));
      puts.push(details);
      return new Response(JSON.stringify({ ...details, id: ollie.id, revision: revision + 1 }));
    }),
  );
}

async function saveSection(section: string) {
  const wrapper = mount(CastPage, { attachTo: document.body });
  await flushPromises();
  await wrapper.get('button[aria-label="Edit Ollie Sample"]').trigger("click");
  await flushPromises();
  await wrapper.get("[name=section]").setValue(section);
  await wrapper.get("form[data-test=cast-member-form]").trigger("submit");
  await flushPromises();
  return wrapper;
}

describe("Cast page, changing a member's section", () => {
  beforeEach(useLocalSignIn);
  afterEach(() => vi.unstubAllGlobals());

  it("asks first, naming the roles they'd leave, and saves nothing on going back", async () => {
    serve(false);

    const wrapper = await saveSection("scouts");

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Chief Beaver in Beaver Bop"));
    expect(puts).toEqual([]);
    expect(wrapper.find("form[data-test=cast-member-form]").exists()).toBe(true);
  });

  it("saves the new section once confirmed", async () => {
    serve(true);

    await saveSection("scouts");

    expect(puts).toEqual([expect.objectContaining({ section: "scouts" })]);
  });

  it("saves with no question when they move gang but leave no role", async () => {
    serve(false, [finaleChorus]);

    await saveSection("scouts");

    expect(confirm).not.toHaveBeenCalled();
    expect(puts).toEqual([expect.objectContaining({ section: "scouts" })]);
  });

  it("saves with no question when they stay in the same gang", async () => {
    serve(false);

    await saveSection("beavers");

    expect(confirm).not.toHaveBeenCalled();
    expect(puts).toEqual([expect.objectContaining({ section: "beavers" })]);
  });
});
