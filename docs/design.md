# Product design

Status: proposed design. No application features are implemented yet.

## Purpose

Dayport is a Chrome new tab extension for quickly opening useful pages, rediscovering recurring destinations, and returning to unfinished browsing with fewer tabs left open.

## Layout

The page reads top to bottom in three tiers of decreasing emphasis. Only one element, the search field, competes for first attention; everything else is quiet until used.

| Tier      | Content                                                                       | Treatment                                                    |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Masthead  | Date on the left; world clocks as one inline text line on the right; settings | Display type for the date, small tabular figures for clocks  |
| Focus     | Search with an inline mode switch (local, web, ChatGPT, Claude)               | The widest, highest-contrast element on the page             |
| Workspace | Navigation (pinned, frequent, continue later) beside a narrow tool column     | Text-first lists separated by space and hairlines, not boxes |

A single footer line ("Recently closed 12") opens recently closed tabs and windows as a drawer. Multi-tab saves live in Continue later as group rows, so there is no separate tab-group area. Background controls live in settings and in a hover-revealed control at the page corner, not in the masthead.

On a 12-column grid, navigation spans 8 columns (about 67%) and tools span 4. Below 1024 px of content width, tools move under navigation as a row; below 720 px, every section stacks and tools start collapsed. The threshold is set so that common 13–14 inch laptop windows keep the side column. The grid must survive 200% browser zoom without horizontal scrolling.

Pinned groups flow as columns, like the index of a book: a short group heading, then one link per row with a 16 px favicon and a short label. Frequent pages follow as a separate, visibly automatic group (secondary ink, an "auto" tag, no drag handles) so they never read as user-owned. Continue-later items show their saved date. Aim to accommodate 60–100 links on suitable desktop screens without making small screens or keyboard navigation unusable.

## Visual design

Direction: quiet typography. Dayport should feel like a well-set index page rather than a dashboard: text and spacing carry the structure, color is rare, and decoration is absent. The name suggests a harbor at the start of the day, so the one expressive gesture is light: the page ground can shift subtly with the time of day.

### Principles

- **One focal point.** Search is the only element with strong contrast at rest. Everything else uses secondary ink until hovered or focused.
- **Space before lines, lines before boxes.** Separate groups with whitespace first, a 1 px hairline second, and a filled surface only for overlays and drawers. No card borders around every widget.
- **Quiet by default, vivid on intent.** Favicons render desaturated and dimmed at rest and in full color on hover or keyboard focus, so 100 brand colors do not compete. A setting restores full-color favicons.
- **Accent means action.** The single accent color is reserved for focus rings, the active search mode, and primary buttons. It is never used for decoration or group headings.
- **Calm motion.** Only state changes animate (hover, drawer, mode switch), at 120–180 ms ease-out. No entrance animations, parallax, or looping effects. `prefers-reduced-motion` removes all transitions.

### Typography

Fonts are bundled with the extension; no remote font requests. Source Han Serif SC ships as its Noto Serif SC build in regular weight only, split into WOFF2 unicode-range chunks (about 5 MB in total), so the browser loads only the chunks that the visible text needs. This works for arbitrary highlight text, not just the date. CJK serifs have no true italic, so highlights stay upright.

| Role            | Family                                           | Size / line height | Notes                                      |
| --------------- | ------------------------------------------------ | ------------------ | ------------------------------------------ |
| Date display    | Source Han Serif SC (思源宋体), regular          | 28 / 34            | The only serif in the chrome               |
| Search input    | IBM Plex Sans                                    | 17 / 24            |                                            |
| Body, notes     | IBM Plex Sans                                    | 14 / 22            |                                            |
| Links           | IBM Plex Sans                                    | 13 / row height    | Single line, ellipsis after about 18 chars |
| Group headings  | IBM Plex Sans, medium                            | 12 / 16            | Secondary ink; no uppercase or tracking    |
| Meta and clocks | IBM Plex Sans with tabular figures               | 12 / 16            | `font-variant-numeric: tabular-nums`       |
| Highlights      | Source Han Serif SC (思源宋体), regular, upright | 15 / 24            | Reading excerpts only                      |

Chinese text falls back to system CJK fonts (PingFang SC, Microsoft YaHei, Noto Sans CJK SC). Headings avoid uppercase and letter spacing so they behave the same in Chinese and English.

### Color

Two themes follow the system setting, with a manual override. Every text color below passes WCAG AA (4.5:1) on every ground listed; values were checked with the WCAG relative-luminance formula.

