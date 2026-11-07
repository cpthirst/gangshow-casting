import { SceneryFileList } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadData } from "./load-data.ts";
import { signInNeeded, useLocalSignIn } from "./sign-in.ts";

beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  useLocalSignIn();
});

const PATH = "/api/productions/2027/items/opening-number/scenery-files";

/** The stand-in API answers every request with this. */
function apiAnswers(answer: () => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(answer));
}

describe("Loading data from the API", () => {
  it("reads the API's answer by its schema", async () => {
    apiAnswers(() => new Response(JSON.stringify({ files: [{ name: "plan.pdf", size: 10 }] })));

    await expect(loadData(PATH, SceneryFileList)).resolves.toEqual({
      files: [{ name: "plan.pdf", size: 10 }],
    });
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([PATH]);
  });

  it("treats not found as nothing there yet, not as a failure", async () => {
    apiAnswers(() => new Response(null, { status: 404 }));

    await expect(loadData(PATH, SceneryFileList)).resolves.toBeUndefined();
  });

  it.each([500, 503, 400])("fails when the API answers %i", async (status) => {
    apiAnswers(() => new Response(null, { status }));

    await expect(loadData(PATH, SceneryFileList)).rejects.toThrow(`HTTP ${status}`);
  });

  it("fails when the API's answer isn't what the schema reads", async () => {
    apiAnswers(() => new Response(JSON.stringify({ files: "none" })));

    await expect(loadData(PATH, SceneryFileList)).rejects.toThrow();
  });

  it("fails when the API can't be reached", async () => {
    apiAnswers(() => Promise.reject(new TypeError("Failed to fetch")));

    await expect(loadData(PATH, SceneryFileList)).rejects.toThrow();
  });

  it("leaves a refused sign-in to the app, which asks the person to sign in", async () => {
    apiAnswers(() => new Response(null, { status: 401 }));

    await expect(loadData(PATH, SceneryFileList)).rejects.toThrow();
    expect(signInNeeded.value).toBe(true);
  });
});
