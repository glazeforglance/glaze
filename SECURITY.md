# Security policy

Glaze edits your Glance config, which often contains API keys and passwords. Security reports are very welcome.

## Supported versions

Glaze is young; only the latest release gets security fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅ (latest patch) |
| < 0.1   | ❌        |

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through
[GitHub Security Advisories](https://github.com/glazeforglance/glaze/security/advisories/new)
("Report a vulnerability" on the repository's Security tab).

Include what you found, how to reproduce it, and which version you tested. You'll get an answer within a week. Once a fix is released, the advisory is published with credit to you, unless you prefer otherwise.

## Scope

In scope: the Glaze server and web app, the Docker image, and how Glaze reads and writes config files.
Out of scope: Glance itself (report those to [glanceapp/glance](https://github.com/glanceapp/glance)), and setups that expose Glaze to the internet without the protection described in [docs/security.md](docs/security.md).
