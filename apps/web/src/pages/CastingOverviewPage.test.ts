import type { CastMember, Role, RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "../App.vue";
import { CAST_PATH } from "../cast.ts";
import { ROLES_PATH } from "../roles.ts";
import { createAppRouter } from "../router.ts";
import { anItem, aRunningOrder } from "../running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "../running-order.ts";
import { signInAs } from "../sign-in.fixture.ts";
import { useLocalSignIn } from "../sign-in.ts";

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
let nextId = 1;
const person = (firstName: string, lastName: string, section: CastMember["section"]) => ({
  id: nextId++,
  firstName,
  lastName,
  section,
  group: "",
  revision: 1,
});

function castIs(members: CastMember[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === CAST_PATH
        ? new Response(JSON.stringify({ productionId: "2027", members }))
        : new Response(JSON.stringify({ status: "ok", version: "dev" })),
    ),
  );
}

async function openOverview() {
  const router = createAppRouter(createMemoryHistory());
  await router.push("/casting/overview");
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const sections = (wrapper: VueWrapper) =>
  wrapper.findAll("main section").map((section) => ({
    heading: section.get("h2").text().replace(/\s+/g, " "),
    people: section.findAll("[data-test=person] .person-name").map((name) => name.text()),
  }));

describe("Casting overview page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("lists everyone under their section", async () => {
    castIs([
      person("Sam", "Example", "scouts"),
      person("Alex", "Sample", "explorers"),
      person("Kit", "Person", "network"),
    ]);

    const wrapper = await openOverview();

    expect(sections(wrapper).map(({ heading, people }) => [heading, people])).toEqual([
      ["Scouts 1 person", ["Sam Example"]],
      ["Explorers 1 person", ["Alex Sample"]],
      ["Network 1 person", ["Kit Person"]],
    ]);
  });

  it("orders the sections, with people who have no section last", async () => {
    castIs([
      person("Jo", "Newcomer", null),
      person("Kit", "Person", "network"),
      person("Alex", "Sample", "explorers"),
      person("Sam", "Example", "scouts"),
    ]);

    const wrapper = await openOverview();

    const headings = wrapper.findAll("main section h2 .section-name").map((h) => h.text());
    expect(headings).toEqual(["Scouts", "Explorers", "Network", "Not set"]);
    expect(sections(wrapper)[3]?.people).toEqual(["Jo Newcomer"]);
  });

  it("doesn't show a section with nobody in it", async () => {
    castIs([person("Sam", "Example", "scouts"), person("Alex", "Sample", "explorers")]);

    const wrapper = await openOverview();

    expect(wrapper.text()).not.toContain("Network");
  });

  it("says how many people are in each section", async () => {
    castIs([
      person("Sam", "Example", "scouts"),
      person("Zoe", "Adams", "scouts"),
      person("Ben", "Carter", "scouts"),
      person("Alex", "Sample", "explorers"),
    ]);

    const wrapper = await openOverview();

    expect(wrapper.findAll("main section h2 .section-count").map((c) => c.text())).toEqual([
      "3 people",
      "1 person",
    ]);
  });

  it("shows each person as a card like a role card, name in bold", async () => {
    castIs([person("Sam", "Example", "scouts")]);

    const wrapper = await openOverview();

    const card = wrapper.get("[data-test=person]");
    expect(card.classes()).toContain("role-card");
    expect(card.get(".person-name").classes()).toContain("role-name");
  });

  it("presents each section as a list, so screen readers say how many", async () => {
    castIs([
      person("Sam", "Example", "scouts"),
      person("Zoe", "Adams", "scouts"),
      person("Ben", "Carter", "scouts"),
    ]);

    const wrapper = await openOverview();

    const list = wrapper.get("main section ul[role=list]");
    expect(list.findAll(":scope > li")).toHaveLength(3);
    // Named by its heading, so the list is announced as "Scouts".
    expect(list.attributes("aria-labelledby")).toBe(
      wrapper.get("main section h2").attributes("id"),
    );
  });

  it("reports a cast that can't be loaded rather than an empty one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === CAST_PATH
          ? new Response(null, { status: 500 })
          : new Response(JSON.stringify({ status: "ok", version: "dev" })),
      ),
    );

    const wrapper = await openOverview();

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the cast.");
    expect(wrapper.find("main section").exists()).toBe(false);
  });

  it("says when there's nobody in the cast yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === CAST_PATH
          ? new Response(null, { status: 404 })
          : new Response(JSON.stringify({ status: "ok", version: "dev" })),
      ),
    );

    const wrapper = await openOverview();

    expect(wrapper.get("main").text()).toContain("No cast members yet.");
  });

  it("replaces the placeholder at the same address", async () => {
    castIs([person("Sam", "Example", "scouts")]);

    const wrapper = await openOverview();

    expect(wrapper.get("main").text()).not.toContain("Coming soon");
    expect(wrapper.get("main h1").text()).toBe("Overview");
  });
});

