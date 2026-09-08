# Contributing

Use Node.js 22+ and pnpm 10.12.1. Run `pnpm install`, then `pnpm check`.

- `src/`: public library and popup stylesheet.
- `tests/`: Vitest integration tests using real ProseMirror state/view with JSDOM and mocked providers.
- `website/`: Vite playground and static documentation templates.
- `docs/`: source of truth for generated guides and agent-readable content.
- `e2e/`: Chromium browser tests against the built website, on desktop and mobile viewports.

Keep the library framework-independent. Update plugin state through transactions. Keep asynchronous resources scoped to the view, and test cancellation and destruction when changing request behavior. Do not make real provider calls in automated tests. Do not claim language support based only on the Language type.

Before submitting changes, run `pnpm check`, `pnpm test:coverage`, and `pnpm test:e2e`. When changing deployment configuration, also run `pnpm site:check`. Generated guide HTML, dist, coverage, and browser reports are ignored. Update source Markdown and regenerate with `pnpm docs:generate`; restart the dev command after editing Markdown.