| Token       | Light     | Dark       | Use                                 |
| ----------- | --------- | ---------- | ----------------------------------- |
| `ground`    | `#F3F4F1` | `#121417`  | Page background                     |
| `surface`   | `#FBFBFA` | `#1A1D21`  | Search field, drawer, menus         |
| `ink`       | `#1C1F22` | `#E6E7E4`  | Links, primary text                 |
| `ink-muted` | `#4F555B` | `#A9AEB3`  | Group headings, widget body         |
| `ink-faint` | `#646A70` | `#8E949A`  | Meta, clocks, automatic labels      |
| `accent`    | `#1F5E7A` | `#86B7D3`  | Focus, active mode, primary action  |
| `danger`    | `#9F3A2C` | `#F0A090`  | Errors and destructive actions only |
| `hairline`  | ink at 8% | ink at 10% | Dividers only; not for text         |

Time-of-day tint (optional, on by default in light theme) changes only `ground`: dawn `#F6F3EE`, day `#F3F4F1`, dusk `#F1F0F2`. It switches on page open, never animates while the page is visible, and never changes text colors.

### Spacing, shape, and density

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px. Gutters between link group columns are 32 px; navigation and tools are 48 px apart; tiers are separated by 48 px.
- Radius: 6 px for controls, 10 px for the search field and overlays. Lists have no radius.
- Link row height: 26 px compact, 32 px comfortable. Hover shows a `surface` fill across the full row so the target is obvious and at least 26 px tall. Comfortable density is the default.
- Icons: 16 px stroke icons at 1.5 px weight, `currentColor`. No emoji and no illustrations.
- Favicons: read from Chrome's local favicon cache (the `favicon` permission and `_favicon` URL), never fetched from a remote service. A missing favicon falls back to a one-letter monogram in `ink-faint`.

### Backgrounds

Background images are off by default; the default ground is the tinted solid color. When an image is enabled, text never sits directly on it. The masthead gets an automatic scrim, and the search field, navigation, and tools sit on a `surface` veil at 86% opacity with a 24 px backdrop blur. A veil-strength control lets users trade image visibility for readability; its minimum must still meet 4.5:1 for `ink-muted`. The implemented range is 85–95%: at 85%, `ink-muted` measures 5.2:1 over a black image in light mode and 4.7:1 over a white image in dark mode. `ink-faint` cannot reach 4.5:1 on any usable veil, so meta text switches to `ink-muted` while a background shows.

### Empty and degraded states

The first-run page uses the same typography as a full page: the date, the search field, and a short line offering "Import bookmarks", "Add a link", or "Restore from backup". No illustrations or onboarding carousel. After the first link exists, the normal page replaces it. A widget without data or permission collapses to its heading plus one line explaining how to enable it.

### Language

The UI ships in Simplified Chinese and English, follows the browser language through `chrome.i18n`, and can be overridden in settings. Dates, weekdays, and times use `Intl` with the active locale. Source Han Serif includes Latin glyphs, so the date display keeps one typeface in both languages.

## Interaction design

### Keyboard and focus

Chrome keeps keyboard focus in the address bar when a new tab opens, and an extension page cannot reliably take it. The design therefore never depends on autofocus: typing in the address bar stays Chrome's default path, and Dayport's search is one keystroke or click away.

| Key                      | Action                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `/`                      | Focus search from anywhere on the page outside a text field                              |
| `Tab` / `Shift+Tab`      | Move between sections: masthead, search, pinned, frequent, continue later, tools, footer |
| Arrow keys               | Move within a section's link grid (one tab stop per section, roving focus)               |
| `Enter`                  | Open the focused link or result in the current tab                                       |
| `Ctrl+Enter` / `⌘+Enter` | Open in a background tab                                                                 |
| `Alt+1` to `Alt+4`       | Choose search mode: local, web, ChatGPT, Claude                                          |
| `Alt+↑` / `Alt+↓`        | In edit mode, move the focused link; `Alt+←` / `Alt+→` moves it between groups           |
| `Esc`                    | Close the open overlay, or clear search                                                  |

Clicking empty page space also focuses search. Settings lists every shortcut and can turn single-key shortcuts off.

### Search results

- Results open under the field on a `surface` overlay, at most 8 rows, grouped by source: saved links (pinned and continue later) first, then bookmarks and history when those permissions are granted. Notes and highlights are not searched in the first release.
- Matches are shown with medium weight, never with color. The first result is preselected; arrow keys move; `Enter` opens.
- No match shows one line: "No saved link matches · Enter searches the web".
- Web mode uses `chrome.search.query`, which follows the user's default search engine, so Dayport needs no engine setting.
- ChatGPT and Claude modes grow the field into a textarea of up to 6 lines. `Enter` copies the draft and opens the service; `Shift+Enter` adds a line. A toast confirms "Copied. Paste it into Claude." The draft is the entire payload; nothing else is appended.

