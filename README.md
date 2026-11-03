# Dayport

**Your daily starting point.**

A local-first Chrome new tab dashboard for dense navigation, useful widgets, and fewer open tabs.

[简体中文](README.zh-CN.md) · [Product design](docs/design.md) · [Roadmap](docs/roadmap.md) · [Contributing](CONTRIBUTING.md)

[![CI](https://github.com/RealisticScorpion/Dayport/actions/workflows/ci.yml/badge.svg)](https://github.com/RealisticScorpion/Dayport/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Project status

**Milestone 1 (navigation loop) implemented; preview not yet published.** The extension runs from source in Chrome 120 or newer: grouped links with editing and reordering, keyboard search, settings, and versioned backup import and export. Everything else in the table below is planned. See the [roadmap](docs/roadmap.md) for status.

## What Dayport is for

Keep important links within reach, rediscover frequently used pages, and put unfinished browsing aside without keeping every tab open.

| Planned capability  | Intended behavior                                                                   |
| ------------------- | ----------------------------------------------------------------------------------- |
| Dense navigation    | Compact grouped links, bookmark import, and keyboard access                         |
| Automatic discovery | Browser top sites; optional local history analysis for frequently revisited pages   |
| Continue later      | Save selected tab URLs before offering to close the tabs                            |
| Custom backgrounds  | Local images, remote image lists, and documented image APIs with scheduled rotation |
| Unified search      | Search saved links and optionally browser data; launch web searches or AI services  |
| Everyday tools      | World clocks, time-zone comparison, weather, and autosaved notes                    |
| Reading highlights  | Import personal WeRead highlights and revisit excerpts with their book context      |
| Portable data       | Versioned export and import of settings and user-created content                    |

## Design principles

- Navigation stays central; widgets use compact, collapsible space.
- Manual pins remain stable while automatic suggestions change independently.
- Personal content and history analysis stay local by default.
- Sensitive browser permissions are optional and requested when their feature is enabled.
- Cached content remains useful offline; external services update independently.
- Accessibility, keyboard navigation, and readable contrast are part of the baseline.

## Getting involved

Read the [design](docs/design.md), [proposed architecture](docs/architecture.md), and [roadmap](docs/roadmap.md) before starting implementation. Open an [issue](https://github.com/RealisticScorpion/Dayport/issues) to discuss a focused change.

Use Node.js 22.12 or newer with npm 11 (CI uses Node.js 24 from `.nvmrc`).

```sh
git clone https://github.com/RealisticScorpion/Dayport.git
cd Dayport
npm ci
npm run build
```

Then load it in Chrome: open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `.output/chrome-mv3`. Open a new tab to use Dayport.

| Command                    | Purpose                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Development build with reload in a temporary Chrome window                                                  |
| `npm run typecheck`        | TypeScript checks                                                                                           |
| `npm test`                 | Unit tests for data, search, and import logic                                                               |
| `npm run test:e2e`         | Browser tests against the built extension (run `npm run build` and `npx playwright install chromium` first) |
| `npm run zip`              | Package `.output/dayport-<version>-chrome.zip` for the Chrome Web Store                                     |
| `npm run check` / `format` | Prettier formatting                                                                                         |

## Documentation

- [Product design](docs/design.md)
- [Architecture and technical decisions](docs/architecture.md)
- [Roadmap and acceptance criteria](docs/roadmap.md)
- [Privacy design](docs/privacy.md)
- [Contributing](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security reporting](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE) © 2026 Dayport contributors. Third-party services, trademarks, and imported reading content retain their respective terms and rights. Dayport is an independent project and is not affiliated with Chrome, OpenAI, Anthropic, or Tencent.