describe("Casting overview parts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const show = aRunningOrder([anItem("Pirate Sketch")], [anItem("Campfire Song")]);
  let roleId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[]): Role => ({
    id: roleId,
    itemId,
    name: `Role ${roleId++}`,
    size,
    castMemberIds,
    revision: 1,
  });

  /** A stand-in API: the cast, the roles and the saved running order. A path given as
   *  `status` answers with that status instead (e.g. a 500, or 404 for no running order). */
  function theShowIs(
    members: CastMember[],
    roles: Role[],
    { order = show, status = {} }: { order?: RunningOrder; status?: Record<string, number> } = {},
  ) {
    const answers: Record<string, unknown> = {
      [CAST_PATH]: { productionId: "2027", members },
      [ROLES_PATH]: { productionId: "2027", roles },
      [RUNNING_ORDER_PATH]: order,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const code = status[url];
        if (code) return new Response(null, { status: code });
        if (url in answers) return new Response(JSON.stringify(answers[url]));
        // Anything else (the shell's health check) is fine.
        return new Response(JSON.stringify({ status: "ok", version: "dev" }));
      }),
    );
  }

  const cardFor = (wrapper: VueWrapper, name: string) =>
    wrapper.findAll("[data-test=person]").find((card) => card.get(".person-name").text() === name);
  const pills = (wrapper: VueWrapper, name: string) =>
    cardFor(wrapper, name)
      ?.findAll("[data-test=size]")
      .map((pill) => pill.text().replace(/\s+/g, " "));

  it("shows a pill per role size, with a count", async () => {
    const sam = person("Sam", "Example", "scouts");
    theShowIs(
      [sam],
      [
        role("pirate-sketch", "lead", [sam.id]),
        role("pirate-sketch", "ensemble", [sam.id]),
        role("campfire-song", "ensemble", [sam.id]),
        role("campfire-song", "ensemble", [sam.id]),
      ],
    );

    const wrapper = await openOverview();

    expect(pills(wrapper, "Sam Example")).toEqual(["Lead · 1", "Ensemble · 3"]);
  });

  it("uses the role cards' pills, biggest size first", async () => {
    const alex = person("Alex", "Sample", "explorers");
    theShowIs(
      [alex],
      [
        role("pirate-sketch", "cameo", [alex.id]),
        role("pirate-sketch", "lead", [alex.id]),
        role("campfire-song", "support", [alex.id]),
      ],
    );

    const wrapper = await openOverview();

    expect(pills(wrapper, "Alex Sample")).toEqual(["Lead · 1", "Support · 1", "Cameo · 1"]);
    const classes = cardFor(wrapper, "Alex Sample")
      ?.findAll("[data-test=size]")
      .map((pill) => pill.classes().join(" "));
    expect(classes).toEqual(["pill pill-lead", "pill pill-support", "pill pill-cameo"]);
  });

  it("only shows pills for sizes they have", async () => {
    const sam = person("Sam", "Example", "scouts");
    theShowIs([sam], [role("pirate-sketch", "lead", [sam.id])]);

    const wrapper = await openOverview();

    expect(pills(wrapper, "Sam Example")).toEqual(["Lead · 1"]);
  });

  it("marks someone in no roles, like Uncast on a role card", async () => {
    theShowIs([person("Jo", "Newcomer", null)], []);

    const wrapper = await openOverview();

    const marker = cardFor(wrapper, "Jo Newcomer")?.get("[data-test=no-parts]");
    expect(marker?.text()).toBe("No parts yet");
    expect(marker?.classes()).toContain("uncast");
  });

  it("only counts roles in the saved running order", async () => {
    const sam = person("Sam", "Example", "scouts");
    theShowIs([sam], [role("cut-item", "lead", [sam.id])]);

    const wrapper = await openOverview();

    expect(pills(wrapper, "Sam Example")).toEqual([]);
    expect(cardFor(wrapper, "Sam Example")?.text()).toContain("No parts yet");
  });

  it("reads the pills out in words", async () => {
    const sam = person("Sam", "Example", "scouts");
    theShowIs(
      [sam],
      [
        role("pirate-sketch", "lead", [sam.id]),
        role("pirate-sketch", "ensemble", [sam.id]),
        role("campfire-song", "ensemble", [sam.id]),
        role("campfire-song", "ensemble", [sam.id]),
      ],
    );

    const wrapper = await openOverview();

    const card = cardFor(wrapper, "Sam Example");
    expect(card?.get(".visually-hidden").text()).toBe("1 lead, 3 ensemble");
    expect(card?.get(".person-parts").attributes("aria-hidden")).toBe("true");
  });

  it.each([
    ["the roles", ROLES_PATH],
    ["the running order", RUNNING_ORDER_PATH],
  ])("reports %s failing to load rather than showing no parts", async (_case, failing) => {
    theShowIs([person("Sam", "Example", "scouts")], [], { status: { [failing]: 500 } });

    const wrapper = await openOverview();

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the casting.");
    expect(wrapper.text()).not.toContain("No parts yet");
  });

  it("marks everyone as having no parts when there's no saved running order yet", async () => {
    const sam = person("Sam", "Example", "scouts");
    theShowIs([sam], [role("pirate-sketch", "lead", [sam.id])], {
      status: { [RUNNING_ORDER_PATH]: 404 },
    });

    const wrapper = await openOverview();

    expect(cardFor(wrapper, "Sam Example")?.text()).toContain("No parts yet");
    expect(wrapper.find("main [role=alert]").exists()).toBe(false);
  });

  it("orders each section by casting score, without showing the score", async () => {
    // Score order differs from surname order, so a broken score sort fails.
    const kit = person("Kit", "Abel", "scouts");
    const sam = person("Sam", "Example", "scouts");
    const zoe = person("Zoe", "Young", "scouts");
    const jo = person("Jo", "Newcomer", "scouts");
    theShowIs(
      [jo, kit, sam, zoe],
      [
        role("pirate-sketch", "ensemble", [kit.id]),
        role("pirate-sketch", "lead", [sam.id]),
        role("pirate-sketch", "support", [zoe.id]),
        role("campfire-song", "support", [zoe.id]),
        role("campfire-song", "support", [zoe.id]),
      ],
    );

    const wrapper = await openOverview();

    expect(sections(wrapper)[0]?.people).toEqual([
      "Zoe Young",
      "Sam Example",
      "Kit Abel",
      "Jo Newcomer",
    ]);
    expect(cardFor(wrapper, "Sam Example")?.text()).not.toMatch(/\b8\b/);
  });
});

describe("Clashes on the Overview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  // Every item is 5 minutes. First half: Opening Number, Pirate Sketch, Dance One. Second
  // half: Campfire Song, Interlude, Encore.
  const show = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch"), anItem("Dance One")],
    [anItem("Campfire Song"), anItem("Interlude"), anItem("Encore")],
  );
  const sam = person("Sam", "Example", "scouts");
  const alex = person("Alex", "Sample", "scouts");
  const jo = person("Jo", "Newcomer", "explorers");
  let nextRoleId = 1;
  const role = (itemId: string, castMemberIds: number[], size: Role["size"] = "lead"): Role => {
    const id = nextRoleId++;
    return { id, itemId, name: `Role ${id}`, size, castMemberIds, revision: 1 };
  };
  // Sam: back-to-back Opening Number → Pirate Sketch (error), and a 5-minute quick change
  // Campfire Song → Encore (Interlude between). Alex: one item. Jo: ensembles in Opening
  // Number and Dance One, 5 minutes apart: a quick change only.
  const roles = [
    role("opening-number", [sam.id]),
    role("pirate-sketch", [sam.id], "support"),
    role("campfire-song", [sam.id]),
    role("encore", [sam.id]),
    role("interlude", [alex.id]),
    role("opening-number", [jo.id], "ensemble"),
    role("dance-one", [jo.id], "ensemble"),
  ];

  function showIs(failing: Record<string, number> = {}) {
    const answers: Record<string, unknown> = {
      [CAST_PATH]: { productionId: "2027", members: [sam, alex, jo] },
      [ROLES_PATH]: { productionId: "2027", roles },
      [RUNNING_ORDER_PATH]: show,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const code = failing[url];
        if (code) return new Response(null, { status: code });
        if (url in answers) return new Response(JSON.stringify(answers[url]));
        return new Response(JSON.stringify({ status: "ok", version: "dev" }));
      }),
    );
  }

  const clashOf = (wrapper: VueWrapper, name: string) =>
    wrapper
      .findAll("[data-test=person]")
      .find((card) => card.get(".person-name").text() === name)
      ?.find("[data-test=clash]");

  it("shows an icon at a person's worst severity", async () => {
    showIs();
    const wrapper = await openOverview();

    expect(clashOf(wrapper, "Sam Example")?.attributes("data-severity")).toBe("error");
  });

  it("lists each of their clashes with its items, worst first", async () => {
    showIs();
    const wrapper = await openOverview();

    const clash = clashOf(wrapper, "Sam Example");
    expect(clash?.findAll(".clash-line").map((line) => line.text())).toEqual([
      "Error: back-to-back. Lead in 'Opening Number', then Support in 'Pirate Sketch'",
      "Info: quick change. 5 minutes between 'Campfire Song' and 'Encore'",
    ]);
    expect(clash?.get("[data-test=clash-icon]").attributes("tabindex")).toBe("0");
  });

  it("shows no icon for someone without clashes", async () => {
    showIs();
    const wrapper = await openOverview();

    expect(clashOf(wrapper, "Alex Sample")?.exists()).toBe(false);
    expect(wrapper.text()).toContain("Alex Sample");
  });

  it("shows Info for someone whose only clash is a quick change", async () => {
    showIs();
    const wrapper = await openOverview();

    expect(clashOf(wrapper, "Jo Newcomer")?.attributes("data-severity")).toBe("info");
  });

  it.each([ROLES_PATH, RUNNING_ORDER_PATH])(
    "shows no icons when %s can't be loaded",
    async (failing) => {
      showIs({ [failing]: 500 });
      const wrapper = await openOverview();

      expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the casting.");
      expect(wrapper.find("[data-test=clash]").exists()).toBe(false);
    },
  );
});

