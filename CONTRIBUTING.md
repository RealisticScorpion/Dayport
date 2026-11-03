# Contributing to Dayport

Thank you for helping make Dayport useful, accessible, and easy to maintain. Contributions may be written in English or Simplified Chinese.

## Start here

1. Read the [project status](README.md#project-status), [design](docs/design.md), and [roadmap](docs/roadmap.md).
2. Search existing issues and pull requests before opening a new one.
3. Discuss new dependencies, browser permissions, external services, or changes to data formats in an issue before implementation.
4. Keep each pull request focused on one problem. Use synthetic browsing data, notes, and highlights in examples and fixtures.

Security vulnerabilities belong in the [private reporting process](SECURITY.md), not public issues. All participation follows the [code of conduct](CODE_OF_CONDUCT.md).

## Local setup

Use Node.js 24 or newer and npm. The `.nvmrc` file and CI select Node.js 24. Run commands from the repository root:

```sh
npm ci
npm run check
```

To apply formatting:

```sh
npm run format
```

The repository currently has documentation and formatting tooling only. There is no application build, runtime test suite, or extension package yet. When application code is added, its pull request must include reproducible development, build, and verification instructions.

## Pull requests

- Branch from `main`; use a descriptive branch name such as `docs/navigation-design` or `feat/grouped-links`.
- Explain the problem, resulting behavior, and meaningful tradeoffs.
- State exactly what you verified and which checks you could not run.
- Update documentation and the unreleased changelog when behavior or contributor workflows change.
- Add meaningful tests for nontrivial behavior when application code exists.
- Include keyboard and accessibility checks for user interface changes.
- Keep credentials, real history, personal highlights, exports, and screenshots containing private data out of Git.
- Retain required attribution and use dependencies with compatible licenses.
- Keep the English and Chinese README descriptions consistent when project status or setup changes.

Use clear commit messages. Conventional Commit prefixes such as `docs:`, `feat:`, `fix:`, and `chore:` are encouraged. No contributor license agreement or DCO sign-off is required; contributions are submitted under the repository's [MIT license](LICENSE).

## Review and release

A maintainer reviews changes before merging. Passing CI confirms only the checks it actually runs; browser acceptance and third-party integration verification must be reported separately. The project has no published release or compatibility guarantee yet. Future versioned releases will summarize changes, permissions, migration behavior, and verification evidence.
