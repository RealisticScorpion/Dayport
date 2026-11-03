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

A single footer line summarizes the expandable area ("Recently closed 12 · Tab groups 3") and opens it as a drawer. Background controls live in settings and in a hover-revealed control at the page corner, not in the masthead.

On a 12-column grid, navigation spans 8 columns (about 67%) and tools span 4. Below 1280 px of content width, tools move under navigation as a row; below 768 px, every section stacks and tools start collapsed. The grid must survive 200% browser zoom without horizontal scrolling.

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

Fonts are bundled with the extension; no remote font requests. Source Han Serif SC is large, so ship only the regular weight, subset to the characters the date and highlight styles need where practical, and fall back to Noto Serif CJK SC or Songti SC when it is unavailable. CJK serifs have no true italic, so highlights stay upright.

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

| Token       | Light     | Dark       | Use                                |
| ----------- | --------- | ---------- | ---------------------------------- |
| `ground`    | `#F3F4F1` | `#121417`  | Page background                    |
| `surface`   | `#FBFBFA` | `#1A1D21`  | Search field, drawer, menus        |
| `ink`       | `#1C1F22` | `#E6E7E4`  | Links, primary text                |
| `ink-muted` | `#4F555B` | `#A9AEB3`  | Group headings, widget body        |
| `ink-faint` | `#646A70` | `#8E949A`  | Meta, clocks, automatic labels     |
| `accent`    | `#1F5E7A` | `#86B7D3`  | Focus, active mode, primary action |
| `hairline`  | ink at 8% | ink at 10% | Dividers only; not for text        |

Time-of-day tint (optional, on by default in light theme) changes only `ground`: dawn `#F6F3EE`, day `#F3F4F1`, dusk `#F1F0F2`. It switches on page open, never animates while the page is visible, and never changes text colors.

### Spacing, shape, and density

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px. Gutters between columns are 32 px; tiers are separated by 48 px.
- Radius: 6 px for controls, 10 px for the search field and overlays. Lists have no radius.
- Link row height: 26 px compact, 32 px comfortable. Hover shows a `surface` fill across the full row so the target is obvious and at least 26 px tall. Comfortable density is the default.
- Icons: 16 px stroke icons at 1.5 px weight, `currentColor`. No emoji and no illustrations.
- Favicons: read from Chrome's local favicon cache (the `favicon` permission and `_favicon` URL), never fetched from a remote service. A missing favicon falls back to a one-letter monogram in `ink-faint`.

### Backgrounds

Background images are off by default; the default ground is the tinted solid color. When an image is enabled, text never sits directly on it. The masthead gets an automatic scrim, and the search field, navigation, and tools sit on a `surface` veil at 86% opacity with a 24 px backdrop blur. A veil-strength control lets users trade image visibility for readability; its minimum must still meet 4.5:1 for `ink-muted`.

### Empty and degraded states

The first-run page uses the same typography as a full page: the date, the search field, and a short line offering "Import bookmarks" or "Add a link". No illustrations or onboarding carousel. A widget without data or permission collapses to its heading plus one line explaining how to enable it.

## Navigation behavior

| Collection     | Ownership                      | Update rule                                       |
| -------------- | ------------------------------ | ------------------------------------------------- |
| Pinned links   | User                           | Manual edits, import, ordering, and grouping      |
| Frequent pages | Browser data and local ranking | Refresh suggestions independently of pinned order |
| Continue later | User                           | Explicit save, restore, and removal               |

Start with browser top sites. An optional enhanced mode may analyze recent browser history locally to surface recurring deep links. Frequency, recency, and visits across distinct days are enough for the first ranking; a possible initial threshold is visits on three different days within two weeks. Validate thresholds with synthetic examples before treating them as settled behavior.

Group suggestions by domain, allow expanding to specific pages, and provide pin, dismiss, and exclude-domain actions. Exclusions must persist. Refreshing automatic suggestions must not rewrite manual pins or silently create bookmarks. Preserve meaningful URL paths and query parameters; do not blindly merge different documents on the same host.

## Backgrounds

- Default: off. See [Visual design](#backgrounds) for readability rules.
- Sources: selected local images, explicit remote image URL lists, and a documented JSON image endpoint.
- Rotation: on opening a new tab, hourly, daily, or manually.
- Controls: source selection, skip, pause, crop, and readability overlay.
- Behavior: display the last successful cached image while fetching a replacement; retain it after failures.
- Scheduling: check elapsed time on open and wake; exact switching during device sleep is not promised.

Custom endpoint responses are data, never executable scripts. Define and validate the supported response shape when the source integration is implemented.

## Tools

| Tool              | Initial behavior                                                                 | Boundary                                                                            |
| ----------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| World clocks      | Selected cities, date offsets, and time comparison                               | Use time-zone-aware platform formatting, including daylight saving changes          |
| Search            | Find saved links; optionally search authorized browser data                      | Do not send local searches to a remote service                                      |
| AI launchpad      | Draft a question, copy it, and open the selected official service                | Do not assume automatic pasting, iframe support, or subscription-based API access   |
| Weather           | Current conditions, apparent temperature, rain probability, and a short forecast | Manual city selection first; location access optional                               |
| Notes             | Autosave, pin, expand, edit, and export                                          | Preserve edits and surface storage errors                                           |
| WeRead highlights | Import personal excerpts with book, chapter, and note context                    | Verify actual import samples; automatic account sync is a separate feasibility task |

Internal AI conversations would require a separately configured API integration. Do not send notes or browser history to an AI service without an explicit user action and a clear payload preview.

## Continue later

Offer to save a selected tab or group of tabs. Confirm durable storage and show the saved items before offering the close action. A failed save must leave the tabs open. Restoring a URL does not guarantee restoration of form input, page state, authentication, or scroll position. Closing is an explicit user action.

## Data portability

Provide versioned import/export for user-created links, settings, notes, and highlights. Validate imports before changing existing data, show merge/replace choices, and provide a backup before replacement. Credentials and raw browsing history are excluded from default exports.

## Later candidates

Work/personal views, calculator and unit conversion within search, cross-device sync, and more background providers can follow the core browsing loop. See the [roadmap](roadmap.md) for sequencing.
