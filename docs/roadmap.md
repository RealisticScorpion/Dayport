# Roadmap

All unchecked items are planned work, not existing features. Milestones express sequencing, not committed delivery dates.

## Repository foundation

- [x] English and Simplified Chinese README
- [x] Product design, proposed architecture, and privacy boundaries
- [x] License, contribution guide, conduct policy, and security reporting guidance
- [x] Issue forms, pull request template, and documentation formatting workflow

## Milestone 1: navigation loop

- [x] Runnable Manifest V3 extension with documented local installation
- [x] Compact grouped links with add, edit, delete, and manual ordering
- [x] Local persistence with surfaced save failures
- [x] Keyboard navigation, readable contrast, and responsive density
- [x] Search saved links and open selected destinations
- [x] Versioned settings and link export/import

Acceptance (automated in `e2e/navigation.spec.ts`): create a group, save a link, reopen Chrome, find and open the link with the keyboard, then export and restore it without losing existing content after an invalid import.

## Milestone 2: rediscover and continue

- [ ] Optional browser top sites and bookmark import
- [ ] Optional local history-based discovery of recurring pages
- [ ] Pin, dismiss, exclude-domain, and domain-grouping behavior
- [ ] Save selected tab URLs and offer closing only after durable storage
- [ ] Recently closed list and restore actions

Acceptance: permission refusal leaves manual navigation usable; exclusions persist; automatic updates preserve pins; a failed save never closes tabs.

## Milestone 3: backgrounds and daily tools

- [ ] Local images, remote image lists, and one documented JSON image source
- [ ] Scheduled rotation, manual skip, and last-successful-image fallback
- [ ] World clocks and cross-time-zone comparison
- [ ] Weather with manual city selection and cached results
- [ ] Autosaved notes with concurrent-edit handling and export
- [ ] Web search and ChatGPT / Claude draft-copy-open actions
- [ ] Personal WeRead highlight import, browsing, and rotation

Acceptance: cached content works offline; failed provider requests do not block navigation; time comparisons handle daylight saving changes; invalid highlight imports preserve existing data.

## Milestone 4: release readiness

- [ ] Browser acceptance on declared minimum and current Chrome versions
- [ ] Application tests, build checks, and reproducible extension packaging
- [ ] Permission inventory and an accurate runtime privacy notice
- [ ] Sanitized screenshots, installation guide, and release notes
- [ ] Accessibility, storage migration, and recovery verification
- [ ] First tagged preview release after verification

## Later, subject to validation

- [ ] Work/personal views
- [ ] Calculator and unit conversion within search
- [ ] Configured API-based AI conversations
- [ ] WeRead automatic sync after feasibility and privacy review
- [ ] Explicitly enabled cross-device sync

A plugin marketplace, public account system, and mandatory backend are outside the current scope.