describe("Timeline on the Overview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  // First half: Opening Number, Pirate Sketch, Dance One. Second half: Entr'acte (not in the
  // printed programme), Campfire Song, Finale.
  const show = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch"), anItem("Dance One")],
    [anItem("Entr'acte", { printed: false }), anItem("Campfire Song"), anItem("Finale")],
  );
  const sam = person("Sam", "Example", "scouts");
  const alex = person("Alex", "Sample", "scouts");
  const jo = person("Jo", "Newcomer", "explorers");
  // In the ensemble with Alex, but not on the cast list shown.
  const ben = person("Ben", "Other", "scouts");
  let nextRoleId = 1;
  const role = (itemId: string, castMemberIds: number[], size: Role["size"] = "lead"): Role => {
    const id = nextRoleId++;
    return { id, itemId, name: `Role ${id}`, size, castMemberIds, revision: 1 };
  };
  const roles = [
    role("pirate-sketch", [sam.id], "ensemble"),
    role("pirate-sketch", [sam.id]),
    role("entr'acte", [sam.id], "cameo"),
    role("finale", [sam.id], "support"),
    role("opening-number", [alex.id, ben.id], "ensemble"),
  ];

  function showIs({
    order = show,
    failing = {},
  }: {
    order?: RunningOrder | null;
    failing?: Record<string, number>;
  } = {}) {
    const answers: Record<string, unknown> = {
      [CAST_PATH]: { productionId: "2027", members: [sam, alex, jo] },
      [ROLES_PATH]: { productionId: "2027", roles },
      ...(order ? { [RUNNING_ORDER_PATH]: order } : {}),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const code = failing[url] ?? (url === RUNNING_ORDER_PATH && !order ? 404 : undefined);
        if (code) return new Response(null, { status: code });
        if (url in answers) return new Response(JSON.stringify(answers[url]));
        return new Response(JSON.stringify({ status: "ok", version: "dev" }));
      }),
    );
  }

  const cardOf = (wrapper: VueWrapper, name: string) =>
    wrapper.findAll("[data-test=person]").find((card) => card.get(".person-name").text() === name);
  /** A person's dots, half by half: "in" (green circle-dot) or "out" (grey circle). */
  const dotsOf = (wrapper: VueWrapper, name: string) =>
    cardOf(wrapper, name)
      ?.findAll("[data-test=timeline-half]")
      .map((half) =>
        half.findAll("[data-test=dot]").map((dot) => {
          const icon = dot.get("svg").attributes("data-icon");
          return dot.classes().includes("timeline-in") && icon === "circle-dot"
            ? "in"
            : icon === "circle"
              ? "out"
              : `unexpected ${icon}`;
        }),
      );

  it("shows a dot per item, half by half in show order, green where they appear", async () => {
    showIs();
    const wrapper = await openOverview();

    expect(dotsOf(wrapper, "Sam Example")).toEqual([
      ["out", "in", "out"],
      ["in", "out", "in"],
    ]);
  });

  it("counts any part, however small", async () => {
    showIs();
    const wrapper = await openOverview();

    expect(dotsOf(wrapper, "Alex Sample")).toEqual([
      ["in", "out", "out"],
      ["out", "out", "out"],
    ]);
  });

  it("shows all grey dots, with No parts yet, for someone in no roles", async () => {
    showIs();
    const wrapper = await openOverview();

    expect(dotsOf(wrapper, "Jo Newcomer")).toEqual([
      ["out", "out", "out"],
      ["out", "out", "out"],
    ]);
    expect(cardOf(wrapper, "Jo Newcomer")?.text()).toContain("No parts yet");
  });

  it("puts the dots last on the card, below the name and pills", async () => {
    showIs();
    const wrapper = await openOverview();

    const card = cardOf(wrapper, "Sam Example")?.element;
    expect(card?.lastElementChild?.querySelector("[data-test=timeline]")).not.toBeNull();
  });

  it("names each dot's item, and their part, on hover", async () => {
    showIs();
    const wrapper = await openOverview();

    const tips = cardOf(wrapper, "Sam Example")
      ?.findAll("[data-test=dot]")
      .map((dot) => dot.attributes("data-tooltip"));
    expect(tips).toEqual([
      "1 · Opening Number",
      "2 · Pirate Sketch: Lead",
      "3 · Dance One",
      "Entr'acte (not in printed programme): Cameo",
      "1 · Campfire Song",
      "2 · Finale: Support",
    ]);
  });

  it("names an item not in the printed programme, for someone not in it", async () => {
    showIs();
    const wrapper = await openOverview();

    const entracte = cardOf(wrapper, "Jo Newcomer")?.findAll("[data-test=dot]")[3];
    expect(entracte?.attributes("data-tooltip")).toBe("Entr'acte (not in printed programme)");
  });

  it("gives a person's biggest part in an item", async () => {
    showIs();
    const wrapper = await openOverview();

    // Sam is in the ensemble (listed first) and a lead in Pirate Sketch.
    const pirate = cardOf(wrapper, "Sam Example")?.findAll("[data-test=dot]")[1];
    expect(pirate?.attributes("data-tooltip")).toBe("2 · Pirate Sketch: Lead");
  });

  it("reads each timeline as one sentence, with the dots hidden from screen readers", async () => {
    showIs();
    const wrapper = await openOverview();

    const sam = cardOf(wrapper, "Sam Example");
    expect(sam?.get("[data-test=timeline]").attributes("aria-hidden")).toBe("true");
    expect(sam?.get("[data-test=timeline-summary]").text()).toBe(
      "In 3 of 6 items: Pirate Sketch, Entr'acte, Finale",
    );
    expect(cardOf(wrapper, "Jo Newcomer")?.get("[data-test=timeline-summary]").text()).toBe(
      "In none of the 6 items",
    );
    expect(sam?.get("[data-test=timeline-summary]").attributes("aria-hidden")).toBeUndefined();
  });

  it("keeps the dots out of the tab order", async () => {
    showIs();
    const wrapper = await openOverview();

    const focusable = wrapper.findAll(
      "[data-test=timeline] [tabindex], [data-test=timeline] a, [data-test=timeline] button",
    );
    expect(focusable).toEqual([]);
    expect(wrapper.findAll("[data-test=dot]").length).toBeGreaterThan(0);
  });

  it("shows no dots without a saved running order", async () => {
    showIs({ order: null });
    const wrapper = await openOverview();

    expect(wrapper.text()).toContain("Sam Example");
    expect(wrapper.find("[data-test=timeline]").exists()).toBe(false);
  });

  it.each([ROLES_PATH, RUNNING_ORDER_PATH])(
    "shows no dots when %s can't be loaded",
    async (path) => {
      showIs({ failing: { [path]: 500 } });
      const wrapper = await openOverview();

      expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the casting.");
      expect(wrapper.find("[data-test=timeline]").exists()).toBe(false);
    },
  );
});

