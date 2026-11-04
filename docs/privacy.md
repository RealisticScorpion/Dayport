# Privacy design

Status: design intent plus the behavior of the current build (Milestones 1, 2, and 3a, and weather from 3b). This is not a certification. Dayport stores links, settings, tabs saved for later, suggestion preferences, the note, and cached weather in `chrome.storage.local`, and bundles its fonts; opening a saved link is ordinary navigation.

The only network requests Dayport makes itself are for weather, and only after the user chooses a city. City search sends the typed name to `geocoding-api.open-meteo.com`; forecasts send the chosen city's latitude and longitude, rounded to two decimals, to `api.open-meteo.com`. Requests carry no cookies and no referrer, and nothing else is attached. Open-Meteo, like any server, receives network metadata such as the IP address. Turning off Weather under Sections in settings stops further requests; Reset on the options page clears the cached result. Because Open-Meteo allows cross-origin requests, no host permission is requested.

Background images are off by default. Local images are stored in IndexedDB on this device and never uploaded. Image links and a JSON source are addresses the user enters; the images load directly from those hosts, which receive ordinary request metadata. For a JSON source, Dayport asks Chrome for permission to read that one origin and fetches it at most every six hours, without cookies or referrer.

Required permissions are `storage`, `favicon`, `activeTab` (the toolbar button and page menu save the tab they were used on), `contextMenus`, and `search` (web mode sends the typed text to the user's default search engine, only when the user presses Enter). In ChatGPT and Claude modes, Dayport copies the draft to the clipboard and opens the service's start page; the draft is not put in the URL and nothing else is added. Top sites, history, bookmarks, sessions, and tabs are optional: each is requested only when the user enables the feature that needs it, read on this device only, and can be revoked on the options page. History is analyzed in the page to find recurring visits; neither raw history nor the analysis is stored. Revoking a permission stops future reads; links already pinned or saved for later stay until the user removes them.

## Local by default

Planned storage includes navigation links, settings, notes, personal reading highlights, cached images, and optional local discovery metadata. Browser history analysis is intended to run on the device. No Dayport account, analytics, advertising, or mandatory backend is planned for the initial extension.

## External connections

| Enabled feature    | Data that may leave the browser                                               | Intended recipient                                      |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Remote backgrounds | Image/endpoint request, network metadata, and any configured query parameters | The selected image provider                             |
| Weather            | Typed city searches, the chosen city's rounded coordinates, network metadata  | Open-Meteo (implemented)                                |
| Web search         | The search text after explicit submission                                     | The selected search engine                              |
| AI launchpad       | Pasted question text when the user submits it in the external service         | ChatGPT, Claude, or another explicitly selected service |
| Future API chat    | The explicitly submitted prompt and selected context                          | The configured API provider                             |

Provider-specific notices, required attribution, retention behavior, and permissions must be documented before enabling each integration. Do not silently send notes, raw history, reading highlights, or saved private links to remote services. Prefer browser-provided or local icons over undisclosed third-party favicon lookups.

## Permissions and control

Request history, bookmarks, sessions, location, and provider access only when the relevant functionality needs them. Explain the purpose, handle denial, and provide disable/delete controls for locally retained feature data. Removing permission must stop future access; disclose what previously saved content remains until the user deletes it.

## Export and deletion

Make data export user-initiated and explain that exported notes, links, and highlights may be sensitive. Exclude credentials and raw browsing history from default exports. Invalid imports must preserve current data; replacing content requires an explicit choice and a backup path. Provide a clear local reset flow when storage is implemented.

## Development and public collaboration

Use synthetic data in fixtures, screenshots, bug reports, and logs. Keep real exports, cookies, tokens, browsing records, and personal notes out of this public repository. Report accidental disclosure through the [security process](../SECURITY.md).

Before the first extension release, replace this design-only statement with a version-specific privacy notice verified against the shipped implementation.
