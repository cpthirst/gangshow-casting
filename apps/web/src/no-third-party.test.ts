import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";

// Most of the cast are under 18: the app must not send visitors' IP addresses
// to outside providers (fonts, CDNs), so everything is served from our origin.
const sources: Record<string, string> = {
  "index.html": indexHtml,
  ...import.meta.glob<string>(["./**/*.{vue,css,ts}", "!./**/*.test.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};

const externalUrl = /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i;

describe("third-party requests", () => {
  it("loads no fonts, styles or scripts from another origin", () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => externalUrl.test(text))
      .map(([file]) => file);

    expect(Object.keys(sources).length).toBeGreaterThan(1);
    expect(offenders).toEqual([]);
  });

  it("bundles the brand font with the app", () => {
    expect(sources["./main.ts"]).toContain("@fontsource-variable/nunito-sans");
  });
});