describe("Casting overview role totals", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const show = aRunningOrder([anItem("Pirate Sketch")], [anItem("Campfire Song")]);
  let roleId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[] = []): Role => ({
    id: roleId,
    itemId,
    name: `Role ${roleId++}`,
    size,
    castMemberIds,
    revision: 1,
  });

  /** A stand-in API for the cast, roles and running order. A path given as `status`
   *  answers with that status instead. Returns every URL asked for. */
  function theShowIs(
    roles: Role[],
    { members = [], status = {} }: { members?: CastMember[]; status?: Record<string, number> } = {},
  ) {
    const answers: Record<string, unknown> = {
      [CAST_PATH]: { productionId: "2027", members },
      [ROLES_PATH]: { productionId: "2027", roles },
      [RUNNING_ORDER_PATH]: show,
    };
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        asked.push(url);
        const code = status[url];
        if (code) return new Response(null, { status: code });
        if (url in answers) return new Response(JSON.stringify(answers[url]));
        return new Response(JSON.stringify({ status: "ok", version: "dev" }));
      }),
    );
    return asked;
  }

  const totals = (wrapper: VueWrapper) =>
    wrapper.findAll("[data-test=total]").map((total) => total.text().replace(/\s+/g, " "));

  const aShow = [
    role("pirate-sketch", "lead"),
    role("campfire-song", "lead"),
    role("pirate-sketch", "support"),
    role("pirate-sketch", "support"),
    role("campfire-song", "support"),
    role("campfire-song", "cameo"),
  ];

  it("shows lead, support and cameo totals above the cast", async () => {
    theShowIs(aShow, { members: [person("Sam", "Example", "scouts")] });

    const wrapper = await openOverview();

    expect(totals(wrapper)).toEqual(["Lead · 2", "Support · 3", "Cameo · 1"]);
    const html = wrapper.get("main").html();
    expect(html.indexOf("role-totals")).toBeLessThan(html.indexOf("overview-section"));
  });

  it("says in words that the totals are roles in the show", async () => {
    theShowIs(aShow);

    const wrapper = await openOverview();

    const caption = wrapper.get(".role-totals-caption");
    expect(caption.text()).toBe("Roles in the show");
    expect(wrapper.get(".role-totals").attributes("aria-labelledby")).toBe(
      caption.attributes("id"),
    );
  });

  it("tints each total like its size's pills", async () => {
    theShowIs(aShow);

    const wrapper = await openOverview();

    expect(wrapper.findAll("[data-test=total]").map((total) => total.classes())).toEqual([
      expect.arrayContaining(["role-total-lead"]),
      expect.arrayContaining(["role-total-support"]),
      expect.arrayContaining(["role-total-cameo"]),
    ]);
  });

  it("counts roles nobody is cast in", async () => {
    const sam = person("Sam", "Example", "scouts");
    theShowIs([role("pirate-sketch", "lead", []), role("pirate-sketch", "lead", [sam.id])], {
      members: [sam],
    });

    const wrapper = await openOverview();

    expect(totals(wrapper)[0]).toBe("Lead · 2");
  });

  it("leaves ensemble roles out of the totals", async () => {
    theShowIs([...aShow, role("pirate-sketch", "ensemble", [1, 2, 3, 4])]);

    const wrapper = await openOverview();

    expect(totals(wrapper)).toEqual(["Lead · 2", "Support · 3", "Cameo · 1"]);
    expect(wrapper.get(".role-totals").text()).not.toMatch(/ensemble/i);
  });

  it("shows a new support role in the total after a reload", async () => {
    theShowIs(aShow);
    expect(totals(await openOverview())[1]).toBe("Support · 3");

    theShowIs([...aShow, role("campfire-song", "support")]);

    expect(totals(await openOverview())[1]).toBe("Support · 4");
  });

  it("drops a removed cameo role from the total after a reload", async () => {
    theShowIs(aShow);
    expect(totals(await openOverview())[2]).toBe("Cameo · 1");

    theShowIs(aShow.filter((r) => r.size !== "cameo"));

    expect(totals(await openOverview())[2]).toBe("Cameo · 0");
  });

  it("shows zero totals for a show with no roles", async () => {
    theShowIs([]);

    const wrapper = await openOverview();

    expect(totals(wrapper)).toEqual(["Lead · 0", "Support · 0", "Cameo · 0"]);
  });

  it("only asks for this production's roles", async () => {
    const asked = theShowIs(aShow);

    await openOverview();

    expect(asked).toContain(ROLES_PATH);
    expect(asked.filter((url) => url.includes("/roles"))).toEqual([ROLES_PATH]);
  });

  it("doesn't count roles in items missing from the saved running order", async () => {
    theShowIs([...aShow, role("cut-item", "lead")]);

    const wrapper = await openOverview();

    expect(totals(wrapper)[0]).toBe("Lead · 2");
  });

  it("shows zero totals when there is no saved running order", async () => {
    theShowIs(aShow, { status: { [RUNNING_ORDER_PATH]: 404 } });

    const wrapper = await openOverview();

    expect(totals(wrapper)).toEqual(["Lead · 0", "Support · 0", "Cameo · 0"]);
  });

  it("shows no totals, rather than zeros, when the roles can't be loaded", async () => {
    theShowIs(aShow, { status: { [ROLES_PATH]: 500 } });

    const wrapper = await openOverview();

    expect(totals(wrapper)).toEqual([]);
  });
});

