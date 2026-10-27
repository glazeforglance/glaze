# Releasing Glaze

A short guide for maintainers. Releases are driven by Git tags: pushing `vX.Y.Z` runs the
[Release workflow](.github/workflows/release.yml), which builds the multi-arch image, pushes it to
`ghcr.io/glazeforglance/glaze` and creates the GitHub Release from CHANGELOG.md.

## Versioning

Glaze follows [Semantic Versioning](https://semver.org/). While the version is below 1.0:

- `0.x.Y` (patch) is for fixes;
- `0.X.0` (minor) is for new features or breaking changes.

Pre-releases are `X.Y.Z-rc.N`. They don't get the `latest` image tag and are marked as a
pre-release on GitHub.

## Checklist

1. `main` is clean and CI is green.
2. Every user-facing change is under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
3. `pnpm release:prepare X.Y.Z`: sets the version in every `package.json`, dates the
   CHANGELOG section and updates its links. It refuses a dirty tree, another branch than `main`,
   a version that isn't higher, or an empty Unreleased section.
4. Review the diff.
5. `git commit -am "chore(release): vX.Y.Z"`
6. `git push`
7. Wait for CI.
8. `git tag -a vX.Y.Z -m "Glaze vX.Y.Z"`
9. `git push origin vX.Y.Z`
10. Watch the Release workflow in Actions.
11. Verify the image tags on GHCR (`X.Y.Z`, `X.Y`, `latest`) and the GitHub Release.
12. Update your own deployment.

## What the Release workflow checks

- The tag must match `version` in the root `package.json` (`v0.1.2` ↔ `"0.1.2"`).
- CHANGELOG.md must have a `## [X.Y.Z]` section; its text becomes the release notes.

## When the Release workflow fails after the tag is pushed

1. Fix the problem on `main` (commit, push, wait for CI).
2. Delete the tag locally and remotely:

   ```bash
   git tag -d vX.Y.Z
   git push origin :refs/tags/vX.Y.Z
   ```
3. Delete the draft GitHub Release if one exists.
4. Tag again (steps 8–9 above).

If images were already pushed for that tag, prefer releasing `X.Y.Z+1` over re-using the tag:
people may already have pulled the first image.

## One-time organization setup

In the `glazeforglance` organization on GitHub:

- Make the GHCR package public: **Org → Packages → glaze → Package settings → Change visibility**.
- In the same package settings, under **Manage Actions access**, give the `glaze` repository **Write**.
- **Org Settings → Actions → General → Workflow permissions**: check that workflows may write packages.
