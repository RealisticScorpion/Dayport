import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { launch, newProfileDir, newTabUrl, optionsUrl, popupUrl } from "./extension";

// Milestone 2 acceptance (docs/roadmap.md): permission refusal leaves manual
// navigation usable; exclusions persist; automatic updates preserve pins; a
// failed save never closes tabs.

/**
 * Top sites come from localStorage so a test can change them between loads,
 * the way Chrome's list changes on its own. `refuse` makes every optional
 * permission look missing and the prompt refused.
 */
async function stubBrowser(context: BrowserContext, options: { refuse?: boolean } = {}) {
  await context.addInitScript((refuse) => {
    const api = (globalThis as unknown as { chrome?: typeof chrome }).chrome;
    if (!api?.topSites) return;
    api.topSites.get = (async () =>
      JSON.parse(localStorage.getItem("e2e-top-sites") ?? "[]")) as typeof api.topSites.get;
    api.history.search = (async () => []) as typeof api.history.search;
    if (refuse) {
      api.permissions.contains = (async () => false) as typeof api.permissions.contains;
      api.permissions.request = (async () => false) as typeof api.permissions.request;
    }
  }, options.refuse ?? false);
}

async function setTopSites(page: Page, sites: { url: string; title: string }[]) {
  await page.evaluate(
    (value) => localStorage.setItem("e2e-top-sites", JSON.stringify(value)),
    sites,
  );
  await page.reload();
}

const frequent = (page: Page) => page.locator('[aria-labelledby="dayport-frequent"]');
const pinned = (page: Page) => page.locator('[aria-labelledby="dayport-pinned"]');
const later = (page: Page) => page.locator('[aria-labelledby="dayport-later"]');

