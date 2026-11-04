# Changelog

Notable project changes will be recorded here.

## Unreleased

### Added

- World clocks: up to 8 cities, four shown at the top right; a comparison popover lines cities up on a 24-hour strip, with UTC offsets for the chosen date and "Tomorrow" / "Yesterday" labels. Daylight saving follows the browser's time-zone data.
- One autosaved note in a tool column, with an expanded editor, Markdown export, and a "Load latest / Keep mine" prompt when another tab changed it. Notes can be included in backups.
- Weather from Open-Meteo for one chosen city: current conditions, feels-like temperature, rain chance, and a four-day forecast, in °C or °F. Results are cached; a refresh runs after 30 minutes, a failed refresh keeps the last result marked "Cached", and nothing is requested until a city is chosen.
- Background images from local files (kept in IndexedDB, with a focal point per image), a list of image links, or a [JSON source](docs/background-source.md). Rotation on each tab, hourly, daily, or manually; a corner control shows credit, Skip, and Pause. Broken images fall through to the next, and the last image that loaded stays as a fallback. Text sits on adjustable veils that keep secondary text at 4.5:1 contrast.
- Search modes: saved links, web (Chrome's default engine), ChatGPT, and Claude, switched with Alt+1 to Alt+4. AI modes copy a multi-line draft and open the service; no saved link match lets Enter search the web.

### Changed

- Adds the required `search` permission, which has no install warning.
- Reset on the options page also clears the note, tabs saved for later, and suggestion preferences.

## 0.2.0 — 2026-11-04

Milestone 2: rediscover and continue.

### Added

- Frequent pages from Chrome's top sites, with optional local history analysis for pages revisited on three or more days in two weeks. Pages group by domain; pin to a group, dismiss, or exclude a domain, each with Undo.
- Continue later: a toolbar popup saves chosen tabs and offers to close them only after the save is confirmed; a page context menu saves the current page. Saved tabs appear on the new tab page, grouped by save, and in search.
- Recently closed tabs and windows in a footer drawer, restorable in one click.
- Bookmark import on the options page: chosen folders become groups, previewed and merged without duplicates.
- Options page sections for optional permissions (enable or revoke) and excluded domains.
- Settings to hide the frequent, continue later, and recently closed sections.

### Changed

- Required permissions add `activeTab` and `contextMenus`; `topSites`, `history`, `bookmarks`, `sessions`, and `tabs` are optional and requested only when a feature is enabled.
- End-to-end tests run against a separate build (`npm run build:e2e`) that grants optional permissions up front.

### Fixed

- Esc closes drawers even after the focused control inside them disappears.

## 0.1.0 — 2026-11-03

First preview release, published on the Chrome Web Store.

### Added

- Manifest V3 new tab extension built with WXT, React, and TypeScript; requires Chrome 120 or newer.
- Grouped links with add, edit, delete, drag-and-drop and keyboard reordering, and Undo.
- Local search over saved links, `/` to focus search, and arrow-key navigation between links.
- Settings drawer for theme, density, icon style, time-of-day tint, language (English and Simplified Chinese), and shortcuts.
- Options page with versioned backup export, validated import preview, merge or replace (with an automatic backup), and local reset.
- Local persistence with surfaced save failures and live sync between open new tab pages.
- Unit tests for data, search, migration, and import; Playwright tests for the Milestone 1 acceptance flow.

- English and Simplified Chinese project introductions.
- Product design, proposed architecture, roadmap, and privacy design.
- MIT license, contribution guide, code of conduct, and security reporting policy.
- Bug and feature request forms, pull request template, formatting checks, and dependency update configuration.
