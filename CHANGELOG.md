# Changelog

Notable project changes will be recorded here.

## Unreleased

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

First preview release, submitted to the Chrome Web Store for review.

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