test("refusing permissions leaves manual navigation usable", async () => {
  const context = await launch(newProfileDir());
  await stubBrowser(context, { refuse: true });
  const page = await context.newPage();
  await page.goto(newTabUrl);

  await expect(frequent(page)).toContainText("Show sites you visit often");
  await frequent(page).getByRole("button", { name: "Enable" }).click();
  await expect(frequent(page)).toContainText("Not allowed.");

  await page.getByRole("button", { name: "Recently closed" }).click();
  await page
    .getByRole("dialog", { name: "Recently closed" })
    .getByRole("button", { name: "Enable" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Not allowed.");
  await page.keyboard.press("Escape");

  // Manual navigation still works.
  await page.getByRole("button", { name: "Add a link" }).click();
  await page.getByPlaceholder("URL · github.com").fill("example.com");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Done" }).click();
  await pinned(page).getByRole("link", { name: "example.com" }).click();
  await page.waitForURL("https://example.com/");
  await context.close();
});

test("pins survive suggestion updates and exclusions persist", async () => {
  const context = await launch(newProfileDir());
  await stubBrowser(context);
  const page = await context.newPage();
  await page.goto(newTabUrl);
  await setTopSites(page, [
    { url: "https://example.com/", title: "Example" },
    { url: "https://docs.test/a", title: "Docs A" },
    { url: "https://docs.test/b", title: "Docs B" },
  ]);

  // Pages on one domain share an expandable row; different paths stay separate.
  await expect(frequent(page).getByRole("button", { name: /^docs\.test/ })).toContainText(
    "2 pages",
  );
  await frequent(page)
    .getByRole("button", { name: /^docs\.test/ })
    .click();
  await expect(frequent(page).getByRole("link", { name: "Docs B" })).toBeVisible();

  // Pin a suggestion into a new group, then undo and pin again.
  await frequent(page).getByRole("button", { name: "Pin Example to a group" }).click();
  await page.getByRole("menuitem", { name: "+ New group" }).click();
  await expect(pinned(page).getByRole("link", { name: "Example" })).toBeVisible();
  await expect(frequent(page).getByRole("link", { name: "Example" })).toHaveCount(0);

  // Exclude a domain.
  await frequent(page).getByRole("button", { name: "More actions for docs.test" }).click();
  await page.getByRole("menuitem", { name: "Never suggest docs.test" }).click();
  await expect(page.getByRole("status")).toContainText("Won’t suggest pages from docs.test");
  await expect(frequent(page)).not.toContainText("docs.test");

  // Dismiss with Undo.
  await setTopSites(page, [
    { url: "https://example.com/", title: "Example" },
    { url: "https://docs.test/c", title: "Docs C" },
    { url: "https://new.test/", title: "New" },
  ]);
  await frequent(page).getByRole("button", { name: "Don’t suggest New" }).click();
  await expect(frequent(page).getByRole("link", { name: "New" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(frequent(page).getByRole("link", { name: "New" })).toBeVisible();

  // After the automatic list changes and the browser restarts, the pin and
  // the exclusion are both still in place.
  await page.reload();
  await expect(pinned(page).getByRole("link", { name: "Example" })).toBeVisible();
  await expect(frequent(page).getByRole("link", { name: "Example" })).toHaveCount(0);
  await expect(frequent(page)).not.toContainText("docs.test");

  const options = await context.newPage();
  await options.goto(optionsUrl);
  const excluded = options.getByRole("region", { name: "Excluded from suggestions" });
  await expect(excluded).toContainText("docs.test");
  await excluded.getByRole("button", { name: "Remove docs.test" }).click();
  await page.reload();
  await expect(frequent(page).getByRole("link", { name: "Docs C" })).toBeVisible();
  await context.close();
});

test("saved tabs close only after storage confirms", async () => {
  const context = await launch(newProfileDir());
  const first = await context.newPage();
  await first.goto("https://example.com/");
  const second = await context.newPage();
  await second.goto("https://developer.chrome.com/docs");

  // A failed write shows the error and no close action.
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await popup.evaluate(() => {
    chrome.storage.local.set = (async () => {
      throw new Error("quota");
    }) as typeof chrome.storage.local.set;
  });
  await popup.getByRole("checkbox", { name: "Stub" }).first().check();
  await popup.getByRole("button", { name: "Save 1 tab" }).click();
  await expect(popup.getByRole("alert")).toHaveText("Couldn’t save, so no tabs will be closed.");
  await expect(popup.getByRole("button", { name: /Close/ })).toHaveCount(0);
  expect(first.isClosed()).toBe(false);

  // A successful write offers to close exactly the saved tabs.
  await popup.reload();
  for (const box of await popup.getByRole("checkbox", { name: "Stub" }).all()) await box.check();
  await popup.getByRole("button", { name: "Save 2 tabs" }).click();
  await expect(popup.getByRole("status")).toHaveText("Saved to Continue later");
  await popup.getByRole("button", { name: "Close these 2 tabs" }).click();
  await expect.poll(() => first.isClosed() && second.isClosed()).toBe(true);

  // The new tab page shows them as one row; opening one removes it.
  const page = await context.newPage();
  await page.goto(newTabUrl);
  await later(page)
    .getByRole("button", { name: /^2 tabs/ })
    .click();
  await expect(later(page).getByRole("link", { name: "Stub" })).toHaveCount(2);
  await later(page).getByRole("button", { name: "Remove 2 tabs" }).click();
  await expect(later(page)).toContainText("Save open tabs here");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(later(page).getByRole("button", { name: /^2 tabs/ })).toBeVisible();

  // Saved tabs are searchable, and recently closed tabs can be restored.
  await page.getByRole("combobox", { name: "Search" }).fill("stub");
  await expect(page.getByRole("option").first()).toContainText("Continue later");
  await page.getByRole("combobox", { name: "Search" }).fill("");
  await page.getByRole("button", { name: /^Recently closed \d+$/ }).click();
  const drawer = page.getByRole("dialog", { name: "Recently closed" });
  await expect(drawer.getByRole("button", { name: /Stub/ }).first()).toBeVisible();
  const restored = context.waitForEvent("page");
  await drawer.getByRole("button", { name: /Stub/ }).first().click();
  expect((await restored).url()).toMatch(/example\.com|developer\.chrome\.com/);
  await context.close();
});

test("bookmark folders import as groups", async () => {
  const context = await launch(newProfileDir());
  const options = await context.newPage();
  await options.goto(optionsUrl);
  await options.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: "1", title: "Reading" });
    await chrome.bookmarks.create({
      parentId: folder.id,
      title: "Example",
      url: "https://example.com/",
    });
    await chrome.bookmarks.create({ parentId: folder.id, title: "Bad", url: "javascript:void 0" });
  });
  await options.getByRole("button", { name: "Choose folders…" }).click();
  await expect(options.getByRole("checkbox", { name: /Reading/ })).toBeChecked();
  await options.getByRole("button", { name: /^Import \d folders$/ }).click();
  await expect(options.getByRole("status")).toContainText("Merged: 1 new links");

  const page = await context.newPage();
  await page.goto(newTabUrl);
  await expect(pinned(page).getByRole("heading", { name: "Reading" })).toBeVisible();
  await expect(pinned(page).getByRole("link", { name: "Example" })).toBeVisible();
  await context.close();
});
