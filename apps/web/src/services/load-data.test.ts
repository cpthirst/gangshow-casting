import { ItemFileList } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessRefused, loadData, loadRequired } from "./load-data.ts";
import { openProduction } from "./production.ts";
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

    await expect(loadData(PATH, ItemFileList)).resolves.toEqual({
      files: [{ name: "plan.pdf", size: 10 }],
    });
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([PATH]);
  });

  it("treats not found as nothing there yet, not as a failure", async () => {
    apiAnswers(() => new Response(null, { status: 404 }));

    await expect(loadData(PATH, ItemFileList)).resolves.toBeUndefined();
  });

  it.each([500, 503, 400])("fails when the API answers %i", async (status) => {
    apiAnswers(() => new Response(null, { status }));

    await expect(loadData(PATH, ItemFileList)).rejects.toThrow(`HTTP ${status}`);
  });

  it("fails when the API's answer isn't what the schema reads", async () => {
    apiAnswers(() => new Response(JSON.stringify({ files: "none" })));

    await expect(loadData(PATH, ItemFileList)).rejects.toThrow();
  });

  it("fails when the API can't be reached", async () => {
    apiAnswers(() => Promise.reject(new TypeError("Failed to fetch")));

    await expect(loadData(PATH, ItemFileList)).rejects.toThrow();
  });

  it("leaves a refused sign-in to the app, which asks the person to sign in", async () => {
    apiAnswers(() => new Response(null, { status: 401 }));

    await expect(loadData(PATH, ItemFileList)).rejects.toThrow();
    expect(signInNeeded.value).toBe(true);
  });

  it("says so when the API refuses this person the data", async () => {
    apiAnswers(() => new Response(null, { status: 403 }));

    await expect(loadData(PATH, ItemFileList)).rejects.toBeInstanceOf(AccessRefused);
  });

  it("doesn't call any other failure a refusal", async () => {
    apiAnswers(() => new Response(null, { status: 500 }));

    await expect(loadData(PATH, ItemFileList)).rejects.not.toBeInstanceOf(AccessRefused);
  });
});

describe("Loading data that must be there", () => {
  it("reads the API's answer by its schema", async () => {
    apiAnswers(() => new Response(JSON.stringify({ files: [] })));

    await expect(loadRequired(PATH, ItemFileList)).resolves.toEqual({ files: [] });
  });

  it("fails when there's nothing there", async () => {
    apiAnswers(() => new Response(null, { status: 404 }));

    await expect(loadRequired(PATH, ItemFileList)).rejects.toThrow();
  });

  it("fails as loading does when the API fails", async () => {
    apiAnswers(() => new Response(null, { status: 500 }));

    await expect(loadRequired(PATH, ItemFileList)).rejects.toThrow("HTTP 500");
  });
});

describe("Something missing from the newest production", () => {
  afterEach(() => openProduction(undefined));

  it("asks for nothing more, so an ordinary 404 costs no list request", async () => {
    openProduction("2027");
    apiAnswers(() => new Response(null, { status: 404 }));

    await expect(loadData(PATH, ItemFileList)).resolves.toBeUndefined();

    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([PATH]);
  });
});
