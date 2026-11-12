import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "@/app.fixture.ts";
import { castPath, rolesPath } from "@/services/production.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { aCastMember, aRole } from "@/utils/casting.fixture.ts";
import { useCasting } from "./useCasting.ts";

beforeEach(useLocalSignIn);
afterEach(() => vi.unstubAllGlobals());

const roles = [aRole(1, "opening-number", [1])];
const members = [aCastMember(1)];

/** A stand-in API holding the casting, or nothing yet (404s) when told so. */
function apiHolds(held: "the casting" | "nothing yet") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (held === "nothing yet") return new Response(null, { status: 404 });
      if (url === rolesPath()) return json({ productionId: "2027", roles });
      if (url === castPath()) return json({ productionId: "2027", members });
      return new Response(null, { status: 404 });
    }),
  );
}

describe("useCasting", () => {
  it("loads every role and the cast list, shown only when the page shows them", async () => {
    apiHolds("the casting");
    const casting = useCasting();

    const show = await casting.load();
    expect(casting.roles.value).toEqual([]);
    expect(casting.cast.value).toEqual([]);

    show();
    expect(casting.roles.value).toEqual(roles);
    expect(casting.cast.value).toEqual(members);
  });

  it("shows no roles and no cast while there are none yet", async () => {
    apiHolds("nothing yet");
    const casting = useCasting();

    (await casting.load())();

    expect(casting.roles.value).toEqual([]);
    expect(casting.cast.value).toEqual([]);
  });

  it("fails rather than showing an empty casting when the API can't give it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    await expect(useCasting().load()).rejects.toThrow();
  });
});
