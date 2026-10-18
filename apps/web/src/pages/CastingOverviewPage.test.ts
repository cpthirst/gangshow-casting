import type { CastMember, Role, RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "../App.vue";
import { CAST_PATH } from "../cast.ts";
import { ROLES_PATH } from "../roles.ts";
import { createAppRouter } from "../router.ts";
import { anItem, aRunningOrder } from "../running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "../running-order.ts";

enableAutoUnmount(afterEach);

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
      "1 · Opening Number (First half)",
      "2 · Pirate Sketch (First half)",
      "1 · Dance One (Second half)",
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

  it("leaves a cell empty where the person isn't cast", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const cell = rowOf(wrapper, "Sam")[3];
    expect(cell?.find("[data-test=grid-dot]").exists()).toBe(false);
    expect(cell?.classes()).toContain("grid-empty");
  });

  it("keeps someone with no parts, with every item empty", async () => {
    theShowIs(cast);

    const wrapper = await openGrid();

    const items = rowOf(wrapper, "Jo").slice(3);
    expect(items).toHaveLength(3);
    expect(items.every((cell) => cell.classes().includes("grid-empty"))).toBe(true);
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
      "1 · One (First half)",
      "2 · Two (First half)",
      "3 · Three (First half)",
      "1 · Four (Second half)",
      "2 · Five (Second half)",
      "3 · Six (Second half)",
      "4 · Finale (Second half)",
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
    expect(heads.slice(3)).toEqual([
      "1 · Opening Number (First half)",
      "Entr'acte (First half, not in printed programme)",
      "1 · Dance One (Second half)",
    ]);
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
      "1 · Fifteen Letters... (First half)",
      "2 · Exactly 15 char (First half)",
      "3 · Short (First half)",
      "The Grand Final... (First half, not in printed programme)",
    ]);
    // The whole name is still there for hover and for screen readers.
    expect(heads[0]?.attributes("title")).toBe("1 · Fifteen Letters! (First half)");
    expect(heads[0]?.attributes("aria-label")).toBe("1 · Fifteen Letters! (First half)");
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
