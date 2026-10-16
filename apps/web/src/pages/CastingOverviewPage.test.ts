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
  let nextRoleId = 1;
  const role = (itemId: string, castMemberIds: number[], size: Role["size"] = "lead"): Role => {
    const id = nextRoleId++;
    return { id, itemId, name: `Role ${id}`, size, castMemberIds, revision: 1 };
  };
  const roles = [
    role("pirate-sketch", [sam.id]),
    role("entr'acte", [sam.id], "cameo"),
    role("finale", [sam.id], "support"),
    role("opening-number", [alex.id, sam.id + 100], "ensemble"),
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
    expect(card?.lastElementChild?.getAttribute("data-test")).toBe("timeline");
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
