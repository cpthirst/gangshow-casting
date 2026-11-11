import { RunningOrder, type RunningOrderItem } from "@app/shared";
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
  await page.goto("/running-order");
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

test("the accounts list, its add form and a new account's password fit the screen", async ({
  page,
}, testInfo) => {
  // Both widths share one API, so each adds its own account: a long, unbroken username.
  const username = `extraordinarily-long-name-${testInfo.project.name.slice(-3)}`;
  await page.goto("/admin/accounts");
  await expect(page.getByRole("cell", { name: "robin", exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: "Add account" }).click();
  await page.getByLabel("Username").fill(username);
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`Pass this temporary password to ${username}`)).toBeVisible();
  await expect(page.getByRole("cell", { name: username, exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("the productions list, its start form and its confirmation fit the screen", async ({
  page,
}) => {
  await page.goto("/admin/productions");
  // On a phone each cell also reads out its card label, so find the year in the table's text.
  const list = page.getByRole("region", { name: "Productions" });
  await expect(list.getByText("2027", { exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: "Add production" }).click();
  await expect(page.getByLabel("Year")).toBeFocused();
  await expectNoSidewaysScroll(page);

  await page.getByLabel("Year").fill("next year");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("The year must be a four-digit year later than 2027.")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Cancelled, as every walk shares one API and the others need 2027 to stay the newest.
  await page.getByLabel("Year").fill("2028");
  await page.getByRole("button", { name: "Save" }).click();
  const confirmation = page.getByRole("dialog", { name: /Start production 2028\?/ });
  await expect(confirmation).toBeVisible();
  await expectNoSidewaysScroll(page);
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).toBeHidden();
  await expect(list.getByText("2028", { exact: true })).toBeHidden();
  await expectNoSidewaysScroll(page);
});

test("the usage list fits the screen", async ({ page }) => {
  // Opening the app records a session for the made-up local admin, so their row has a date.
  await page.goto("/admin/usage");
  // alex is in the activity list too: look in the per-person table.
  const byPerson = page.getByRole("region", { name: "Usage by person" });
  await expect(byPerson.getByRole("cell", { name: "alex", exact: true })).toBeVisible();
  await expect(page.getByText("Usage has been recorded since")).toBeVisible();
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

test("the Production overview's five department buttons and counts fit the screen", async ({
  page,
}) => {
  await page.goto("/production/overview");
  const row = page.locator("[data-test=item]", { hasText: PIRATE_SKETCH });

  await expect(row.locator(".icon-button")).toHaveCount(5);
  await expect(row.locator("[data-test=count]")).toHaveCount(5);
  await expect(row.locator("[data-test=count][data-department=scenery]")).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("a department's page for a long-titled item fits the screen", async ({ page }) => {
  await page.goto("/production/items/itm-2/sfx");
  await expect(page.getByRole("heading", { name: `SFX: ${PIRATE_SKETCH}` })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

/** Each department in an item page's switch: its accessible name and where it sits. */
async function departmentsOf(page: Page) {
  const entries = page
    .getByRole("navigation", { name: "Departments" })
    .locator("[data-test=department]");
  await expect(entries).toHaveCount(5);
  return Promise.all(
    (await entries.all()).map(async (entry) => ({
      name: await entry.getAttribute("data-tooltip"),
      top: (await entry.boundingBox())?.y,
      nameWidth: (await entry.locator(".department-name").boundingBox())?.width ?? 0,
    })),
  );
}

test("an item page's department switch fits on one row, as icons named for screen readers", async ({
  page,
}) => {
  await page.goto("/production/items/itm-2/mic-plot");
  await expect(page.getByRole("heading", { name: `Mic plot: ${PIRATE_SKETCH}` })).toBeVisible();

  const departments = await departmentsOf(page);
  expect(new Set(departments.map(({ top }) => top)).size, "rows the switch takes").toBe(1);
  for (const { name, nameWidth } of departments) {
    expect(nameWidth, `${name}'s name on screen`).toBeLessThanOrEqual(1);
  }
  const switcher = page.getByRole("navigation", { name: "Departments" });
  await expect(switcher.getByRole("link", { name: "Wardrobe" })).toBeVisible();
  await expect(switcher.locator("[aria-current=page]")).toHaveText("Mic plot");
  await expectNoSidewaysScroll(page);
});

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1024, height: 768 }, isMobile: false });

  test("an item page's department switch shows each department's name", async ({ page }) => {
    await page.goto("/production/items/itm-2/sfx");
    await expect(page.getByRole("heading", { name: `SFX: ${PIRATE_SKETCH}` })).toBeVisible();

    for (const { name, nameWidth } of await departmentsOf(page)) {
      expect(nameWidth, `${name}'s name on screen`).toBeGreaterThan(1);
    }
  });
});

test("an item's 24 mics, and a channel's cast member picker, fit the screen", async ({ page }) => {
  // e2e/data gives the long Pirate Sketch title's Mic 1 to the cast's longest name, who plays
  // its longest role too.
  const longest = "Alexandra-Rose Featherstonehaugh-Smythe";
  await page.goto("/production/items/itm-2/mic-plot");
  await expect(page.getByLabel("Mic 1 cast member")).toHaveValue(longest);
  await expect(page.getByText("Smee the Bumbling Boatswain's Mate, Pirates")).toBeVisible();
  await expect(page.getByLabel("Mic 24 cast member")).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByLabel("Mic 2 cast member").fill("o");
  await expect(page.getByRole("option", { name: /Jo Newcomer/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("an item's props, and a prop's carrier picker, fit the screen", async ({ page }) => {
  // e2e/data gives the long Pirate Sketch title a long-named prop that the Pirates' longest
  // name carries, with one more to choose.
  const chest = "Extraordinarily heavy treasure chest with a padlock";
  await page.goto("/production/items/itm-2/props");
  await expect(page.getByText("1 left to choose")).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: `Edit ${chest}` }).click();
  await expect(page.getByLabel("Assign Pirates to carry the prop")).toBeVisible();
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

test("an item's long notes wrap on its Items list card and fit the screen", async ({ page }) => {
  // e2e/data gives the long Pirate Sketch title's item a 500-character note.
  await page.goto("/casting/items");
  const notes = page.locator("[data-test=item-notes]");

  await expect(notes).toBeVisible();
  const lineHeight = await notes
    .locator("td")
    .evaluate((cell) => parseFloat(getComputedStyle(cell).lineHeight));
  expect((await notes.boundingBox())?.height ?? 0).toBeGreaterThan(lineHeight * 3);
  await expectNoSidewaysScroll(page);
});

test("the casting overview fits the screen", async ({ page }) => {
  await page.goto("/casting/overview");
  await expect(page.getByRole("heading", { name: /Explorers/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

/** For each person's timeline: how many dots, their smallest size, whether each half's dots
 *  sit on one line, and whether the whole row is one line with a wider gap at the interval. */
async function timelineLayout(page: Page) {
  return page.locator("[data-test=timeline]").evaluateAll((timelines) =>
    timelines.map((timeline) => {
      const halves = [...timeline.querySelectorAll("[data-test=timeline-half]")].map((half) =>
        [...half.querySelectorAll("[data-test=dot]")].map((dot) => dot.getBoundingClientRect()),
      );
      const dots = halves.flat();
      const onOneLine = (boxes: DOMRect[]) =>
        new Set(boxes.map((box) => Math.round(box.top))).size === 1;
      const gaps = (boxes: DOMRect[]) =>
        boxes.slice(1).map((box, i) => box.left - (boxes[i]?.right ?? box.left));
      const [first = [], second = []] = halves;
      const interval = (second[0]?.left ?? 0) - (first.at(-1)?.right ?? 0);
      return {
        dots: dots.length,
        smallest: Math.round(Math.min(...dots.map((dot) => dot.width))),
        halvesOnOneLine: halves.every(onOneLine),
        rowOnOneLine: onOneLine(dots),
        intervalWider: interval > Math.max(...gaps(first), ...gaps(second)),
      };
    }),
  );
}

// The Overview's API: the made-up e2e show's production (see e2e/data).
const RUNNING_ORDER_URL = "**/api/productions/2027/running-order";

/** Stands in a made-up show of `count` items, split between the halves, for one walk. */
async function showOf(page: Page, count: number) {
  const item = (n: number): RunningOrderItem => ({
    id: `big-${n}`,
    title: `Made-up Item ${n}`,
    cast: "",
    stage: ["full"],
    leads: "",
    comments: "",
    minutes: 3,
    printed: true,
    gang: "senior",
  });
  const half = Math.ceil(count / 2);
  await page.route(RUNNING_ORDER_URL, async (route) => {
    const response = await route.fetch();
    const order = RunningOrder.parse(await response.json());
    order.halves[0].items = Array.from({ length: half }, (_, i) => item(i + 1));
    order.halves[1].items = Array.from({ length: count - half }, (_, i) => item(half + i + 1));
    await route.fulfill({ response, json: order });
  });
}

async function openTimelines(page: Page) {
  await page.goto("/casting/overview");
  await expect(page.locator("[data-test=timeline]").first()).toBeVisible();
  const layouts = await timelineLayout(page);
  expect(layouts.length).toBeGreaterThan(0);
  return layouts;
}

test("a 20-item show's timelines fit on one line, with a wider gap at the interval", async ({
  page,
}) => {
  await showOf(page, 20);
  const layouts = await openTimelines(page);

  expect(
    layouts.map(({ dots, rowOnOneLine, intervalWider }) => ({ dots, rowOnOneLine, intervalWider })),
  ).toEqual(layouts.map(() => ({ dots: 20, rowOnOneLine: true, intervalWider: true })));
  await expectNoSidewaysScroll(page);
});

test("a 30-item show's timelines keep readable dots, wrapping half by half", async ({ page }) => {
  await showOf(page, 30);
  const layouts = await openTimelines(page);

  expect(layouts.map(({ dots, halvesOnOneLine }) => ({ dots, halvesOnOneLine }))).toEqual(
    layouts.map(() => ({ dots: 30, halvesOnOneLine: true })),
  );
  expect(Math.min(...layouts.map((layout) => layout.smallest))).toBeGreaterThanOrEqual(8);
  await expectNoSidewaysScroll(page);
});

test.describe("on a desktop screen", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

  // Just above the width where the Overview turns into cards, its table is at its tightest;
  // the count headings are capitals that can't wrap.
  for (const width of [1125, 1280]) {
    test(`the Production overview's table fits ${width}px without scrolling sideways`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/production/overview");
      await expect(page.locator("main thead").first()).toBeVisible();
      await expectNoSidewaysScroll(page);
      for (const box of await page.locator("main .table-scroll").all()) {
        expect(await box.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
      }
    });
  }

  test("timeline dots stay full size", async ({ page }) => {
    await showOf(page, 20);
    const layouts = await openTimelines(page);

    expect(layouts.map((layout) => layout.smallest)).toEqual(layouts.map(() => 14));
  });
});

test("the menu opens on a phone and its groups open and fold away, and Welcome leads to them", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expectNoSidewaysScroll(page);

  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Menu" }).click();
  const production = menu.getByRole("button", { name: "Production" });
  // Casting has an Overview too: this is the one in Production's group.
  const productionPage = menu.locator("#menu-production-pages").getByRole("link", {
    name: "Overview",
  });
  await expect(production).toHaveAttribute("aria-expanded", "false");
  await expect(productionPage).toBeHidden();

  await production.click();
  await expect(production).toHaveAttribute("aria-expanded", "true");
  await expect(productionPage).toBeVisible();
  await expectNoSidewaysScroll(page);

  await production.click();
  await expect(productionPage).toBeHidden();

  // The guide on Welcome goes to a group's first page, and the menu has that group open.
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(menu).toBeHidden();
  await page.getByRole("main").getByRole("link", { name: "Casting" }).click();
  await expect(page).toHaveURL(/\/casting\/overview$/);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(menu.getByRole("button", { name: "Casting" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(menu.getByRole("link", { name: "Items" })).toBeVisible();
  await expectNoSidewaysScroll(page);
});
