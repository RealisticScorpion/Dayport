// Captures 1280×800 Chrome Web Store screenshots with synthetic data.
// Usage: npm run build:e2e && node scripts/store-screenshots.mjs [en|zh-CN]
// The e2e build has the optional permissions granted, so frequent pages show;
// their contents are stubbed so no real browsing data appears.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = realpathSync(join(root, ".output-e2e/chrome-mv3"));
const extensionId = createHash("sha256")
  .update(extensionPath)
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
const language = process.argv[2] === "zh-CN" ? "zh-CN" : "en";
const outDir = join(root, "assets/store", language);
mkdirSync(outDir, { recursive: true });

const L = (title, url) => ({ id: crypto.randomUUID(), title, url });
const groups =
  language === "zh-CN"
    ? [
        {
          name: "工作",
          links: [
            L("GitHub", "https://github.com"),
            L("Linear", "https://linear.app"),
            L("Figma", "https://figma.com"),
            L("Notion", "https://notion.so"),
            L("飞书", "https://feishu.cn"),
            L("Vercel", "https://vercel.com"),
          ],
        },
        {
          name: "开发文档",
          links: [
            L("MDN", "https://developer.mozilla.org"),
            L("Chrome 扩展", "https://developer.chrome.com/docs/extensions"),
            L("React", "https://react.dev"),
            L("TypeScript", "https://www.typescriptlang.org"),
            L("Vite", "https://vite.dev"),
          ],
        },
        {
          name: "阅读",
          links: [
            L("微信读书", "https://weread.qq.com"),
            L("Hacker News", "https://news.ycombinator.com"),
            L("少数派", "https://sspai.com"),
            L("arXiv", "https://arxiv.org"),
          ],
        },
        {
          name: "工具",
          links: [
            L("Google 翻译", "https://translate.google.com"),
            L("Excalidraw", "https://excalidraw.com"),
            L("regex101", "https://regex101.com"),
            L("Squoosh", "https://squoosh.app"),
          ],
        },
        {
          name: "生活",
          links: [
            L("高德地图", "https://amap.com"),
            L("哔哩哔哩", "https://bilibili.com"),
            L("豆瓣", "https://douban.com"),
          ],
        },
      ]
    : [
        {
          name: "Work",
          links: [
            L("GitHub", "https://github.com"),
            L("Linear", "https://linear.app"),
            L("Figma", "https://figma.com"),
            L("Notion", "https://notion.so"),
            L("Slack", "https://slack.com"),
            L("Vercel", "https://vercel.com"),
          ],
        },
        {
          name: "Docs",
          links: [
            L("MDN", "https://developer.mozilla.org"),
            L("Chrome extensions", "https://developer.chrome.com/docs/extensions"),
            L("React", "https://react.dev"),
            L("TypeScript", "https://www.typescriptlang.org"),
            L("Vite", "https://vite.dev"),
          ],
        },
        {
          name: "Reading",
          links: [
            L("Hacker News", "https://news.ycombinator.com"),
            L("The Verge", "https://theverge.com"),
            L("arXiv", "https://arxiv.org"),
            L("Wikipedia", "https://wikipedia.org"),
          ],
        },
        {
          name: "Tools",
          links: [
            L("Google Translate", "https://translate.google.com"),
            L("Excalidraw", "https://excalidraw.com"),
            L("regex101", "https://regex101.com"),
            L("Squoosh", "https://squoosh.app"),
          ],
        },
        {
          name: "Life",
          links: [
            L("Maps", "https://maps.google.com"),
            L("YouTube", "https://youtube.com"),
            L("Spotify", "https://spotify.com"),
          ],
        },
      ];

const topSites =
  language === "zh-CN"
    ? [
        { url: "https://www.zhihu.com/", title: "知乎" },
        { url: "https://docs.python.org/3/library/", title: "Python 标准库" },
        { url: "https://docs.python.org/3/tutorial/", title: "Python 教程" },
        { url: "https://www.yuque.com/", title: "语雀" },
        { url: "https://mail.qq.com/", title: "QQ 邮箱" },
      ]
    : [
        { url: "https://mail.google.com/", title: "Gmail" },
        { url: "https://docs.python.org/3/library/", title: "Python Library Reference" },
        { url: "https://docs.python.org/3/tutorial/", title: "Python Tutorial" },
        { url: "https://calendar.google.com/", title: "Calendar" },
        { url: "https://stackoverflow.com/", title: "Stack Overflow" },
      ];
const laterTitles =
  language === "zh-CN"
    ? ["一篇关于排版的长文", "季度计划草稿", "发布检查清单", "竞品调研笔记"]
    : ["A long read on typography", "Quarterly plan draft", "Release checklist", "Research notes"];

const context = await chromium.launchPersistentContext(
  mkdtempSync(join(tmpdir(), "dayport-shots-")),
  {
    channel: "chromium",
    locale: language,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      `--lang=${language}`,
    ],
  },
);
await context.addInitScript((sites) => {
  if (!globalThis.chrome?.topSites) return;
  chrome.topSites.get = async () => sites;
  chrome.history.search = async () => [];
}, topSites);
const page = await context.newPage();
const url = `chrome-extension://${extensionId}/newtab.html`;
await page.goto(url);

async function seed(settings) {
  await page.evaluate(
    async ({ groups, settings, laterTitles }) => {
      const now = Date.now();
      const item = (title, i, ago, batch) => ({
        id: `l${i}`,
        url: `https://example.com/${i}`,
        title,
        savedAt: now - ago,
        batch,
      });
      await chrome.storage.local.set({
        "dayport-later": {
          version: 1,
          items: [
            item(laterTitles[0], 0, 2 * 3600e3, "a"),
            item(laterTitles[1], 1, 2 * 86400e3, "b"),
            item(laterTitles[2], 2, 2 * 86400e3, "b"),
            item(laterTitles[3], 3, 2 * 86400e3, "b"),
          ],
        },
        dayport: {
          version: 1,
          updatedAt: Date.now(),
          groups: groups.map((group) => ({ ...group, id: crypto.randomUUID() })),
          settings: {
            theme: "light",
            density: "comfortable",
            favicons: "quiet",
            timeTint: false,
            language: "auto",
            singleKeyShortcuts: true,
            ...settings,
          },
        },
      });
    },
    { groups, settings, laterTitles },
  );
  await page.reload();
  await page.waitForTimeout(800);
}

await seed({});
await page.screenshot({ path: join(outDir, "1-light.png") });

await page.keyboard.press("/");
await page.keyboard.type(language === "zh-CN" ? "re" : "re");
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "2-search.png") });
await page.keyboard.press("Escape");

await page
  .getByRole("button", { name: language === "zh-CN" ? "编辑" : "Edit", exact: true })
  .click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "3-edit.png") });
await page.getByRole("button", { name: language === "zh-CN" ? "完成" : "Done" }).click();

await seed({ theme: "dark" });
await page.getByRole("button", { name: language === "zh-CN" ? "设置" : "Settings" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "4-dark-settings.png") });

await context.close();
console.log(`Wrote screenshots to ${outDir}`);
