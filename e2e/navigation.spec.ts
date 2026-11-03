import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { launch, newProfileDir, newTabUrl, optionsUrl } from "./extension";

// Milestone 1 acceptance (docs/roadmap.md): create a group, save a link, reopen
// Chrome, find and open the link with the keyboard, then export and restore it
// without losing existing content after an invalid import.

async function addLink(page: Page, url: string, title: string) {
  await page.getByPlaceholder("URL · github.com").fill(url);
  await page.getByPlaceholder("Name (optional)").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test("M1 acceptance: create, persist, search, export, and restore", async () => {
  const profile = newProfileDir();
  let context = await launch(profile);
  let page = await context.newPage();
  await page.goto(newTabUrl);

  // First run: create the first group and links.
  await expect(
    page.getByRole("heading", { name: "Your everyday links will live here." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a link" }).click();
  await addLink(page, "example.com", "Example");
  await addLink(page, "https://developer.chrome.com/docs/extensions", "Chrome extensions");
  await page.keyboard.press("Escape");

  // Rename the group and add a second one.
  const groupName = page.getByLabel("Group name").first();
  await groupName.fill("Work");
  await groupName.press("Enter");
  await page.getByRole("button", { name: "+ New group" }).click();
  await page.keyboard.type("Docs");
  await page.keyboard.press("Enter");

  // Reorder with the keyboard: move "Chrome extensions" above "Example".
  await page.getByRole("button", { name: "Edit Chrome extensions" }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByRole("button", { name: /^Edit / }).first()).toHaveText(
    "Chrome extensions",
  );
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("heading", { name: "Work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Docs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example" })).toBeVisible();

  // Reopen Chrome on the same profile.
  await context.close();
  context = await launch(profile);
  page = await context.newPage();
  await page.goto(newTabUrl);
  await expect(page.getByRole("link", { name: "Example" })).toBeVisible();

  // Arrow keys move between links (one tab stop for the grid).
  await page.getByRole("link", { name: "Chrome extensions" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("link", { name: "Example" })).toBeFocused();

  // Find and open the link with the keyboard only.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  await expect(page.getByRole("combobox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("exa");
  await expect(page.getByRole("option", { name: /Example/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");
  await page.waitForURL("https://example.com/");

  // Export a backup from the options page.
  const options = await context.newPage();
  await options.goto(optionsUrl);
  const downloadPromise = options.waitForEvent("download");
  await options.getByRole("button", { name: /^Export dayport-backup-/ }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  const backup = readFileSync(backupPath, "utf8");
  expect(JSON.parse(backup)).toMatchObject({ format: "dayport-backup", version: 1 });

  // Delete a link, with Undo available.
  await page.goto(newTabUrl);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Delete Example" }).click();
  await expect(page.getByRole("status")).toContainText("Deleted “Example”");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("link", { name: "Example" })).toHaveCount(0);

  // An invalid import changes nothing.
  await options.reload();
  await options.getByLabel("Choose a backup file").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ not json"),
  });
  await expect(options.getByRole("alert")).toContainText("isn’t valid JSON. Nothing was changed.");
  await page.reload();
  await expect(page.getByRole("link", { name: "Chrome extensions" })).toBeVisible();

  // Restore the deleted link by merging the backup.
  await options.getByLabel("Choose a backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  await expect(options.getByText("2, 1 already saved")).toBeVisible();
  await options.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(options.getByRole("status")).toContainText("Merged: 1 new links");

  // The open new tab page picks up the change without a reload.
  await expect(page.getByRole("link", { name: "Example" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Chrome extensions" })).toBeVisible();

  await context.close();
});

test("undo restores a deleted link and settings apply immediately", async () => {
  const context = await launch(newProfileDir());
  const page = await context.newPage();
  await page.goto(newTabUrl);
  await page.getByRole("button", { name: "Add a link" }).click();
  await addLink(page, "example.com", "Example");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Delete Example" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Edit Example" })).toBeVisible();

  // Rejects unsafe URLs with an inline message.
  await page.getByRole("button", { name: "+ Add link" }).click();
  await page.getByPlaceholder("URL · github.com").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Only http, https, and chrome addresses are supported",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await context.close();
});
