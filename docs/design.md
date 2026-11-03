# Product design

Status: proposed design. No application features are implemented yet.

## Purpose

Dayport is a Chrome new tab extension for quickly opening useful pages, rediscovering recurring destinations, and returning to unfinished browsing with fewer tabs left open.

## Layout

On a wide desktop window, approximately 70% of the content area is navigation and 30% is compact tools. The layout adapts to narrower windows and browser zoom.

- Header: date, selected world clocks, background control, and settings.
- Search: one input with explicit local search, web search, ChatGPT, and Claude modes.
- Main area: pinned navigation, automatic frequent pages, and continue-later links.
- Tool column: weather, quick notes, and personal reading highlights.
- Expandable area: recently closed pages and saved tab groups.

Use short link labels, small icons, clear group headings, and comfortable or compact density settings. Aim to accommodate 60–100 links on suitable desktop screens without making small screens or keyboard navigation unusable. Background overlays must preserve text contrast. Avoid mandatory animation and respect reduced-motion preferences.

## Navigation behavior

| Collection     | Ownership                      | Update rule                                       |
| -------------- | ------------------------------ | ------------------------------------------------- |
| Pinned links   | User                           | Manual edits, import, ordering, and grouping      |
| Frequent pages | Browser data and local ranking | Refresh suggestions independently of pinned order |
| Continue later | User                           | Explicit save, restore, and removal               |

Start with browser top sites. An optional enhanced mode may analyze recent browser history locally to surface recurring deep links. Frequency, recency, and visits across distinct days are enough for the first ranking; a possible initial threshold is visits on three different days within two weeks. Validate thresholds with synthetic examples before treating them as settled behavior.

Group suggestions by domain, allow expanding to specific pages, and provide pin, dismiss, and exclude-domain actions. Exclusions must persist. Refreshing automatic suggestions must not rewrite manual pins or silently create bookmarks. Preserve meaningful URL paths and query parameters; do not blindly merge different documents on the same host.

## Backgrounds

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
