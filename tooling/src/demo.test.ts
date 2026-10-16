import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CastList, RoleList, RunningOrder } from "@app/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_API_PORT, DEMO_WEB_PORT, demoServers, freshDemoData } from "./demo.ts";

const committed = (path: string) =>
  JSON.parse(readFileSync(new URL(`../demo/data/2027/${path}`, import.meta.url), "utf8"));

// The stored files also hold the next free id, which the API's list responses leave out.
const withoutNextId = ({ nextId: _, ...list }: Record<string, unknown>) => list;
const cast = CastList.parse(withoutNextId(committed("cast.json"))).members;
const roles = RoleList.parse(withoutNextId(committed("roles.json"))).roles;
const order = RunningOrder.parse(committed("running-order/v1.json"));
const items = order.halves.flatMap((half) => half.items);

// Each test's copy of the demo show, removed once the tests are done.
const copies: string[] = [];
function copyOfDemo() {
  const dir = freshDemoData();
  copies.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
});

describe("the demo show", () => {
  it("is a realistic full show in two halves with an interval", () => {
    expect(order.halves.map((half) => half.items.length)).toEqual([10, 10]);
    expect(order.intervalMinutes).toBeGreaterThan(0);
    expect(items.every((item) => item.minutes !== null && item.minutes > 0)).toBe(true);
  });

  it("has about 60 cast members across every section, and some with none", () => {
    expect(cast).toHaveLength(60);
    expect(new Set(cast.map((member) => member.section))).toEqual(
      new Set(["scouts", "explorers", "network", null]),
    );
  });

  it("has roles of every size, including an ensemble of 10 or more", () => {
    expect(new Set(roles.map((role) => role.size))).toEqual(
      new Set(["lead", "support", "cameo", "ensemble"]),
    );
    const ensembles = roles.filter((role) => role.size === "ensemble");
    expect(Math.max(...ensembles.map((role) => role.castMemberIds.length))).toBeGreaterThanOrEqual(
      10,
    );
  });
});

describe("the demo guide", () => {
  const guide = readFileSync(new URL("../demo/README.md", import.meta.url), "utf8");
  // Rows of the planted-clashes table: | Kind | Person | First item → Second item |
  const planted = [...guide.matchAll(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) → ([^|]+) \|$/gm)].map(
    ([, kind, person, first, second]) => ({ kind, person, first, second }),
  );

  it("lists a planted clash of every kind", () => {
    expect(planted.map((row) => row.kind)).toEqual([
      "Back-to-back error",
      "Back-to-back warning",
      "Timing warning",
      "Quick-change info",
    ]);
  });

  it.each(planted)("$kind: $person is cast in both $first and $second", (row) => {
    const person = cast.find((member) => `${member.firstName} ${member.lastName}` === row.person);
    const itemIdOf = (title: string | undefined) => items.find((item) => item.title === title)?.id;
    const isIn = (itemId: string | undefined) =>
      roles.some((role) => role.itemId === itemId && role.castMemberIds.includes(person?.id ?? 0));

    expect(person).toBeDefined();
    expect(isIn(itemIdOf(row.first))).toBe(true);
    expect(isIn(itemIdOf(row.second))).toBe(true);
  });
});

describe("pnpm demo", () => {
  const files = ["cast.json", "roles.json", "running-order/v1.json"];
  const read = (dir: string, file: string) =>
    JSON.parse(readFileSync(join(dir, "2027", file), "utf8"));

  it("starts each run from its own fresh copy of the demo show", () => {
    const first = copyOfDemo();
    const second = copyOfDemo();

    expect(first).not.toBe(second);
    for (const file of files) expect(read(first, file)).toEqual(committed(file));
  });

  it("never changes the committed demo show", () => {
    const before = files.map(committed);
    const copy = copyOfDemo();
    for (const file of files) writeFileSync(join(copy, "2027", file), "{}");

    expect(files.map(committed)).toEqual(before);
  });

  it("runs on its own ports, apart from pnpm dev, and labels the app as a demo", () => {
    const [api, web] = demoServers("/tmp/demo-copy");

    expect(api?.env).toMatchObject({ PORT: String(DEMO_API_PORT), DATA_DIR: "/tmp/demo-copy" });
    expect(web?.args).toEqual(expect.arrayContaining(["--port", String(DEMO_WEB_PORT)]));
    expect(web?.env).toMatchObject({
      API_URL: `http://127.0.0.1:${DEMO_API_PORT}`,
      VITE_DEMO: "true",
    });
    expect([DEMO_API_PORT, DEMO_WEB_PORT]).not.toContain(3000);
    expect([DEMO_API_PORT, DEMO_WEB_PORT]).not.toContain(5173);
  });
});

describe("the demo API", () => {
  // The demo's own API server, on a spare port so a running demo doesn't get in the way.
  const port = DEMO_API_PORT + 1;
  const api = `http://127.0.0.1:${port}/api/productions/2027/cast`;
  let server: ChildProcess;

  beforeAll(async () => {
    const [spec] = demoServers(copyOfDemo());
    if (!spec) throw new Error("no API server");
    server = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: { ...process.env, ...spec.env, PORT: String(port) },
    });
    await waitFor(api);
  });
  afterAll(async () => {
    const stopped = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await stopped;
  });

  it("serves the demo show's cast", async () => {
    const body = CastList.parse(await (await fetch(api)).json());

    expect(body.members).toHaveLength(60);
  });

  it("keeps changes while it runs, without touching the committed show", async () => {
    const added = await fetch(api, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: "Test", lastName: "Person", section: null, group: "" }),
    });
    expect(added.status).toBe(201);

    const body = CastList.parse(await (await fetch(api)).json());
    expect(body.members.map((member) => member.lastName)).toContain("Person");
    expect(committed("cast.json").members).toHaveLength(60);
  });
});

async function waitFor(url: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${url} never came up`);
}
