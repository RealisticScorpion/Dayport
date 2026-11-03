# Proposed architecture

Status: Milestone 1 is implemented as described below. Later sections remain a proposal where they describe features that do not exist yet.

## Target

Chrome desktop, Manifest V3. macOS / Apple Silicon is a contributor environment, not the only supported runtime. Browser compatibility must be stated and tested when the extension is implemented.

The UI stack is TypeScript, React, and Vite, built with [WXT](https://wxt.dev). WXT was chosen over a hand-written manifest because it generates the manifest from entrypoints, provides development reload, and produces the store zip; it adds no runtime code beyond a small `browser` wrapper. The minimum supported browser is Chrome 120 (declared as `minimum_chrome_version`). Tests use Vitest for data logic and Playwright with Chromium for the built extension. Evaluate existing project patterns and compatible reusable libraries before implementing generic capabilities. Third-party source reuse requires compatible licensing and retained attribution; Dayport has not imported another extension's source.

## Responsibilities

| Boundary            | Owns                                                                     | Does not own                                              |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| New tab UI          | Navigation, search, widgets, editing, and accessible interactions        | Browser permissions and low-level persistence details     |
| Browser integration | Bookmarks, top sites, optional history, sessions, and tab actions        | Manual pin ordering and external provider logic           |
| Background worker   | Scheduled refresh, external fetches, and cache updates                   | A permanently running UI process                          |
| Local persistence   | Versioned settings, user content, cached assets, and import transactions | Remote synchronization unless explicitly introduced later |

Keep feature rules with their feature. Introduce a shared interface only when there are real alternate implementations. Start with a fixed set of tools rather than a plugin SDK, marketplace, or generic dashboard engine.

## Code layout

| Path                       | Contents                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| `src/data/`                | Schema, pure edit operations, search, migration, backup import and export |
| `src/app/`                 | Shared UI: storage hook, appearance, translations, toasts, icons          |
| `src/entrypoints/newtab/`  | The new tab page                                                          |
| `src/entrypoints/options/` | The options page (data import, export, reset, privacy)                    |
| `e2e/`                     | Playwright tests that load the built extension                            |
| `scripts/`                 | Font CSS, icon, and store screenshot generators                           |

## Data model

One versioned document is stored under the `dayport` key in `chrome.storage.local`:

```ts
{ version: 1, updatedAt: number, groups: Group[], settings: Settings }
Group = { id, name, links: Link[] }       // name 1–60 chars
Link  = { id, title, url }                // title 1–200 chars; url http, https, or chrome only
Settings = { theme, density, favicons, timeTint, language, singleKeyShortcuts }
```

- Every edit is a pure function in `src/data/ops.ts`. The page renders the result first and then writes the whole document; writes are serialized so an older write never lands after a newer one. A failed write keeps the change on screen and shows a Retry action.
- Other open pages receive changes through `storage.onChanged` and adopt the newer document.
- Unknown or damaged documents are never overwritten automatically. Valid groups are kept, missing settings fall back to defaults per field, and unreadable data shows an error with a reset path on the options page.
- Backups use `{ format: "dayport-backup", version, exportedAt, groups?, settings? }`. Imports validate every link, skip unsafe or malformed entries with a reason, regenerate ids, and change nothing until the user confirms merge or replace.

## Storage and updates

- Use extension local storage for small configuration values.
- Use IndexedDB for notes, highlights, image blobs, and growing content collections.
- Read cached data before requesting external updates.
- Keep background rotation and weather refresh independent of navigation rendering.
- Use `chrome.alarms` where background scheduling is needed and recheck freshness on open or resume.
- Handle service-worker suspension and recreation; timers in a page are not durable background scheduling.
- Version persisted formats and test migrations before shipping changes.
- Define concurrent-edit behavior for multiple new tab pages before implementing autosave.

## Browser API boundaries

| Capability            | Candidate API                         | Permission strategy                                                    |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| New tab replacement   | `chrome_url_overrides.newtab`         | Declare the bundled extension page                                     |
| Persistent settings   | `chrome.storage`                      | `storage`, required (implemented)                                      |
| Site icons            | `chrome://favicon` cache (`_favicon`) | `favicon`, required (implemented); no remote requests                  |
| Web search            | `chrome.search`                       | Planned with web search mode                                           |
| Frequent destinations | `chrome.topSites`                     | Optional on enabling automatic suggestions                             |
| Enhanced discovery    | `chrome.history`                      | Optional and separately explained                                      |
| Bookmark import       | `chrome.bookmarks`                    | Optional on import                                                     |
| Recently closed       | `chrome.sessions`                     | Optional on enabling the widget                                        |
| Selected tab saving   | `chrome.tabs`                         | Optional; listing a window's tabs needs `tabs`, requested on first use |
| Scheduled updates     | `chrome.alarms`                       | Add when scheduled work exists                                         |
| Remote providers      | Origin-scoped host permissions        | Request only enabled provider origins                                  |

The table is a plan, not an existing manifest or a claim that all listed permissions are necessary. Keep permissions absent until the corresponding capability exists.

## Security and privacy

Treat URLs, imported notes, highlighted text, and provider responses as untrusted data. Validate allowed URL schemes and import schemas, render text safely, and keep extension code bundled. Use synthetic fixtures. Do not bundle credentials, add telemetry by default, or make remote favicon requests without documenting the domain disclosure.

The planned implementation must follow the [privacy design](privacy.md) and [security policy](../SECURITY.md).

## Verification

For each implemented slice, add only the checks needed to verify meaningful behavior: ranking boundaries, import failure preservation, storage migration, save-before-close ordering, and daylight saving transitions. Check browser permission denial, offline operation, keyboard access, zoom, and multiple open new tab pages. Document which automated and manual checks were actually performed.

## References

- [Chrome new tab overrides](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)
- [Top Sites API](https://developer.chrome.com/docs/extensions/reference/api/topSites)
- [History API](https://developer.chrome.com/docs/extensions/reference/api/history)
- [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
