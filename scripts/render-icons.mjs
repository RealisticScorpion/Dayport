// Renders assets/icon.svg to the PNG sizes Chrome needs (public/icon/*.png).
// Run after changing the icon: node scripts/render-icons.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "assets/icon.svg"), "utf8");

const browser = await chromium.launch({ channel: "chromium" });
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: join(root, `public/icon/${size}.png`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log("Wrote public/icon/{16,32,48,128}.png");