describe("Casting grid on the Overview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const show = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch")],
    [anItem("Dance One")],
  );
  let roleId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[]): Role => ({
    id: roleId,
    itemId,
    name: `Role ${roleId++}`,
    size,
    castMemberIds,
    revision: 1,
  });

  const sam = person("Sam", "Example", "scouts");
  const alex = person("Alex", "Sample", "explorers");
  const jo = person("Jo", "Newcomer", "scouts");

  /** A stand-in API for the cast, roles and running order; `order: null` is no saved one. */
  function theShowIs(
    roles: Role[],
    {
      members = [sam, alex, jo],
      order = show,
    }: { members?: CastMember[]; order?: RunningOrder | null } = {},
  ) {
    const answers: Record<string, unknown> = {
      [CAST_PATH]: { productionId: "2027", members },
      [ROLES_PATH]: { productionId: "2027", roles },
      [RUNNING_ORDER_PATH]: order,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === RUNNING_ORDER_PATH && order === null)
          return new Response(null, { status: 404 });
        if (url in answers) return new Response(JSON.stringify(answers[url]));
        return new Response(JSON.stringify({ status: "ok", version: "dev" }));
      }),
    );
  }

  const button = (wrapper: VueWrapper, label: string) =>
    wrapper.findAll("main button").find((b) => b.text() === label);

  async function openGrid() {
    const wrapper = await openOverview();
    await button(wrapper, "Grid")?.trigger("click");
    return wrapper;
  }

  const rows = (wrapper: VueWrapper) =>
    wrapper.findAll("tbody tr").map((row) => row.findAll("th, td"));
  const rowOf = (wrapper: VueWrapper, firstName: string) =>
    rows(wrapper).find((cells) => {
      // A clash icon adds its words to the name cell, so match on the name it starts with.
      const text = cells[0]?.text() ?? "";
      return text === firstName || text.startsWith(`${firstName} `);
    }) ?? [];

  const cast = [
    role("pirate-sketch", "lead", [sam.id]),
    role("dance-one", "cameo", [sam.id]),
    role("opening-number", "support", [alex.id]),
  ];

  it("switches to a grid on the same page", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    expect(wrapper.find("table").exists()).toBe(true);
    expect(wrapper.get("main h1").text()).toBe("Overview");
  });

  it("switches back to the people by section", async () => {
    theShowIs(cast);
    const wrapper = await openGrid();

    await button(wrapper, "By person")?.trigger("click");

    expect(wrapper.find("table").exists()).toBe(false);
    expect(sections(wrapper).map(({ heading }) => heading)).toEqual([
      "Scouts 2 people",
      "Explorers 1 person",
    ]);
  });

  it("starts on the people by section, with the current view marked", async () => {
    theShowIs(cast);

    const wrapper = await openOverview();

    expect(wrapper.find("table").exists()).toBe(false);
    expect(button(wrapper, "By person")?.attributes("aria-pressed")).toBe("true");
    expect(button(wrapper, "Grid")?.attributes("aria-pressed")).toBe("false");
  });

  it("has a row per person starting with first name, last name and section", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    expect(rows(wrapper).map((cells) => cells.slice(0, 3).map((cell) => cell.text()))).toEqual([
      ["Sam", "Example", "Scouts"],
      ["Jo", "Newcomer", "Scouts"],
      ["Alex", "Sample", "Explorers"],
    ]);
  });

  it("has a column per item in running order", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const heads = wrapper.findAll("thead th").map((head) => head.text());
    expect(heads.slice(3)).toEqual([
      "1.1 · Opening Number",
      "1.2 · Pirate Sketch",
      "2.1 · Dance One",
    ]);
  });

  it("shows a lead as one lead-coloured dot with the letter L", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const dot = rowOf(wrapper, "Sam")[4]?.get("[data-test=grid-dot]");
    expect(dot?.text()).toBe("L");
    expect(dot?.classes()).toContain("grid-dot-lead");
  });

  it.each([
    ["Alex", 3, "S", "grid-dot-support"],
    ["Sam", 5, "C", "grid-dot-cameo"],
  ])("shows %s's part in column %i as %s in its own colour", async (name, column, letter, tint) => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const dot = rowOf(wrapper, name)[column]?.get("[data-test=grid-dot]");
    expect(dot?.text()).toBe(letter);
    expect(dot?.classes()).toContain(tint);
  });

  it("shows an ensemble part as a dot with the letter E", async () => {
    theShowIs([role("opening-number", "ensemble", [jo.id])]);

    const wrapper = await openGrid();

    const dot = rowOf(wrapper, "Jo")[3]?.get("[data-test=grid-dot]");
    expect(dot?.text()).toBe("E");
    expect(dot?.classes()).toContain("grid-dot-ensemble");
  });

  it("shows only the biggest of several parts in one item", async () => {
    theShowIs([role("pirate-sketch", "cameo", [sam.id]), role("pirate-sketch", "lead", [sam.id])]);

    const wrapper = await openGrid();

    const dots = rowOf(wrapper, "Sam")[4]?.findAll("[data-test=grid-dot]");
    expect(dots?.map((dot) => dot.text())).toEqual(["L"]);
  });

  it("lets a bigger part beat an ensemble part in the same item", async () => {
    theShowIs([
      role("pirate-sketch", "ensemble", [sam.id]),
      role("pirate-sketch", "lead", [sam.id]),
    ]);

    const wrapper = await openGrid();

    expect(rowOf(wrapper, "Sam")[4]?.get("[data-test=grid-dot]").text()).toBe("L");
  });

  it("shows a dash, and no dot, where the person isn't cast", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const cell = rowOf(wrapper, "Sam")[3];
    expect(cell?.find("[data-test=grid-dot]").exists()).toBe(false);
    expect(cell?.text()).toBe("-");
    expect(cell?.classes()).toContain("grid-empty");
    // Only a mark for sighted users: a screen reader isn't read a "dash" in every gap.
    expect(cell?.get("[data-test=grid-dash]").attributes("aria-hidden")).toBe("true");
  });

  it("keeps someone with no parts, with every item empty", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const items = rowOf(wrapper, "Jo").slice(3);
    expect(items).toHaveLength(3);
    expect(items.every((cell) => cell.classes().includes("grid-empty"))).toBe(true);
    expect(items.map((cell) => cell.text())).toEqual(["-", "-", "-"]);
  });

  it("lets a screen reader hear the part, under the person and item headers", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const cell = rowOf(wrapper, "Sam")[4];
    expect(cell?.get(".visually-hidden").text()).toBe("Lead");
    expect(cell?.get("[data-test=grid-dot]").attributes("aria-hidden")).toBe("true");
    expect(rowOf(wrapper, "Sam")[0]?.element.tagName).toBe("TH");
    expect(rowOf(wrapper, "Sam")[0]?.attributes("scope")).toBe("row");
    expect(rowOf(wrapper, "Sam")[1]?.element.tagName).toBe("TD");
    expect(wrapper.findAll("thead th").every((head) => head.attributes("scope") === "col")).toBe(
      true,
    );
  });

  it.each([
    ["has no saved running order", null],
    ["has an empty running order", aRunningOrder([], [])],
  ])("says there are no items when the show %s", async (_name, order) => {
    theShowIs([], { order });

    const wrapper = await openGrid();

    expect(wrapper.find("table").exists()).toBe(false);
    expect(wrapper.get("main").text()).toContain("No items in the running order yet.");
  });

  it("heads each item column with its programme number, title and half", async () => {
    const items = ["One", "Two", "Three", "Four", "Five", "Six", "Finale"].map((t) => anItem(t));
    theShowIs([], { order: aRunningOrder(items.slice(0, 3), items.slice(3)) });

    const wrapper = await openGrid();

    const heads = wrapper.findAll("thead th").map((head) => head.text());
    expect(heads.slice(3)).toEqual([
      "1.1 · One",
      "1.2 · Two",
      "1.3 · Three",
      "2.1 · Four",
      "2.2 · Five",
      "2.3 · Six",
      "2.4 · Finale",
    ]);
  });

  it("says when an item isn't in the printed programme, without a number", async () => {
    theShowIs([], {
      order: aRunningOrder(
        [anItem("Opening Number"), anItem("Entr'acte", { printed: false })],
        [anItem("Dance One")],
      ),
    });

    const wrapper = await openGrid();

    const heads = wrapper.findAll("thead th").map((head) => head.text());
    expect(heads.slice(3)).toEqual(["1.1 · Opening Number", "Entr'acte", "2.1 · Dance One"]);
    // Italic red, not words, on screen; a screen reader is still told.
    const entracte = wrapper.findAll("thead th")[4];
    expect(entracte?.classes()).toContain("grid-unprinted");
    expect(entracte?.attributes("aria-label")).toBe("Entr'acte, not in printed programme");
    expect(entracte?.attributes("title")).toBeUndefined();
    expect(wrapper.findAll("thead th")[3]?.classes()).not.toContain("grid-unprinted");
  });

  it("cuts a title over 15 characters to 15 and '...', keeping the full one on hover", async () => {
    theShowIs([], {
      order: aRunningOrder([
        anItem("Fifteen Letters!"),
        anItem("Exactly 15 char"),
        anItem("Short"),
        anItem("The Grand Finale of the Evening", { printed: false }),
      ]),
    });

    const wrapper = await openGrid();

    const heads = wrapper.findAll("thead th").slice(3);
    expect(heads.map((head) => head.text())).toEqual([
      "1.1 · Fifteen Letters...",
      "1.2 · Exactly 15 char",
      "1.3 · Short",
      "The Grand Final...",
    ]);
    // The whole name is still there for hover and for screen readers.
    expect(heads[0]?.attributes("title")).toBe("1.1 · Fifteen Letters!");
    expect(heads[0]?.attributes("aria-label")).toBe("1.1 · Fifteen Letters!");
    expect(heads[3]?.attributes("title")).toBe("The Grand Finale of the Evening");
    expect(heads[3]?.attributes("aria-label")).toBe(
      "The Grand Finale of the Evening, not in printed programme",
    );
    expect(heads[1]?.attributes("title")).toBeUndefined();
    expect(heads[2]?.attributes("title")).toBeUndefined();
  });

  it("pins the first and last name columns, but not the section or the items", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const pinned = (cells: { classes(): string[] }[]) =>
      cells.map((cell) => cell.classes().includes("grid-pinned"));
    expect(pinned(wrapper.findAll("thead th"))).toEqual([true, true, false, false, false, false]);
    for (const cells of rows(wrapper)) {
      expect(pinned(cells)).toEqual([true, true, false, false, false, false]);
    }
  });

  it("puts a column header over every cell", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const heads = wrapper.findAll("thead th").length;
    expect(rows(wrapper).every((cells) => cells.length === heads)).toBe(true);
  });

  const legend = (wrapper: VueWrapper) =>
    wrapper.findAll("[data-test=legend-item]").map((item) => ({
      letter: item.get("[data-test=legend-dot]").text(),
      classes: item.get("[data-test=legend-dot]").classes(),
      words: item.get(".legend-size").text(),
    }));

  it("explains each size in a legend, with its letter and its name", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    expect(legend(wrapper).map(({ letter, words }) => [letter, words])).toEqual([
      ["L", "Lead"],
      ["S", "Support"],
      ["C", "Cameo"],
      ["E", "Ensemble"],
    ]);
  });

  it("draws each legend dot like the same size in the grid", async () => {
    theShowIs([
      role("opening-number", "lead", [sam.id]),
      role("pirate-sketch", "support", [sam.id]),
      role("dance-one", "cameo", [sam.id]),
      role("dance-one", "ensemble", [alex.id]),
    ]);

    const wrapper = await openGrid();

    const inGrid = wrapper
      .findAll("[data-test=grid-dot]")
      .map((dot) => [dot.text(), dot.classes().sort()]);
    const inLegend = legend(wrapper).map(({ letter, classes }) => [letter, classes.sort()]);
    expect(inGrid).toHaveLength(4);
    for (const dot of inGrid) expect(inLegend).toContainEqual(dot);
  });

  it("has no legend on the by-person view", async () => {
    theShowIs(cast);

    const wrapper = await openOverview();

    expect(wrapper.find("[data-test=legend-item]").exists()).toBe(false);
  });

  it("names the legend in words, above the grid", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const list = wrapper.get(".grid-legend");
    const caption = wrapper.get("#grid-legend-caption");
    expect(caption.text()).toBe("What the dots mean");
    expect(list.attributes("aria-labelledby")).toBe("grid-legend-caption");
    const table = wrapper.get("table").element;
    expect(
      list.element.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides the legend's letters from screen readers, which hear the size words", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    for (const item of wrapper.findAll("[data-test=legend-item]")) {
      expect(item.get("[data-test=legend-dot]").attributes("aria-hidden")).toBe("true");
      expect(item.get(".legend-size").text()).not.toBe("");
    }
  });

  it("says the grid couldn't load when the casting fails", async () => {
    theShowIs(cast);
    const fetched = globalThis.fetch;
    vi.stubGlobal("fetch", (url: string) =>
      url === ROLES_PATH ? Promise.resolve(new Response(null, { status: 500 })) : fetched(url),
    );

    const wrapper = await openGrid();

    expect(wrapper.find("table").exists()).toBe(false);
    expect(wrapper.get("main").text()).toContain("Couldn't load the grid.");
  });

  it("says there are no cast members, without an empty table or a switch", async () => {
    theShowIs(cast, { members: [] });

    const wrapper = await openOverview();

    expect(wrapper.get("main").text()).toContain("No cast members yet.");
    expect(button(wrapper, "Grid")).toBeUndefined();
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("puts the grid in a named, focusable box that scrolls on its own", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const box = wrapper.get(".table-scroll");
    expect(box.attributes("role")).toBe("region");
    expect(box.attributes("aria-label")).toBe("Who is in which item");
    expect(box.attributes("tabindex")).toBe("0");
    expect(box.find("table").exists()).toBe(true);
  });

  it("names the switch for what it changes, and the page for both views", async () => {
    theShowIs(cast);

    const wrapper = await openOverview();

    expect(wrapper.get(".view-switch").attributes("aria-label")).toBe("Choose how to see the cast");
    expect(wrapper.get("main").text()).toContain("Everyone in the cast and how much they're cast.");
    expect(wrapper.get("main").text()).not.toContain("by section");
  });

  it("flags a clash beside the name of someone who has one", async () => {
    // Sam is a lead in two items back to back; Alex is in one item.
    theShowIs([
      role("opening-number", "lead", [sam.id]),
      role("pirate-sketch", "support", [sam.id]),
      role("dance-one", "lead", [alex.id]),
    ]);

    const wrapper = await openGrid();

    expect(rowOf(wrapper, "Sam")[0]?.get("[data-test=clash]").attributes("data-severity")).toBe(
      "error",
    );
    expect(rowOf(wrapper, "Alex")[0]?.find("[data-test=clash]").exists()).toBe(false);
  });
});

