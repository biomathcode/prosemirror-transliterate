# API reference

All JavaScript exports are available from `prosemirror-transliterate`. Popup styles are available from `prosemirror-transliterate/style.css`.

## transliterationPlugin(options?)

Returns a `Plugin<TransliterationState>`. Install once per editor, before keymaps that consume its keyboard controls.

| Option | Default | Behavior |
| --- | --- | --- |
| `lang` | `'hi'` | Language code passed to the provider. See `Language`. |
| `numOptions` | `5` | Maximum candidate count; clamped to an integer from 1–10. |
| `debounceMs` | `150` | Delay after input or cursor changes; clamped to 0–10,000 ms. |
| `cacheSize` | `100` | Maximum words cached per editor; 0 disables caching, maximum 10,000. |
| `getSuggestions` | Google adapter | Synchronous or async provider returning a readonly array of strings. |
| `onError` | none | Receives custom provider failures; cancellation is ignored. |

Non-finite numeric options use their defaults. Empty or duplicate candidates are removed. Returned suggestions are capped by `numOptions`. Successful nonempty results use an in-memory LRU cache scoped to each editor. It has no time-based expiry; disable it for changing or context-dependent providers. Empty results and failures are not cached. Destruction clears the cache.

## SuggestionProvider

```ts
interface SuggestionContext {
  lang: Language;
  numOptions: number;
  signal: AbortSignal;
}

type SuggestionProvider = (
  word: string,
  context: SuggestionContext,
) => readonly string[] | Promise<readonly string[]>;
```

The plugin passes the active word, never the full document. Pass `signal` into your network request. The plugin rejects stale responses even if your provider ignores cancellation. It handles thrown errors without blocking editing and invokes `onError` for current, non-aborted custom requests.

## getTransliterateSuggestions(word, options?)

A standalone helper for the unofficial Google Input Tools endpoint. You can call it without creating an editor.

```ts
const candidates = await getTransliterateSuggestions('namaste', {
  lang: 'hi',
  numOptions: 5,
  showCurrentWordAsLastSuggestion: true,
  signal: controller.signal,
});
```

Defaults are `lang: 'hi'`, `numOptions: 5`, and `showCurrentWordAsLastSuggestion: true`, including when only some options are provided. The original word, when enabled, is appended after the capped candidates, so the helper may return `numOptions + 1` items. Blank input and aborted requests return `[]`. HTTP errors, malformed data, and network failures return `[word]` if the original-word option is enabled, otherwise `[]`. Errors are not logged.

The plugin's built-in provider disables the original-word option; Escape is the way to retain the original input. The built-in adapter absorbs failures, so `onError` only observes errors thrown by a custom provider.

## Language

A TypeScript union preserving the original adapter's language identifiers:

```text
am ar bn be bg yue-hant zh zh-hant fr de el gu he hi it ja kn
ml mr ne or fa pt pa ru sa sr si es ta te ti uk ur vi
```

These are accepted configuration values, **not a verified support matrix**. Candidate quality and availability depend on your provider. The bundled website vocabulary demonstrates Hindi, Bengali, Tamil, and Telugu only.

## transliterationKey

Read the current plugin state without mutating it:

```ts
const state = transliterationKey.getState(view.state);
// { suggestions, index, from, to, word } | undefined
```

`word` is `null` when cleared. `from` and `to` are ProseMirror document positions. State is readonly; let the plugin handle updates. Internal transaction metadata is not a public command API.

## Keyboard behavior

| Key | While suggestions are open |
| --- | --- |
| ↑ / ↓ | Cycle through suggestions, wrapping at either end. |
| Enter | Replace the word with the highlighted suggestion. |
| Space | Replace with the highlighted suggestion and a trailing space in one transaction. |
| Escape | Dismiss suggestions and cancel any pending request. |
| Tab | Pass through to the host. |

Modified keys and IME composition keys pass through. Escape also cancels pending work before the menu opens. Undo grouping follows your host's `prosemirror-history` configuration; the replacement and its trailing space are one transaction, but can share a history group with preceding typing.

## Word boundaries and lifecycle

Only ASCII Latin words (`a-z`, `A-Z`) at a collapsed text cursor and at the end of a word are eligible. The plugin skips code blocks, code marks, numbers mixed into words, and suffixes of other Unicode words. It does not transliterate selected ranges or convert a whole pasted document. A pasted final eligible word can trigger suggestions.

Typing, deletion, selection changes, and external document changes invalidate old ranges immediately. Blur, Escape, composition start, and destruction cancel timers and in-flight requests. The popup uses fixed positioning and follows scroll/resize. The editor's document owns the popup. Ordinary DOM editors are the supported integration; custom Shadow DOM popup placement is not exposed.

The popup provides listbox/option roles, an active-descendant relationship, and a live status region. Label your host editor as shown in the quick start. Validate with your application's supported screen readers; the package does not claim a screen-reader certification.

## Styling and legacy export

Override `--transliteration-background`, `--transliteration-color`, `--transliteration-border`, and `--transliteration-selected` on `:root` or the document body. The popup is mounted under `body`, so editor-only variables do not inherit into it.

`NewtransliterationPlugin` remains a deprecated alias of `transliterationPlugin`. Existing calls work; prefer the new name in new code. The stylesheet now styles only the popup rather than changing the entire editor.
