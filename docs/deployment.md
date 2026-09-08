# Deploy on Cloudflare

The documentation site is static HTML, CSS, and JavaScript. It runs on Cloudflare Workers Static Assets with no database, server code, or provider secrets. The default offline playground makes no suggestion-service requests.

## Preview and verify

Run these commands from the repository root (the `package/` folder in the original workspace):

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm site:preview
```

`pnpm site:build` builds the library, generates HTML guides from `docs/*.md`, and emits the website to `website/dist/`. The generated site also includes `/llms.txt`, `/llms-full.txt`, and `/agent-prompt.md` for coding agents.

## Deploy with Wrangler

```sh
pnpm site:check       # Build and validate with wrangler deploy --dry-run
pnpm exec wrangler login
pnpm site:deploy     # Build, then deploy the static assets
```

Wrangler prompts you to authenticate if needed. The deployment command prints your deployed URL. Set a unique Worker name in `wrangler.jsonc` if `prosemirror-transliterate` is already in use in your account.

The configuration uses `assets.directory: './website/dist'` and a recent compatibility date. A `404.html` page handles missing routes. Static assets use Cloudflare's documented clean HTML routing; `/docs/api` serves the generated API guide. No SPA fallback is needed because the guides are generated HTML.

## Cloudflare Git builds

Connect the repository in Cloudflare Workers & Pages and choose Workers. If you push the contents of this Git repository, use the repository root as the build root. If it is nested inside a larger repository, set the build root to its `package/` folder.

- Build command: `pnpm install --frozen-lockfile && pnpm site:build`
- Deploy command: `pnpm exec wrangler deploy`
- Node version: 22 or newer

The pinned `packageManager` field identifies pnpm. Ensure pnpm 10.12.1 is available in your build environment. Keep credentials in Cloudflare's CI configuration, never in Git.

## Cloudflare Pages alternative

For an existing Pages workflow, build with `pnpm site:build` and choose `website/dist` as the output directory. You can upload it using:

```sh
pnpm exec wrangler pages deploy website/dist --project-name YOUR_PAGES_PROJECT
```

Replace the project name with your own. `site:deploy` targets Workers Static Assets; the Pages command is an alternative deployment path.

## Before sharing

Check the playground, language changes, guide navigation, copy buttons, and `/404.html` on the deployed URL. Switching the playground to Google mode makes requests directly from the visitor's browser; verify availability there if you want to offer live suggestions. The package itself is published separately to npm.

See Cloudflare's [Static Assets guide](https://developers.cloudflare.com/workers/static-assets/get-started/) and [Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/) for the current platform behavior.
