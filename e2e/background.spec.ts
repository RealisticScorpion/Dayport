import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launch, newProfileDir, newTabUrl, optionsUrl } from "./extension";

// Milestone 3b backgrounds: link lists, a JSON source, and local images,
// with fallback past broken images and the corner control. Image hosts are stubbed.

const png = readFileSync(join(import.meta.dirname, "../public/icon/48.png"));

async function stubImages(context: BrowserContext) {
  await context.route(/^https:\/\/img\.test\//, (route) =>
    route.request().url().includes("broken")
      ? route.fulfill({ status: 404, body: "" })
      : route.fulfill({ contentType: "image/png", body: png }),
  );
  await context.route("https://json.test/images.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        images: [
          { url: "https://img.test/j1.png", credit: "Ana Example", link: "https://ana.test/" },
          { url: "https://img.test/j2.png" },
          { url: "javascript:alert(1)" },
        ],
      }),
    }),
  );
}

async function chooseSource(page: Page, name: string) {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("group", { name: "Background" }).getByRole("button", { name }).click();
  await page.keyboard.press("Escape");
}

const shownImage = (page: Page) => page.locator(".bg-image.shown, .bg-layer .bg-image:only-child");

test("image links rotate, skip broken images, and keep text on veils", async () => {
  const context = await launch(newProfileDir());
  await stubImages(context);
  const options = await context.newPage();
  await options.goto(`${optionsUrl}#background`);
  await options
    .getByRole("textbox", { name: "Image links" })
    .fill(
      "https://img.test/broken.png\nhttp://img.test/insecure.png\nhttps://img.test/b.png\nhttps://img.test/c.png",
    );
  await options.getByRole("button", { name: "Save", exact: true }).click();
  await expect(options.getByRole("status")).toHaveText("Saved 3 images; skipped 1.");

  const page = await context.newPage();
  await page.goto(newTabUrl);
  await expect(page.locator("html")).toHaveAttribute("data-bg", "off");
  await chooseSource(page, "Links");

  // The first image is broken, so the next one shows instead.
  await expect(page.locator("html")).toHaveAttribute("data-bg", "on");
  await expect(page.locator(".bg-image").last()).toHaveAttribute("src", "https://img.test/b.png");

  // Skip moves on; pause holds the image across new tabs.
  await page.getByRole("button", { name: "Next image" }).click();
  await expect(page.locator(".bg-image").last()).toHaveAttribute("src", "https://img.test/c.png");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(page.locator(".bg-image").last()).toHaveAttribute("src", "https://img.test/c.png");
  await context.close();
});

test("a JSON source is validated and credited", async () => {
  const context = await launch(newProfileDir());
  await stubImages(context);
  const options = await context.newPage();
  await options.goto(`${optionsUrl}#background`);
  await options.getByRole("textbox", { name: "JSON source" }).fill("https://json.test/images.json");
  await options.getByRole("button", { name: "Allow and test" }).click();
  await expect(options.getByRole("status")).toHaveText("Found 2 images.");

  const page = await context.newPage();
  await page.goto(newTabUrl);
  await chooseSource(page, "JSON");
  await expect(page.locator("html")).toHaveAttribute("data-bg", "on");
  await expect(page.getByRole("link", { name: "Ana Example" })).toHaveAttribute(
    "href",
    "https://ana.test/",
  );
  await context.close();
});

test("local images stay on the device and keep their focal point", async () => {
  const context = await launch(newProfileDir());
  const options = await context.newPage();
  await options.goto(`${optionsUrl}#background`);
  await options.getByLabel("Add images…").setInputFiles([
    { name: "dunes.png", mimeType: "image/png", buffer: png },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") },
  ]);
  await expect(options.getByRole("alert")).toHaveText("notes.txt isn’t an image and was skipped.");
  const thumb = options.getByRole("button", { name: "dunes.png", exact: true });
  const box = (await thumb.boundingBox())!;
  await thumb.click({ position: { x: box.width * 0.25, y: box.height * 0.75 } });

  const page = await context.newPage();
  await page.goto(newTabUrl);
  await chooseSource(page, "Photos");
  const image = page.locator(".bg-image").last();
  await expect(image).toHaveAttribute("src", /^blob:chrome-extension:/);
  await expect(image).toHaveCSS("object-position", "25% 75%");
  await context.close();
});
