import { chromium, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const extensionPath = realpathSync(join(import.meta.dirname, "../.output/chrome-mv3"));

if (!existsSync(join(extensionPath, "manifest.json"))) {
  throw new Error("Build the extension first: npm run build");
}

/** Chrome derives an unpacked extension's id from the SHA-256 of its absolute path. */
export const extensionId = createHash("sha256")
  .update(extensionPath)
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));

export const newTabUrl = `chrome-extension://${extensionId}/newtab.html`;
export const optionsUrl = `chrome-extension://${extensionId}/options.html`;

export function newProfileDir(): string {
  return mkdtempSync(join(tmpdir(), "dayport-e2e-"));
}

/** Launches Chromium with the built extension, as a fresh browser session on `profileDir`. */
export async function launch(profileDir: string): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    locale: "en-US",
    acceptDownloads: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--lang=en-US",
    ],
  });
  // Destinations are stubbed so tests never depend on the network.
  await context.route(/^https:\/\/(example\.com|developer\.chrome\.com)\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Stub</title><p>stub</p>" }),
  );
  return context;
}
