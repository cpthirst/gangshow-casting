import { CastMember } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createAddCastMember } from "./add-cast-member.ts";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";

const request = (body: unknown, productionId = "2027") => ({
  pathParameters: { productionId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const jo = { firstName: "Jo", lastName: "Newcomer", section: "scouts", group: "1st Somewhere" };

function setUp() {
  const store = inMemoryCastStore([aCastList([aCastMember(1), aCastMember(56)])]);
  return { store, handler: createAddCastMember(store) };
}

describe("add cast member handler", () => {
  it("returns 201 with the saved member, its new id and revision 1", async () => {
    const { store, handler } = setUp();

    const res = await handler(request(jo));

    expect(res.statusCode).toBe(201);
    expect(CastMember.parse(JSON.parse(res.body ?? ""))).toEqual({ ...jo, id: 57, revision: 1 });
    expect((await store.list("2027"))?.members).toHaveLength(3);
  });

  it("saves Singing and Acting notes with the member", async () => {
    const { store, handler } = setUp();
    const notes = { singing: "Strong alto, can solo", acting: "Comic timing" };

    expect((await handler(request({ ...jo, ...notes }))).statusCode).toBe(201);

    expect((await store.list("2027"))?.members.at(-1)).toMatchObject(notes);
  });

  it("rejects a note over 100 characters with 400, saving nothing", async () => {
    const { store, handler } = setUp();

    expect((await handler(request({ ...jo, acting: "x".repeat(101) }))).statusCode).toBe(400);
    expect((await store.list("2027"))?.members).toHaveLength(2);
  });

  it.each([
    ["an empty first name", { ...jo, firstName: "" }],
    ["a section outside the list", { ...jo, section: "beavers" }],
    ["an extra field such as a date of birth", { ...jo, dateOfBirth: "2012-01-01" }],
    ["malformed JSON", "{not json"],
  ])("rejects %s with 400, saving nothing", async (_case, body) => {
    const { store, handler } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
    expect((await store.list("2027"))?.members).toHaveLength(2);
  });

  it("returns 404 for a production with no cast list", async () => {
    const { handler } = setUp();

    expect((await handler(request(jo, "1999"))).statusCode).toBe(404);
  });
});
