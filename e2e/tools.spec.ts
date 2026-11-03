import { expect, test, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { launch, newProfileDir, newTabUrl } from "./extension";

// Milestone 3a: world clocks, the autosaved note, and search modes. Remote
// destinations are stubbed so no test depends on the network.

async function stubDestinations(context: BrowserContext) {
  await context.route(/^https:\/\/(www\.google\.com|chatgpt\.com|claude\.ai)\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Stub</title>" }),
  );
}

test("clocks show and compare times across zones", async () => {
  const context = await launch(newProfileDir());
  const page = await context.newPage();
  await page.goto(newTabUrl);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "+ Add a city" }).click();
  await page.getByLabel("City or time zone").fill("tokyo");
  await page.keyboard.press("Enter");
  await page.getByLabel("City or time zone").fill("new york");
  await page.getByRole("listitem").filter({ hasText: "New York" }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  const clocks = page.getByRole("button", { name: /Tokyo \d\d:\d\d New York \d\d:\d\d/ });
  await expect(clocks).toBeVisible();
  await clocks.click();
  const compare = page.getByRole("dialog", { name: "Compare times" });
  await expect(compare).toContainText("UTC+9");
  await expect(compare).toContainText(/UTC−[45]/);

  // Arrow keys move the shared reference time in 30-minute steps.
  const slider = compare.getByRole("slider");
  const before = await slider.getAttribute("aria-valuetext");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const after = await slider.getAttribute("aria-valuetext");
  const minutes = (text: string | null) => {
    const [, h, m] = /(\d\d):(\d\d)/.exec(text ?? "")!;
    return Number(h) * 60 + Number(m);
  };
  expect((minutes(after) - minutes(before) + 1440) % 1440).toBe(60);
  await page.keyboard.press("Escape");
  await expect(compare).toHaveCount(0);

  // Clocks persist.
  await page.reload();
  await expect(page.getByRole("button", { name: /Tokyo/ })).toBeVisible();
  await context.close();
});

test("the note autosaves and never silently overwrites another tab", async () => {
  const context = await launch(newProfileDir());
  const first = await context.newPage();
  await first.goto(newTabUrl);
  const firstNote = first.getByRole("textbox", { name: "Note" });
  await firstNote.fill("Buy stamps");
  await expect(first.getByText("Saved")).toBeVisible();

  const second = await context.newPage();
  await second.goto(newTabUrl);
  const secondNote = second.getByRole("textbox", { name: "Note" });
  await expect(secondNote).toHaveValue("Buy stamps");

  // Unsaved typing in the second tab, while the first tab saves a change.
  await second.evaluate(() => {
    // Hold autosave long enough for the other tab's write to land first.
    window.setTimeout = ((fn: () => void, ms?: number) =>
      globalThis.setInterval(fn, (ms ?? 0) + 60_000)) as typeof window.setTimeout;
  });
  await secondNote.pressSequentially(" and envelopes");
  await firstNote.fill("Buy stamps today");
  await expect(first.getByText("Saved")).toBeVisible();
  await expect(second.getByRole("alert")).toContainText("This note was changed in another tab.");
  await second.getByRole("button", { name: "Keep mine" }).click();
  await expect(first.getByRole("textbox", { name: "Note" })).toHaveValue(
    "Buy stamps and envelopes",
  );

  // Export as Markdown.
  const download = first.waitForEvent("download");
  await first.getByRole("button", { name: "Note actions" }).click();
  await first.getByRole("menuitem", { name: "Export as Markdown" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^dayport-note-\d{4}-\d{2}-\d{2}\.md$/);
  expect(readFileSync(await file.path(), "utf8")).toBe("Buy stamps and envelopes");
  await context.close();
});

test("search modes reach the web and AI services", async () => {
  const context = await launch(newProfileDir());
  await stubDestinations(context);
  await context.addInitScript(() => {
    navigator.clipboard.writeText = async (text: string) => {
      (window as unknown as { copied: string }).copied = text;
    };
  });
  const page = await context.newPage();
  await page.goto(newTabUrl);

  // Claude mode: Shift+Enter adds a line; Ctrl+Enter copies and opens a background tab.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Alt+4");
  const draft = page.getByRole("textbox", { name: "Search" });
  await expect(draft).toBeFocused();
  await page.keyboard.type("First line");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("Second line");
  const opened = context.waitForEvent("page");
  await page.keyboard.press("ControlOrMeta+Enter");
  expect((await opened).url()).toContain("claude.ai/new");
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    "First line\nSecond line",
  );
  await expect(page.getByRole("status")).toContainText("Copied. Paste it into Claude.");

  // Switching to a single-line mode keeps the words apart.
  await page.keyboard.press("Alt+1");
  await expect(page.getByRole("combobox", { name: "Search" })).toHaveValue(
    "First line Second line",
  );

  // No saved link matches, so Enter searches the web with Chrome's default engine.
  await page.getByRole("combobox", { name: "Search" }).fill("dayport new tab");
  await expect(page.getByText("No saved link matches · Enter searches the web")).toBeVisible();
  await page.keyboard.press("Enter");
  await page.waitForURL(/google\.com\/search\?.*q=dayport/);

  // ChatGPT mode opens in the current tab.
  await page.goto(newTabUrl);
  await page.getByRole("button", { name: "ChatGPT" }).click();
  await page.keyboard.type("Hello");
  await page.keyboard.press("Enter");
  await page.waitForURL("https://chatgpt.com/");
  await context.close();
});
