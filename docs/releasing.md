# Release the package

The current version is `0.0.0`, retained from the initial repository. No npm publication is performed by a build or by the documentation deployment.

## Validate

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:coverage
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:package
npm pack --dry-run
```

Inspect the tarball file list: JavaScript, source maps, declarations, popup CSS, docs, README, and MIT license should be present. Website build assets and test dependencies must not be shipped. Source maps include library source for debugging.

## Smoke-test the consumer package

```sh
pnpm build
npm pack
# Install the generated .tgz in a separate Vite + ProseMirror application.
```

Check JavaScript import resolution, TypeScript declarations, and `prosemirror-transliterate/style.css`. The browser build should resolve ProseMirror from your application's peer dependencies. The package is ESM-only; CommonJS require is not a supported entry point.

## Publish when ready

Confirm ownership and availability of the npm name, choose a version, update CHANGELOG.md, and review repository and author metadata. Replace the development-release notices in the README and website when the release is actually available. Run validation again after changing release metadata.

```sh
npm version 0.1.0
npm publish --access public
```

These are maintainer actions to perform deliberately, not part of CI. `prepublishOnly` runs the main checks before publishing. Release credentials belong in your registry login or trusted publishing setup, never in this repository.
