import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelQuestion, useConfirm } from "@/composables/useConfirm.ts";
import { cancelConfirmation, confirmation, goAhead } from "./ConfirmDialog.fixture.ts";
import ConfirmDialog from "./ConfirmDialog.vue";

enableAutoUnmount(afterEach);

const QUESTION = "Remove the role Parrot from Pirate Sketch? Anyone cast in it will be uncast.";

/** The dialog, mounted once as App mounts it, and a control on the page that asks it. */
async function askFromAButton() {
  const asker = document.createElement("button");
  document.body.append(asker);
  const wrapper = mount(ConfirmDialog, { attachTo: document.body });
  asker.focus();
  const answer = useConfirm()(QUESTION, "Remove role");
  await flushPromises();
  return { wrapper, asker, answer };
}

const dialog = () => document.querySelector<HTMLDialogElement>("dialog.confirm-dialog");

describe("Confirmation dialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("starts closed", () => {
    mount(ConfirmDialog, { attachTo: document.body });

    expect(dialog()?.open).toBe(false);
    expect(confirmation()).toBeUndefined();
  });

  it("asks the question unchanged, with the go-ahead it's given and Cancel", async () => {
    await askFromAButton();

    expect(confirmation()).toEqual({ question: QUESTION, buttons: ["Remove role", "Cancel"] });
  });

  it("opens as a modal named by its question, so nothing behind it can be reached", async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");

    await askFromAButton();

    expect(showModal).toHaveBeenCalledOnce();
    const name = document.getElementById(dialog()?.getAttribute("aria-labelledby") ?? "");
    expect(name?.textContent).toBe(QUESTION);
  });

  it("starts with focus on Cancel", async () => {
    await askFromAButton();

    expect(document.activeElement?.textContent?.trim()).toBe("Cancel");
    expect(dialog()?.contains(document.activeElement)).toBe(true);
  });

  it("answers yes only from the go-ahead button", async () => {
    const { answer } = await askFromAButton();

    await goAhead();

    await expect(answer).resolves.toBe(true);
    expect(dialog()?.open).toBe(false);
  });

  it("answers no from Cancel, returning focus to the control that asked", async () => {
    const { asker, answer } = await askFromAButton();

    await cancelConfirmation();

    await expect(answer).resolves.toBe(false);
    expect(dialog()?.open).toBe(false);
    expect(document.activeElement).toBe(asker);
  });

  it("answers no on Escape, returning focus to the control that asked", async () => {
    const { wrapper, asker, answer } = await askFromAButton();

    await wrapper.get("dialog").trigger("keydown", { key: "Escape" });

    await expect(answer).resolves.toBe(false);
    expect(dialog()?.open).toBe(false);
    expect(document.activeElement).toBe(asker);
  });

  it("answers no when the browser cancels it", async () => {
    const { wrapper, answer } = await askFromAButton();

    await wrapper.get("dialog").trigger("cancel");

    await expect(answer).resolves.toBe(false);
    expect(dialog()?.open).toBe(false);
  });

  it("returns focus to the control it was asked from, even if a tap never focused it", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    mount(ConfirmDialog, { attachTo: document.body });
    const answer = useConfirm()(QUESTION, "Remove role", opener);
    await flushPromises();

    await cancelConfirmation();

    await expect(answer).resolves.toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("answers no on a click outside it, but not on one inside it", async () => {
    const { wrapper, answer } = await askFromAButton();

    await wrapper.get("dialog p").trigger("click");
    expect(dialog()?.open).toBe(true);

    // A click on the backdrop lands on the dialog itself, outside its content.
    await wrapper.get("dialog").trigger("click");
    await expect(answer).resolves.toBe(false);
    expect(dialog()?.open).toBe(false);
  });

  it("returns focus to the control a newer question was asked from, when it replaces one", async () => {
    const { answer: first } = await askFromAButton();
    const second = document.createElement("button");
    document.body.append(second);
    const answer = useConfirm()("Remove the role Smee?", "Remove role", second);
    await flushPromises();

    await cancelConfirmation();

    await expect(first).resolves.toBe(false);
    await expect(answer).resolves.toBe(false);
    expect(document.activeElement).toBe(second);
  });

  it("closes when its question is cancelled elsewhere, as on leaving the page", async () => {
    const { answer } = await askFromAButton();

    cancelQuestion();
    await flushPromises();

    await expect(answer).resolves.toBe(false);
    expect(dialog()?.open).toBe(false);
  });
});
