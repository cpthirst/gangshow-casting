import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import HelpPage from "@/pages/HelpPage.vue";
import { createAppRouter } from "@/router/index.ts";
import HelpButton from "./HelpButton.vue";

enableAutoUnmount(afterEach);

function openPageWithHelp() {
  return mount(HelpButton, { props: { page: "running-order" }, attachTo: document.body });
}

const helpButton = (wrapper: ReturnType<typeof openPageWithHelp>) =>
  wrapper.get<HTMLButtonElement>("button[aria-label='Help for Running order']");
const dialog = (wrapper: ReturnType<typeof openPageWithHelp>) =>
  wrapper.get<HTMLDialogElement>("dialog");
const closeButton = (wrapper: ReturnType<typeof openPageWithHelp>) =>
  dialog(wrapper).get(".help-dialog-title button");

async function openHelp(wrapper: ReturnType<typeof openPageWithHelp>) {
  helpButton(wrapper).element.focus();
  await helpButton(wrapper).trigger("click");
}

describe("Help button", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("is named after the page whose help it opens, and starts closed", () => {
    const wrapper = openPageWithHelp();

    expect(helpButton(wrapper).text()).toContain("Help");
    expect(dialog(wrapper).element.open).toBe(false);
  });

  it("opens the page's help in a dialog titled after the page", async () => {
    const wrapper = openPageWithHelp();

    await openHelp(wrapper);

    expect(dialog(wrapper).element.open).toBe(true);
    const title = document.getElementById(dialog(wrapper).attributes("aria-labelledby") ?? "");
    expect(title?.textContent).toBe("Running order help");
  });

  it("shows the same help as the Help page", async () => {
    const wrapper = openPageWithHelp();

    await openHelp(wrapper);

    const router = createAppRouter(createMemoryHistory());
    const helpPage = mount(HelpPage, { global: { plugins: [router] } });
    await flushPromises();
    const onHelp = helpPage.get("section[aria-labelledby='help-running-order'] .help-lines");
    expect(dialog(wrapper).get(".help-lines").html()).toBe(onHelp.html());
  });

  it("opens as a modal, so the page behind can't be reached until it closes", async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const wrapper = openPageWithHelp();

    await openHelp(wrapper);

    expect(showModal).toHaveBeenCalledOnce();
  });

  it("moves focus into the help when it opens", async () => {
    const wrapper = openPageWithHelp();

    await openHelp(wrapper);

    expect(dialog(wrapper).element.contains(document.activeElement)).toBe(true);
  });

  it("closes from its Close button, returning focus to the help button", async () => {
    const wrapper = openPageWithHelp();
    await openHelp(wrapper);

    expect(closeButton(wrapper).text()).toBe("Close");
    await closeButton(wrapper).trigger("click");

    expect(dialog(wrapper).element.open).toBe(false);
    expect(document.activeElement).toBe(helpButton(wrapper).element);
  });

  it("closes on Escape, returning focus to the help button", async () => {
    const wrapper = openPageWithHelp();
    await openHelp(wrapper);

    await closeButton(wrapper).trigger("keydown", { key: "Escape" });

    expect(dialog(wrapper).element.open).toBe(false);
    expect(document.activeElement).toBe(helpButton(wrapper).element);
  });

  it("closes on a click outside the help, but not on one inside it", async () => {
    const wrapper = openPageWithHelp();
    await openHelp(wrapper);

    await dialog(wrapper).get(".help-lines").trigger("click");
    expect(dialog(wrapper).element.open).toBe(true);

    // A click on the backdrop lands on the dialog itself, outside its content.
    await dialog(wrapper).trigger("click");
    expect(dialog(wrapper).element.open).toBe(false);
  });

  it("never asks the server for the help", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const wrapper = openPageWithHelp();

    await openHelp(wrapper);

    expect(fetch).not.toHaveBeenCalled();
  });
});
