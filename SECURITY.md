# Security Policy

## Supported versions

Dayport is in repository bootstrap and has no published application release. Security fixes to repository tooling are handled on `main`. A supported-version policy will be published with the first extension release.

## Reporting a vulnerability

Please do not report vulnerabilities, credentials, or private browsing data in public issues, pull requests, or discussions.

Use GitHub's **Security → Advisories → Report a vulnerability** when available:

<https://github.com/RealisticScorpion/Dayport/security/advisories/new>

If private reporting is unavailable, use a private contact method listed on the [maintainer's profile](https://github.com/RealisticScorpion). Do not post the exploit publicly as a fallback.

Include the affected commit or version, a concise impact description, and minimal reproduction steps using synthetic data. Avoid sending access tokens, browser cookies, account exports, or unnecessary personal information. Coordinate disclosure with the maintainer before publishing details. This volunteer project does not currently promise a response deadline or bug bounty.

## Implementation expectations

- Request browser permissions only for enabled features.
- Treat imported files, stored URLs, API responses, and rendered notes as untrusted input.
- Verify successful durable storage before offering to close saved tabs.
- Keep secrets out of source control, logs, screenshots, and default exports.
- Keep workflows read-only unless a specific job requires additional permissions.
- Never execute untrusted pull request code with repository secrets.

See the [privacy design](docs/privacy.md) for planned data boundaries.
