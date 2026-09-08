# Changelog

## Unreleased

- Add `transliterationPlugin`, typed custom providers, and readable plugin state.
- Keep `NewtransliterationPlugin` as a deprecated alias.
- Replace mutable editor state with transaction-based updates.
- Add request cancellation, stale-result validation, debouncing, and per-view LRU caching.
- Handle cursor changes, composition, keyboard selection, blur, and cleanup.
- Consolidate Google requests; encode query values, apply partial defaults, and validate responses.
- Limit stylesheet scope to the suggestion popup; export CSS and ESM declarations.
- Make ProseMirror state/view peer dependencies to avoid bundling duplicate copies.
- Add unit/integration/browser tests, CI, guides, an agent prompt, and a Cloudflare-ready playground.

### Behavior changes

Space accepts the highlighted candidate (previously the first candidate). Core editor styles must now be supplied by the host. Google helper failures consistently retain the original word when that option is enabled. The package remains a development build at 0.0.0.