describe("Excel export from the grid", () => {
  const EXPORT_PATH = "/api/productions/2027/casting-grid/export";
  const show = aRunningOrder(
    [anItem("Opening Number"), anItem("The Grand Finale of the Evening")],
    [anItem("Dance One")],
  );
  let roleId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[]): Role => ({
    id: roleId,
    itemId,
    name: `Role ${roleId++}`,
    size,
    castMemberIds,
    revision: 1,
  });
  const sam = person("Sam", "Example", "scouts");
  const alex = person("Alex", "Sample", "explorers");
  const roles = [
    role("opening-number", "lead", [sam.id]),
    role("dance-one", "cameo", [sam.id]),
    role("the-grand-finale-of-the-evening", "ensemble", [alex.id]),
  ];

  let exportStatus = 200;
  let exportRequests: { url: string; init?: RequestInit }[] = [];
  let downloads: { name: string; href: string }[] = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2027, 2, 12, 10, 0) });
    exportStatus = 200;
    exportRequests = [];
    downloads = [];
    useLocalSignIn();
    URL.createObjectURL = vi.fn(() => "blob:made-up");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push({ name: this.download, href: this.href });
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === EXPORT_PATH) {
          exportRequests.push({ url, ...(init ? { init } : {}) });
          return exportStatus === 200
            ? new Response(new Blob(["PK"]), { status: 200 })
            : new Response(null, { status: exportStatus });
        }
        const answers: Record<string, unknown> = {
          [CAST_PATH]: { productionId: "2027", members: [sam, alex] },
          [ROLES_PATH]: { productionId: "2027", roles },
          [RUNNING_ORDER_PATH]: show,
        };
        return url in answers
          ? new Response(JSON.stringify(answers[url]))
          : new Response(JSON.stringify({ status: "ok", version: "dev" }));
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useLocalSignIn();
    document.body.innerHTML = "";
  });

  const exportButton = (wrapper: VueWrapper) =>
    wrapper.findAll("main button").find((b) => b.text() === "Export to Excel");
  async function openGrid() {
    const wrapper = await openOverview();
    await wrapper
      .findAll("main button")
      .find((b) => b.text() === "Grid")
      ?.trigger("click");
    return wrapper;
  }

  it("shows an Export to Excel button on the grid, with the Excel file icon and its name", async () => {
    const wrapper = await openGrid();

    const button = exportButton(wrapper);
    expect(button?.text()).toBe("Export to Excel");
    expect(button?.find("svg").exists()).toBe(true);
    expect(button?.classes()).toContain("grid-export-button");
  });

  it("puts the button beside the By person / Grid switch, not beside the page title", async () => {
    const wrapper = await openGrid();

    const bar = wrapper.get(".view-bar");
    expect(bar.find(".view-switch").exists()).toBe(true);
    expect(bar.find("button.grid-export-button").exists()).toBe(true);
    // Beside the switch, not one of its choices.
    expect(wrapper.find(".view-switch button.grid-export-button").exists()).toBe(false);
    expect(wrapper.get(".page-title-row").find("button.grid-export-button").exists()).toBe(false);
  });

  it.each([
    ["a Casting Team Member", ["casting"]],
    ["a Read-Only Team Member", ["read-only"]],
  ])("shows %s the button too, and exports for them", async (_who, groups) => {
    await signInAs(groups);
    const wrapper = await openGrid();

    await exportButton(wrapper)?.trigger("click");
    await flushPromises();

    expect(exportRequests).toHaveLength(1);
    expect(downloads).toHaveLength(1);
  });

  it("shows no button on the by-person view", async () => {
    const wrapper = await openOverview();

    expect(exportButton(wrapper)).toBeUndefined();
  });

  it("is named by its words alone, with no hover note", async () => {
    const wrapper = await openGrid();

    const button = exportButton(wrapper);
    expect(button?.attributes("aria-label")).toBeUndefined();
    expect(button?.attributes("data-tooltip")).toBeUndefined();
    expect(wrapper.text()).not.toContain("production team only");
  });

  it("sends the grid as shown: names, section, whole item headings and role letters", async () => {
    const wrapper = await openGrid();

    await exportButton(wrapper)?.trigger("click");
    await flushPromises();

    expect(exportRequests).toHaveLength(1);
    expect(exportRequests[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(exportRequests[0]?.init?.body))).toEqual({
      items: [
        { heading: "1.1 · Opening Number", printed: true },
        { heading: "1.2 · The Grand Finale of the Evening", printed: true },
        { heading: "2.1 · Dance One", printed: true },
      ],
      rows: [
        { firstName: "Sam", lastName: "Example", section: "Scouts", cells: ["L", null, "C"] },
        { firstName: "Alex", lastName: "Sample", section: "Explorers", cells: [null, "E", null] },
      ],
    });
  });

  it("sends only the biggest of several parts in one item", async () => {
    roles.push(role("opening-number", "cameo", [sam.id]));
    const wrapper = await openGrid();

    await exportButton(wrapper)?.trigger("click");
    await flushPromises();

    const sent = JSON.parse(String(exportRequests[0]?.init?.body));
    expect(sent.rows[0].cells).toEqual(["L", null, "C"]);
    roles.pop();
  });

  it("saves the file named for the production and the date", async () => {
    const wrapper = await openGrid();

    await exportButton(wrapper)?.trigger("click");
    await flushPromises();

    expect(downloads).toEqual([
      { name: "Gang Show 2027 casting grid 2027-03-12.xlsx", href: "blob:made-up" },
    ]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:made-up");
  });

  it("announces a finished export to screen readers", async () => {
    const wrapper = await openGrid();
    expect(wrapper.get("[data-test=announcement]").text()).toBe("");

    await exportButton(wrapper)?.trigger("click");
    await flushPromises();

    const status = wrapper.get("[data-test=announcement]");
    expect(status.attributes("role")).toBe("status");
    expect(status.text()).toBe("Casting grid exported.");
  });

  it.each([
    ["finishes", 200],
    ["fails", 500],
  ])("puts keyboard focus back on the button when an export %s", async (_name, status) => {
    exportStatus = status;
    const wrapper = await openGrid();
    const button = wrapper.get<HTMLButtonElement>(".grid-export-button");
    button.element.focus();

    await button.trigger("click");
    await flushPromises();

    expect(document.activeElement).toBe(button.element);
  });

  it("says the export didn't work, saving no file, and lets the admin try again", async () => {
    exportStatus = 500;
    const wrapper = await openGrid();

    await exportButton(wrapper)?.trigger("click");
    await flushPromises();

    expect(wrapper.get(".grid-export-error").text()).toBe("Couldn't export the grid. Try again.");
    expect(downloads).toEqual([]);

    exportStatus = 200;
    await exportButton(wrapper)?.trigger("click");
    await flushPromises();

    expect(wrapper.find(".grid-export-error").exists()).toBe(false);
    expect(downloads).toHaveLength(1);
  });

  it("says the export didn't work when the server refuses it", async () => {
    exportStatus = 403;
    const wrapper = await openGrid();

    await exportButton(wrapper)?.trigger("click");
    await flushPromises();

    expect(wrapper.get(".grid-export-error").text()).toBe("Couldn't export the grid. Try again.");
    expect(downloads).toEqual([]);
  });
});