### Editing navigation

- An **Edit** button sits at the right of the navigation section and opens edit mode. A bar at the top of the section reads "Editing · Drag to reorder" with a primary **Done** button.
- In edit mode, each link shows a drag handle in place of its favicon, an editable label, and a delete control. Each group heading becomes editable and ends with "+ Add link"; a final column offers "+ New group". Links can be dragged within and between groups, or moved with the keyboard shortcuts above.
- Adding a link opens an inline row with URL and name fields. The name defaults to the URL's host. Only `http`, `https`, and `chrome` schemes are accepted.
- Every change saves immediately. Deleting a link or group shows a toast with Undo instead of a confirmation dialog.
- Outside edit mode, a link's context menu offers open in new tab, edit, and delete for single changes.
- A group with more than 12 links shows the first 12 and a "N more" row that expands in place. Groups wrap into a new row of columns when they do not fit.

### Feedback

- Toasts appear at the bottom center on `surface`, with one optional action in `accent`. They dismiss after 6 seconds, pause while hovered or focused, and are announced through `aria-live="polite"`.
- Errors use `danger` text with an icon, stay until dismissed, are announced assertively, and always say what was kept: "Couldn't save. Your link is still here; retry."
- Reversible actions (delete, dismiss, exclude, remove from continue later) use Undo instead of confirmation. Confirmation dialogs are reserved for irreversible ones: replacing data on import, local reset, and clearing discovery data.
- Widgets with autosave show their status inline: "Saved", "Saving…", or "Couldn't save · Retry".

### Permissions

Optional features start as an inline row: one sentence on what the feature reads and why, plus an **Enable** button. Pressing it triggers Chrome's permission prompt. If the permission is granted, the content appears in place. If it is denied, the row reads "Not allowed. You can enable it again in settings." The rest of the page is unaffected. Dayport never requests a permission on page load.

### Settings

- The gear opens a 400 px drawer from the right, over the page. It closes with `Esc`, keeps focus inside, and applies changes immediately, with no Save button.
- Drawer sections: Appearance (theme, density, favicon color, time-of-day tint, background), Clocks, Weather, Search (AI services), Tools (show, hide, and order), and Shortcuts.
- Low-frequency and sensitive controls live on the extension options page, linked from the drawer: Data (import, export, local reset), Permissions (granted optional permissions with revoke), Excluded domains, and Privacy.

## Navigation behavior

| Collection     | Ownership                      | Update rule                                       |
| -------------- | ------------------------------ | ------------------------------------------------- |
| Pinned links   | User                           | Manual edits, import, ordering, and grouping      |
| Frequent pages | Browser data and local ranking | Refresh suggestions independently of pinned order |
| Continue later | User                           | Explicit save, restore, and removal               |

Start with browser top sites. An optional enhanced mode may analyze recent browser history locally to surface recurring deep links. Frequency, recency, and visits across distinct days are enough for the first ranking; a possible initial threshold is visits on three different days within two weeks. Validate thresholds with synthetic examples before treating them as settled behavior.

Group suggestions by domain, allow expanding to specific pages, and provide pin, dismiss, and exclude-domain actions. Exclusions must persist. Refreshing automatic suggestions must not rewrite manual pins or silently create bookmarks. Preserve meaningful URL paths and query parameters; do not blindly merge different documents on the same host.

