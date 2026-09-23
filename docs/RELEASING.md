# Releasing fm-co to npm

## Overview

npm publishing uses two phases:

1. One-time bootstrap publish performed interactively by the npm account owner.
2. All later releases published by GitHub Actions through npm Trusted Publishing (OIDC).

No long-lived npm publish token is stored in GitHub Actions.

## Why bootstrap is manual

npm Trusted Publisher configuration is attached to an existing npm package. For the first release, the package must therefore be created on npm Registry using an authenticated npm account. After that first publish, configure GitHub Actions as the trusted publisher for the package.

## One-time bootstrap: fm-co@0.1.0

Prerequisites:

- npm account with 2FA enabled.
- Write ownership of the unscoped package name `fm-co`.
- A clean checkout of the commit containing version `0.1.0`.

Before publishing, check whether the name already exists:

```bash
npm view fm-co version
```

A registry 404 means the package does not currently exist. Any returned version means the name is already registered and the package name must be changed before publishing.

Run the same checks used by CI:

```bash
npm install --ignore-scripts
npm test
npm pack --dry-run
```

Authenticate and publish:

```bash
npm login
npm publish --ignore-scripts --access public
```

Do not create or commit an `NPM_TOKEN` for this bootstrap.

## Configure Trusted Publishing

After `fm-co` exists on npmjs.com, open its package settings and create a GitHub Actions trusted publisher with:

- Organization/User: `nntokyo`
- Repository: `fm-co`
- Workflow filename: `publish.yml`
- Environment: none
- Allowed action: direct `npm publish`

The workflow file is `.github/workflows/publish.yml`; npm's form expects only the filename.

The release workflow uses a GitHub-hosted Ubuntu runner and grants:

```yaml
permissions:
  contents: read
  id-token: write
```

Do not add `NODE_AUTH_TOKEN` or a write-capable npm token to the publish job.

## Subsequent releases

1. Update `package.json` version in a normal PR.
2. Run CI and merge the PR.
3. Create a GitHub Release whose tag is exactly `v<package-version>`.
4. Publishing the GitHub Release triggers `publish.yml`.
5. The workflow verifies the tag/version match, tests, inspects the package tarball, and runs `npm publish --ignore-scripts --access public`.

Example for version 0.1.1:

```text
package.json: 0.1.1
GitHub tag:   v0.1.1
```

The workflow rejects mismatches.

## Supply-chain controls

- Trusted Publishing uses short-lived OIDC credentials.
- Release runs use GitHub-hosted runners only.
- Package-manager cache is disabled in the publish job.
- Dependency lifecycle scripts are disabled during release installation.
- npm provenance is generated automatically by Trusted Publishing for this public repository/public package.
- The source repository in `package.json` is `nntokyo/fm-co`.
- Publish failures never fall back to a static npm token.

## Rollback

npm versions are immutable. Do not attempt to overwrite a broken published version.

For an accidental release:

1. Deprecate the bad version with an explanatory message if appropriate.
2. Fix the issue through the normal PR + CI path.
3. Increment the package version.
4. Publish a new GitHub Release for the corrected version.

Unpublishing should be treated as an exceptional npm-registry operation and not automated by this repository.