describe("The Overview for a Read-Only Team Member", () => {
  beforeEach(async () => {
    await signInAs(["read-only"]);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    useLocalSignIn();
  });

  const ava = person("Ava", "Example", "explorers");
  // Ava is in two items back to back: a clash.
  function showIs() {
    const order: RunningOrder = aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]);
    const part = (id: number, itemId: string): Role => ({
      id,
      itemId,
      name: `Role ${id}`,
      size: "lead",
      castMemberIds: [ava.id],
      revision: 1,
    });
    const roles = [part(1, "opening-number"), part(2, "pirate-sketch")];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === CAST_PATH) {
          return new Response(JSON.stringify({ productionId: "2027", members: [ava] }));
        }
        if (url === ROLES_PATH)
          return new Response(JSON.stringify({ productionId: "2027", roles }));
        if (url === RUNNING_ORDER_PATH) return new Response(JSON.stringify(order));
        return new Response(JSON.stringify({ status: "ok", version: "dev" }));
      }),
    );
  }
  const showGrid = (wrapper: VueWrapper) =>
    wrapper
      .findAll(".view-switch button")
      .find((b) => b.text() === "Grid")
      ?.trigger("click");

  it("shows the role totals, each person's timeline with clashes, and the casting grid", async () => {
    showIs();

    const wrapper = await openOverview();

    expect(wrapper.find(".role-totals").exists()).toBe(true);
    const card = wrapper
      .findAll("[data-test=person]")
      .find((person) => person.text().includes("Ava Example"));
    expect(card?.find("[data-test=timeline]").exists()).toBe(true);
    expect(card?.get("[data-test=clash]").attributes("data-severity")).toBe("error");
    await showGrid(wrapper);
    expect(wrapper.find("table").exists()).toBe(true);
  });

  it("has the Export to Excel button on the grid, like every role (ADR 0021)", async () => {
    showIs();

    const wrapper = await openOverview();
    await showGrid(wrapper);

    expect(wrapper.get("button.grid-export-button").text()).toBe("Export to Excel");
  });

  it("says on the page that the access is read-only", async () => {
    showIs();

    const wrapper = await openOverview();

    expect(wrapper.get("[data-test=read-only]").text()).toBe("You have read-only access");
  });
});

describe("The Overview for other roles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    useLocalSignIn();
  });

  it.each([["casting"], ["admin"]])("shows %s no read-only line", async (group) => {
    await signInAs([group]);
    castIs([person("Ava", "Example", "explorers")]);

    const wrapper = await openOverview();

    expect(wrapper.text()).toContain("Ava Example");
    expect(wrapper.find("[data-test=read-only]").exists()).toBe(false);
  });
});