Presentation: show at most 8 rows. A domain with several suggested pages appears as one row (favicon, domain, "3 pages", chevron) that expands in place; a domain with one page shows that page directly. Row actions appear on hover or focus: **Pin** opens a group picker, **Dismiss** hides that page, and **Exclude domain** (in the row's overflow menu) hides the whole domain. Each action shows a toast with Undo. Excluded domains are managed on the options page.

## Backgrounds

- Default: off. See [Visual design](#backgrounds) for readability rules.
- Sources: selected local images, explicit remote image URL lists, and a documented JSON image endpoint.
- Rotation: on opening a new tab, hourly, daily, or manually.
- Controls: source selection, skip, pause, crop, and readability overlay.
- Behavior: display the last successful cached image while fetching a replacement; retain it after failures.
- Scheduling: check elapsed time on open and wake; exact switching during device sleep is not promised.
- Corner control: when a background is on, a small control appears at the bottom-right corner on hover or keyboard focus. It shows the image credit and source link (required for remote providers), plus Skip, Pause or Resume, and a link to background settings.
- Framing: instead of a fixed crop, the user sets a focal point on each local image, applied as `object-position`, so the image adapts to any window shape.

Custom endpoint responses are data, never executable scripts. Define and validate the supported response shape when the source integration is implemented.

## Tools

| Tool              | Initial behavior                                                                 | Boundary                                                                            |
| ----------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| World clocks      | Selected cities, date offsets, and time comparison                               | Use time-zone-aware platform formatting, including daylight saving changes          |
| Search            | Find saved links; optionally search authorized browser data                      | Do not send local searches to a remote service                                      |
| AI launchpad      | Draft a question, copy it, and open the selected official service                | Do not assume automatic pasting, iframe support, or subscription-based API access   |
| Weather           | Current conditions, apparent temperature, rain probability, and a short forecast | Manual city selection first; location access optional                               |
| Notes             | One autosaved note with expand, edit, and export                                 | Preserve edits and surface storage errors                                           |
| WeRead highlights | Import personal excerpts with book, chapter, and note context                    | Verify actual import samples; automatic account sync is a separate feasibility task |

Tool presentation:

- **World clocks.** The masthead shows up to 4 cities; more collapse into "+2". Clicking the clock line opens a comparison popover with one row per city on a 24-hour strip and a shared reference time moved by dragging or by `←` / `→` in 30-minute steps. Each row shows its UTC offset for the chosen date, so daylight saving changes are visible. A city whose date differs from the local date is labeled "Tomorrow" or "Yesterday".
- **Weather.** The heading names the city and links to its setting. A meta line reads "Updated 08:30 · Data: [provider]" to satisfy provider attribution. Data older than 3 hours, or loaded while offline, is labeled "Cached". A failed refresh keeps the last result and its time. Units (°C/°F) are a setting.
- **Notes.** One note, deliberately, to keep concurrent editing simple. An Expand button opens a 720 px centered editor overlay. If another new tab page saves a newer version, a banner offers "Load latest" or "Keep mine" and never merges silently. Export as Markdown is in the note's overflow menu.
- **Highlights.** One excerpt with its book and chapter, and the user's own note below in `ink-muted`. A "Next" button rotates; "All" opens a drawer to browse and filter by book. Rotation is per open or daily. The empty state offers import.
- **Tool column.** Users can show, hide, and reorder tools in settings. Below 720 px, tools collapse to their headings.

Internal AI conversations would require a separately configured API integration. Do not send notes or browser history to an AI service without an explicit user action and a clear payload preview.

## Continue later

Offer to save a selected tab or group of tabs. Confirm durable storage and show the saved items before offering the close action. A failed save must leave the tabs open. Restoring a URL does not guarantee restoration of form input, page state, authentication, or scroll position. Closing is an explicit user action.

The new tab page cannot select other tabs, so saving starts from the toolbar popup or the page context menu ("Continue later"):

1. The popup lists the current window's tabs with checkboxes; the current tab and any highlighted tabs are preselected.
2. **Save N tabs** writes to storage. After the write is confirmed, the popup shows the saved items with a check mark and offers **Close these N tabs** or **Keep open**.
3. If the save fails, the popup shows the error and no close button.

On the new tab page, Continue later shows the 6 most recent entries with their saved date and "All N" to open the full list. Tabs saved together appear as one group row with a count that expands. Row actions are **Open**, which opens the tab and removes the entry with Undo, and **Remove**.

Without the optional `tabs` permission the popup sees only the tab its button was clicked on; "Choose other tabs in this window" requests `tabs` and then lists the rest. Pages that can never be saved, such as new tab pages, are not listed. The page context menu saves the current page in one step and marks the toolbar button with ✓ (or ! on failure) for three seconds; it never offers to close the tab.

Recently closed tabs and windows come from `chrome.sessions` and appear in the footer drawer once that permission is enabled. A closed window appears as "Window · 5 tabs" and restores as a whole.

## Data portability

Provide versioned import/export for user-created links, settings, notes, and highlights. Validate imports before changing existing data, show merge/replace choices, and provide a backup before replacement. Credentials and raw browsing history are excluded from default exports.

Both flows live on the options page:

- **Export.** Choose the content types (links, settings, notes, highlights). A notice explains that the file may contain sensitive notes and links. The file is named `dayport-backup-YYYY-MM-DD.json`.
- **Import.** Choose a file. Dayport validates it and shows a preview before changing anything, such as "42 links (5 already exist) · 3 notes · settings", and lists any rejected entries with reasons. **Merge** is the default. **Replace** first downloads an automatic backup and then asks for confirmation. An invalid file changes nothing and the error says why.
- **Bookmark import.** Choose bookmark folders from a tree; each folder becomes a group.

## Later candidates

Work/personal views, calculator and unit conversion within search, cross-device sync, and more background providers can follow the core browsing loop. See the [roadmap](roadmap.md) for sequencing.
