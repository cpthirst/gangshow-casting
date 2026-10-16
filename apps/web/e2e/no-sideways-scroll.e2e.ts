import { expect, type Page, test } from "@playwright/test";

// Happy-path walks through each page at phone widths (the projects in playwright.config.ts),
// checking after each step that nothing pushes the page wider than the screen. The made-up
// data in e2e/data has deliberately long names and titles to stress the layout.

const PIRATE_SKETCH = "The Extraordinarily Long Pirate Sketch Title";

/** Fails if the page, or any box on it (like a table's scroll region), scrolls sideways,
 *  naming the elements responsible. */
async function expectNoSidewaysScroll(page: Page) {
  const layout = await page.evaluate(() => {
    const name = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`;
    const all = [...document.querySelectorAll("body *")];
    const screen = document.documentElement.clientWidth;
    return {
      screen,
      pageWidth: document.documentElement.scrollWidth,
      sticksOut: all.filter((el) => el.getBoundingClientRect().right > screen + 1).map(name),
      scrollingBoxes: all
        .filter((el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowX))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map(name),
    };
  });
  expect(
    layout.pageWidth,
    `wider than the screen: ${layout.sticksOut.join(", ")}`,
  ).toBeLessThanOrEqual(layout.screen);
  expect(layout.scrollingBoxes, "boxes that scroll sideways").toEqual([]);
}

test("the running order and its edit form fit the screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Opening Number")).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: `Edit ${PIRATE_SKETCH}` }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("the cast list and its add and edit forms fit the screen", async ({ page }) => {
  await page.goto("/cast");
  await expect(page.getByText("Featherstonehaugh-Smythe")).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: "Add cast member" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Edit Alexandra-Rose Featherstonehaugh-Smythe" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("the items list and an item's casting page fit the screen", async ({ page }) => {
  await page.goto("/casting/items");
  await expect(page.getByText(PIRATE_SKETCH)).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("link", { name: `Cast ${PIRATE_SKETCH}` }).click();
  await expect(page.getByRole("heading", { name: PIRATE_SKETCH })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("an item's add-role and edit-role forms fit the screen", async ({ page }) => {
  await page.goto("/casting/items/itm-2");
  await expect(page.getByRole("heading", { name: PIRATE_SKETCH })).toBeVisible();

  await page.getByRole("button", { name: "Add role" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Edit Smee the Bumbling Boatswain's Mate" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole("button", { name: "Cancel" }).click();

  // An ensemble's editor lists every member, which once widened the page.
  await page.getByRole("button", { name: "Edit Pirates" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("a clash's description is written out on phones and fits the screen", async ({ page }) => {
  // e2e/data gives the longest name a back-to-back clash: Narrator, then Smee.
  await page.goto("/casting/items/itm-2");
  const clash = page
    .locator("[data-test=cast-name]", { hasText: "Featherstonehaugh-Smythe" })
    .first();

  await expect(
    clash.getByText("Error: back-to-back. Lead in 'Opening Number', then Support"),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("an item's Previous and Next share a row, cutting a long title short", async ({ page }) => {
  // Item 3's Previous is the e2e data's long Pirate Sketch title, beside a Next link.
  await page.goto("/casting/items/itm-3");
  const title = page.locator("a[rel=prev] .step-title");

  await expect(title).toHaveText(PIRATE_SKETCH);
  await expect(page.locator("a[rel=next]")).toBeVisible();
  const isCutShort = await title.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(isCutShort).toBe(true);
  await expectNoSidewaysScroll(page);
});

test("the casting overview fits the screen", async ({ page }) => {
  await page.goto("/casting/overview");
  await expect(page.getByRole("heading", { name: /Explorers/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
});