describe("The By item view on the Overview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    useLocalSignIn();
  });

  const ava = person("Ava", "Example", "scouts");
  const ben = person("Ben", "Sample", "explorers");
  const cara = person("Cara", "Test", "scouts");
  const show = aRunningOrder([anItem("Opening"), anItem("Campfire Song")], [anItem("Finale")]);
  show.halves[0].name = "Act One";
  show.halves[1].name = "Act Two";
  // Items 1–3 printed, then one left out of the printed programme, then item 4.
  const withUnprinted = aRunningOrder([
    anItem("Opening"),
    anItem("Campfire Song"),
    anItem("Pirate Sketch"),
    anItem("Scene Change Music", { printed: false }),
    anItem("Finale"),
  ]);
  const unprintedHeading = "Scene Change Music Not in printed programme";
  let roleId = 1;
  const role = (
    itemId: string,
    name: string,
    size: Role["size"],
    castMemberIds: number[] = [],
  ) => ({
    id: roleId++,
    itemId,
    name,
    size,
    castMemberIds,
    revision: 1,
  });

  /** A stand-in API for the cast, roles and running order. */
  function theShowIs(roles: Role[], order: RunningOrder = show) {
    const answers: Record<string, unknown> = {
      // Not in surname order, so the view's own ordering is what's tested.
      [CAST_PATH]: { productionId: "2027", members: [cara, ava, ben] },
      [ROLES_PATH]: { productionId: "2027", roles },
      [RUNNING_ORDER_PATH]: order,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url in answers
          ? new Response(JSON.stringify(answers[url]))
          : new Response(JSON.stringify({ status: "ok", version: "dev" })),
      ),
    );
  }

  const switchButtons = (wrapper: VueWrapper) => wrapper.findAll(".view-switch button");

  async function openByItem() {
    const wrapper = await openOverview();
    await switchButtons(wrapper)
      .find((b) => b.text() === "By item")
      ?.trigger("click");
    return wrapper;
  }

  const byItem = (wrapper: VueWrapper) => wrapper.get("[data-test=by-item]");
  const itemNamed = (wrapper: VueWrapper, heading: string) =>
    byItem(wrapper)
      .findAll("[data-test=show-item]")
      .find((item) => item.get("h3").text() === heading);
  const rowsOf = (wrapper: VueWrapper, heading: string) =>
    itemNamed(wrapper, heading)
      ?.findAll("tbody tr")
      .map((row) => row.findAll("th, td").map((cell) => cell.text()));

  it("offers By person, By item and Grid, and marks By item once chosen", async () => {
    theShowIs([]);

    const wrapper = await openByItem();

    expect(switchButtons(wrapper).map((b) => b.text())).toEqual(["By person", "By item", "Grid"]);
    expect(switchButtons(wrapper).map((b) => b.attributes("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(wrapper.find("[data-test=by-item]").exists()).toBe(true);
  });

  it("lists the items in show order under their half, as real headings", async () => {
    theShowIs([]);

    const wrapper = await openByItem();

    const headings = byItem(wrapper)
      .findAll("h2, h3")
      .map((h) => `${h.element.tagName} ${h.text()}`);
    expect(headings).toEqual([
      "H2 Act One",
      "H3 1 Opening",
      "H3 2 Campfire Song",
      "H2 Act Two",
      "H3 1 Finale",
    ]);
  });

  it("shows each item's roles in a table of role name, role type and cast", async () => {
    theShowIs([role("opening", "Fairy Godmother", "lead", [ava.id])]);

    const wrapper = await openByItem();

    const headers = itemNamed(wrapper, "1 Opening")
      ?.findAll("thead th")
      .map((th) => th.text());
    expect(headers).toEqual(["Role name", "Role type", "Cast"]);
    expect(rowsOf(wrapper, "1 Opening")).toEqual([["Fairy Godmother", "Lead", "Ava Example"]]);
  });

  it("lists everyone in an ensemble, in the item page's order", async () => {
    theShowIs([role("opening", "Villagers", "ensemble", [cara.id, ben.id])]);

    const wrapper = await openByItem();

    expect(rowsOf(wrapper, "1 Opening")).toEqual([
      ["Villagers", "Ensemble", "Ben Sample, Cara Test"],
    ]);
  });

  it("orders an item's roles by size, then name", async () => {
    theShowIs([
      role("finale", "Villagers", "ensemble", [ben.id]),
      role("finale", "zebra", "cameo", [ava.id]),
      role("finale", "Apple", "cameo", [cara.id]),
      role("finale", "Fairy Godmother", "lead", [ava.id]),
    ]);

    const wrapper = await openByItem();

    expect(rowsOf(wrapper, "1 Finale")?.map((row) => row[0])).toEqual([
      "Fairy Godmother",
      "Apple",
      "zebra",
      "Villagers",
    ]);
  });

  it.each([["admin"], ["casting"], ["read-only"]])(
    "shows %s the same view, with nothing to edit",
    async (group) => {
      await signInAs([group]);
      theShowIs([role("opening", "Fairy Godmother", "lead", [ava.id])]);

      const wrapper = await openByItem();

      expect(rowsOf(wrapper, "1 Opening")).toEqual([["Fairy Godmother", "Lead", "Ava Example"]]);
      expect(byItem(wrapper).findAll("button, a, input, select, textarea")).toEqual([]);
    },
  );

  it("puts each item's roles in a labelled box a keyboard can scroll", async () => {
    theShowIs([role("opening", "Fairy Godmother", "lead", [ava.id])]);

    const wrapper = await openByItem();

    const box = itemNamed(wrapper, "1 Opening")?.get(".table-scroll");
    expect(box?.attributes()).toMatchObject({
      tabindex: "0",
      role: "region",
      "aria-label": "Roles in Opening",
    });
  });

  it("labels each role's details, so they still read on a phone when stacked", async () => {
    theShowIs([role("opening", "Fairy Godmother", "lead", [ava.id])]);

    const wrapper = await openByItem();

    const labels = itemNamed(wrapper, "1 Opening")
      ?.findAll("tbody td")
      .map((cell) => cell.attributes("data-label"));
    expect(labels).toEqual(["Role type", "Cast"]);
  });

  it("shows a clash icon beside a name in back-to-back items, as the item page does", async () => {
    theShowIs([
      role("opening", "Fairy Godmother", "lead", [ava.id]),
      role("campfire-song", "Singer", "support", [ava.id]),
      role("finale", "Villagers", "ensemble", [ben.id]),
    ]);

    const wrapper = await openByItem();

    const clashIn = (heading: string) =>
      itemNamed(wrapper, heading)?.find("tbody [data-test=clash]").exists();
    expect(clashIn("1 Opening")).toBe(true);
    expect(clashIn("2 Campfire Song")).toBe(true);
    expect(clashIn("1 Finale")).toBe(false);
  });

  it("marks an item left out of the printed programme in red italics, with no number", async () => {
    theShowIs([], withUnprinted);

    const wrapper = await openByItem();

    const heading = itemNamed(wrapper, unprintedHeading)?.get("h3");
    expect(heading?.classes()).toContain("by-item-unprinted");
    expect(heading?.text()).toMatch(/^Scene Change Music/);
  });

  it("doesn't count an unprinted item in the programme numbers", async () => {
    theShowIs([], withUnprinted);

    const wrapper = await openByItem();

    const headings = byItem(wrapper)
      .findAll("h3")
      .map((h) => h.text());
    expect(headings.slice(3)).toEqual([unprintedHeading, "4 Finale"]);
  });

  it("says in words, not only colour, that an item isn't in the printed programme", async () => {
    theShowIs([], withUnprinted);

    const wrapper = await openByItem();

    const badge = itemNamed(wrapper, unprintedHeading)?.get("h3 .badge");
    expect(badge?.text()).toBe("Not in printed programme");
    expect(badge?.classes()).not.toContain("visually-hidden");
  });

  it("says Uncast for a role nobody plays", async () => {
    theShowIs([role("finale", "Narrator", "support")]);

    const wrapper = await openByItem();

    expect(rowsOf(wrapper, "1 Finale")).toEqual([["Narrator", "Support", "Uncast"]]);
    expect(itemNamed(wrapper, "1 Finale")?.find(".uncast").exists()).toBe(true);
  });

  it("says an item with no roles has none yet, with no empty table", async () => {
    theShowIs([role("opening", "Fairy Godmother", "lead", [ava.id])]);

    const wrapper = await openByItem();

    const finale = itemNamed(wrapper, "1 Finale");
    expect(finale?.find("table").exists()).toBe(false);
    expect(finale?.text()).toContain("No roles have been added yet.");
  });

  it("says there are no items yet when the running order is empty", async () => {
    theShowIs([], aRunningOrder([]));

    const wrapper = await openByItem();

    expect(byItem(wrapper).text()).toBe("No items in the running order yet.");
  });
});

describe("Casting overview help (in-app-help E2.S2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useLocalSignIn();
    document.body.innerHTML = "";
  });

  it("opens the Overview help from the title row and keeps the chosen view", async () => {
    await signInAs(["read-only"]);
    castIs([person("Sam", "Example", "scouts")]);
    const wrapper = await openOverview();
    await wrapper
      .findAll(".view-switch button")
      .find((b) => b.text() === "Grid")
      ?.trigger("click");

    await wrapper.get(".page-title-row button[aria-label='Help for Overview']").trigger("click");
    const dialog = wrapper.get("main dialog");
    expect(dialog.get("h2").text()).toBe("Overview help");
    expect(dialog.findAll("[data-test=help-name]").map((name) => name.text())).toContain("Clash");
    await dialog.get("button").trigger("click");

    const pressed = wrapper.findAll(".view-switch button[aria-pressed=true]");
    expect(pressed.map((b) => b.text())).toEqual(["Grid"]);
  });
});
