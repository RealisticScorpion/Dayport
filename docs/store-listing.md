# Chrome Web Store listing

Source of truth for the Chrome Web Store submission. Update it with each release whose permissions, data use, or features change.

## Package

- Build: `npm ci && npm run zip` produces `.output/dayport-<version>-chrome.zip`.
- Version: `package.json` `version` (currently 0.1.0).
- Icon: `public/icon/128.png` (from `assets/icon.svg`).
- Screenshots (1280×800): `assets/store/en/` and `assets/store/zh-CN/`, regenerated with `node scripts/store-screenshots.mjs en|zh-CN` after `npm run build`. They contain only synthetic data.

## Store listing

- **Category:** Productivity → Workflow & planning
- **Language:** English (default), Chinese (Simplified)

**Name** (from `_locales`): Dayport — New Tab / Dayport 新标签页

**Summary** (from `_locales`, ≤132 characters):

- en: A quiet, local-first new tab page for your everyday links. Fast keyboard search, no account, no tracking.
- zh_CN: 安静、本地优先的新标签页，整理每天常用的链接。键盘快速搜索，无需账号，不做追踪。

**Description (en):**

> Dayport replaces Chrome's new tab page with a calm, text-first index of the links you use every day.
>
> • Grouped links you control: add, rename, reorder by drag or with the keyboard, and undo mistakes.
> • Find any saved link in a keystroke: press / and type, then Enter.
> • Light and dark themes, comfortable or compact density, and quiet monochrome icons that light up on hover.
> • Back up and restore your links with a versioned file. Imports are previewed and validated before anything changes.
> • English and Simplified Chinese.
>
> Private by design: your links and settings stay in this browser. Dayport has no account, no analytics, and no server, and it makes no network requests of its own. Site icons come from Chrome's local cache.
>
> Open source under the MIT license: https://github.com/RealisticScorpion/Dayport

**Description (zh_CN):**

> Dayport 用一页安静、以文字为主的索引，替换 Chrome 的新标签页，放你每天都要打开的链接。
>
> • 自己管理的分组链接：添加、改名、拖动或用键盘排序，误删可以撤销。
> • 一键找到已保存的链接：按 / 输入，回车打开。
> • 浅色和深色主题、舒适或紧凑密度，图标平时是安静的灰度，悬停时才显示颜色。
> • 用带版本号的文件备份和恢复链接，导入前会先预览和校验，确认后才会改动。
> • 支持简体中文和英文。
>
> 隐私优先：链接和设置只保存在这个浏览器里。没有账号、没有统计、没有服务器，自身不发起任何网络请求。网站图标来自 Chrome 的本地缓存。
>
> 基于 MIT 许可证开源：https://github.com/RealisticScorpion/Dayport

## Privacy practices tab

- **Single purpose:** Replace the new tab page with a personal, keyboard-friendly index of the user's saved links.
- **Permission justification:**
  - `storage`: Saves the user's link groups and settings locally in `chrome.storage.local`.
  - `favicon`: Shows each saved site's icon from Chrome's local favicon cache instead of requesting icons from a remote service.
  - `activeTab` (from 0.2.0): Lets the toolbar button and the "Continue later" page menu read the address and title of the tab they were used on, so the user can save it.
  - `contextMenus` (from 0.2.0): Adds the "Continue later" item to the page context menu.
  - Optional, requested only when the user enables the feature (from 0.2.0): `topSites` (frequent pages), `history` (pages revisited on several days, analyzed on the device), `bookmarks` (bookmark folder import), `sessions` and `tabs` (recently closed tabs and the titles of tabs the user chooses to save).
  - New tab override (`chrome_url_overrides.newtab`): The extension's single purpose is the new tab page.
- **Remote code:** No. All JavaScript, CSS, and fonts are bundled in the package.
- **Data usage:** The extension does not collect or transmit any user data. Leave every data type unchecked and certify the three disclosures (not sold, not used for unrelated purposes, not used for creditworthiness).
- **Privacy policy URL:** https://github.com/RealisticScorpion/Dayport/blob/main/docs/privacy.md

## Distribution

- **Visibility:** Public, or Unlisted for a first preview (decide at submission).
- **Regions:** All regions.
- **Pricing:** Free.
