# Bring your own provider

The plugin handles the editor. Your provider handles the words. Swap in an offline dictionary, your API, or a transliteration service without changing the editor integration.

## An offline vocabulary

Useful for tests, a controlled vocabulary, or learning the API. This example is a dictionary, not a general transliteration engine.

```ts
const vocabulary: Record<string, string[]> = {
  namaste: ['नमस्ते', 'नमस्कार'],
  duniya: ['दुनिया'],
};

const plugin = transliterationPlugin({
  lang: 'hi',
  getSuggestions: word => vocabulary[word.toLowerCase()] ?? [],
});
```

The website uses this pattern for its sample words. Unknown words deliberately return no suggestions.

## Your application endpoint

```ts
import type { SuggestionProvider } from 'prosemirror-transliterate';

const getSuggestions: SuggestionProvider = async (word, { lang, numOptions, signal }) => {
  const response = await fetch('/api/transliterate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, lang, limit: numOptions }),
    signal,
  });
  if (!response.ok) throw new Error(`Suggestion request failed: ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(item => typeof item === 'string')) {
    throw new Error('Expected a JSON array of strings');
  }
  return data;
};

const plugin = transliterationPlugin({
  lang: 'hi',
  getSuggestions,
  onError: () => showSuggestionServiceUnavailable(), // Your application's status UI.
});
```

`/api/transliterate` and `showSuggestionServiceUnavailable` are application-owned examples; this repository does not implement that endpoint. Its response contract is a JSON string array. Add authentication, request limits, and provider credentials on your server if required. Do not put secrets in frontend configuration. Prefer an error indicator over logging typed text.

## Cancellation and caching

Use the supplied `AbortSignal` for every request. A response that arrives after the user changes their word or cursor is discarded. Providers that cannot cancel are supported, but their underlying work may continue.

Results are cached by exact word in the current editor. Set `cacheSize: 0` if results depend on time, user context, or mutable data. A new plugin instance starts a fresh cache. Debouncing and caching reduce provider calls; neither guarantees a provider quota.

## The built-in Google adapter

Calling `transliterationPlugin({ lang: 'hi' })` uses the unofficial `inputtools.google.com` endpoint. It sends the active Latin word and language, not the full document. Network failures, unsupported identifiers, unexpected responses, or CORS restrictions simply leave normal typing intact.

For live-demo troubleshooting, check your browser's network panel and the chosen language. Do not assume a successful build means the external service is available. Tests mock the network, and the offline playground works without Google.
