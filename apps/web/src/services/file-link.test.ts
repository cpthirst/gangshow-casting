import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFrom, openFileTab } from "./file-link.ts";

afterEach(() => vi.restoreAllMocks());

describe("openFileTab", () => {
  const aBlankTab = () => ({ opener: {}, location: { href: "about:blank" }, close: vi.fn() });

  it("opens a blank tab at once, and sends it to the file once its link arrives", () => {
    const blank = aBlankTab();
    const open = vi.fn(() => blank);

    const tab = openFileTab(open);
    expect(open).toHaveBeenCalledWith("", "_blank");
    tab.show("https://files.example/set-plan.pdf?signed");

    expect(blank.location.href).toBe("https://files.example/set-plan.pdf?signed");
  });

  it("cuts the tab off from the app before it goes to the file", () => {
    const blank = aBlankTab();

    openFileTab(() => blank).show("https://files.example/set-plan.pdf?signed");

    expect(blank.opener).toBeNull();
  });

  it("closes the tab when there's no file to show", () => {
    const blank = aBlankTab();

    openFileTab(() => blank).close();

    expect(blank.close).toHaveBeenCalled();
  });

  it("opens the file in a tab of its own once the link arrives, if the browser blocked the blank tab", () => {
    const open = vi.fn<(url: string, target: string, features?: string) => null>(() => null);

    openFileTab(open).show("https://files.example/set-plan.pdf?signed");

    expect(open).toHaveBeenLastCalledWith(
      "https://files.example/set-plan.pdf?signed",
      "_blank",
      "noopener",
    );
  });
});

describe("downloadFrom", () => {
  it("follows the link, which tells the browser to save the file", () => {
    const followed: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      followed.push(this.href);
    });

    downloadFrom("https://files.example/build-list.xlsx?signed");

    expect(followed).toEqual(["https://files.example/build-list.xlsx?signed"]);
  });
});
