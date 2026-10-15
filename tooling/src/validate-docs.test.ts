import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseFrontmatter, validateRepo, validateStory } from "./validate-docs.ts";

const story = (over: { status?: string; id?: string; body?: string } = {}) => `---
id: ${over.id ?? "capture.E1.S1"}
title: Save a draft
epic: E1
status: ${over.status ?? "ready"}
---

## Story

As a candidate, I want to save a draft, so that I don't lose work.

## Acceptance criteria

${
  over.body ??
  `### AC1: Draft is saved
Given I have typed a story
When I click save
Then the draft is stored

### AC2: Empty drafts are rejected
Given the editor is empty
When I click save
Then I see a validation error`
}
`;

const check = (text: string) =>
  validateStory("docs/product/capture/stories/E1-S1-save-draft.md", text, { feature: "capture" });

describe("parseFrontmatter", () => {
  it("reads flat key/value frontmatter", () => {
    expect(parseFrontmatter("---\nid: a.E1.S1\nstatus: done\n---\nbody").data).toEqual({
      id: "a.E1.S1",
      status: "done",
    });
  });

  it("returns empty data when there is no frontmatter", () => {
    expect(parseFrontmatter("# hi").data).toEqual({});
  });
});

describe("validateStory: structure", () => {
  it("accepts a well-formed ready story", () => {
    expect(check(story())).toEqual([]);
  });

  it("requires frontmatter fields and a known status", () => {
    const errors = check("---\nid: capture.E1.S1\nstatus: shipped\n---\n");
    expect(errors).toContainEqual(expect.stringContaining("missing frontmatter: title"));
    expect(errors).toContainEqual(expect.stringContaining("missing frontmatter: epic"));
    expect(errors).toContainEqual(expect.stringContaining('unknown status "shipped"'));
  });

  it("requires the id to match the feature folder and E<n>.S<n> shape", () => {
    expect(check(story({ id: "other.E1.S1" }))).toContainEqual(
      expect.stringContaining("id must look like capture.E<n>.S<n>"),
    );
  });

  it("requires an 'As a… I want… so that…' statement", () => {
    expect(check(story().replace("As a candidate", "Candidates"))).toContainEqual(
      expect.stringContaining("As a"),
    );
  });

  it("requires every acceptance criterion to have Given/When/Then", () => {
    const errors = check(story({ body: "### AC1: Broken\nGiven x\nThen y" }));
    expect(errors).toContainEqual(expect.stringContaining("AC1 is missing When"));
  });

  it("lets draft stories omit acceptance criteria, but not ready ones", () => {
    expect(check(story({ status: "draft", body: "" }))).toEqual([]);
    expect(check(story({ body: "" }))).toContainEqual(
      expect.stringContaining("at least one acceptance criterion"),
    );
  });
});

describe("validateStory: done stories", () => {
  // AC coverage is judged by test-auditor at review time, not by test names (ADR 0007).
  it("validates a done story on structure alone", () => {
    expect(check(story({ status: "done" }))).toEqual([]);
  });
});

describe("validateRepo", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true });
  });

  function repoWith(stories: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), "validate-docs-"));
    roots.push(root);
    for (const [path, text] of Object.entries(stories)) {
      const file = join(root, "docs/product", path);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, text);
    }
    return root;
  }

  it("validates stories in top-level feature folders", () => {
    const root = repoWith({ "capture/stories/E1-S1-save-draft.md": story() });
    expect(validateRepo(root)).toEqual({ stories: 1, errors: [] });
  });

  it("validates nested features, naming them by their path", () => {
    const root = repoWith({
      "casting/items/stories/E1-S1-list.md": story({ id: "casting-items.E1.S1" }),
      "casting/roles/stories/E1-S1-add.md": story({ id: "roles.E1.S1" }),
    });
    const { stories, errors } = validateRepo(root);
    expect(stories).toBe(2);
    expect(errors).toEqual([
      expect.stringContaining("docs/product/casting/roles/stories/E1-S1-add.md"),
    ]);
    expect(errors[0]).toContain("casting-roles.E<n>.S<n>");
  });

  it("finds features nested inside a feature folder", () => {
    const root = repoWith({
      "casting/stories/E1-S1-plan.md": story({ id: "casting.E1.S1" }),
      "casting/items/stories/E1-S1-list.md": story({ id: "casting-items.E1.S1" }),
    });
    expect(validateRepo(root)).toEqual({ stories: 2, errors: [] });
  });

  it("ignores a stories folder at the root of docs/product", () => {
    const root = repoWith({ "stories/E1-S1-stray.md": story() });
    expect(validateRepo(root)).toEqual({ stories: 0, errors: [] });
  });
});
