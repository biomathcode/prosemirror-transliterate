# Integrate with a coding agent

Copy the prompt below into your coding agent from your application's repository. Replace the bracketed values first. The agent should inspect your existing editor before changing it.

```text
Integrate prosemirror-transliterate into this application.

Target editor/component: [path, or discover the existing ProseMirror editor]
Target language: [hi / bn / ta / te / another Language identifier]
Provider: [offline vocabulary / our endpoint URL / Google Input Tools]
Package source: [published version or absolute path to a built .tgz]

1. Read the repository instructions and inspect package.json, the existing
   ProseMirror schema, plugin order, transaction dispatch, styles, tests, and
   component lifecycle. Preserve the current architecture and package manager.
   Do not replace the editor or create a second editor to demonstrate the feature.

2. Read the installed package README, TypeScript declarations, and docs/api.md.
   Use transliterationPlugin, exported from prosemirror-transliterate.
   NewtransliterationPlugin is a deprecated alias. Do not invent package APIs.
   If no published release is available, use the supplied local tarball.
   Resolve one compatible copy of each ProseMirror peer dependency.

3. Add the plugin once, before keymaps that consume Enter, Space, or arrow keys.
   Import prosemirror-transliterate/style.css and retain the host's core
   ProseMirror styles. Give the editor a meaningful accessible label.

4. Configure lang and the selected provider. A custom getSuggestions function
   receives (word, { lang, numOptions, signal }) and returns a string array or
   Promise of one. Pass signal to fetch, validate responses, and handle provider
   failures without blocking typing. Keep credentials on the server. Do not
   log document text. Google Input Tools is an unofficial external endpoint:
   tell the application user when their active word will be sent to it.
   An offline dictionary must be described as a limited vocabulary.

5. Preserve editor state across renders. Create the EditorView only after mount
   in SSR applications and call view.destroy() on unmount. If language changes,
   replace this plugin using state.reconfigure while preserving other plugins.
   Do not mutate EditorState or plugin state directly.

6. Verify realistic behavior: type a supported Latin word, wait for suggestions,
   navigate with arrows, accept with Enter and Space, dismiss with Escape,
   select with the mouse, and undo. Confirm stale responses cannot replace text
   after a cursor change, more typing, or editor destruction. Test failure,
   IME composition, and two editors. Mock network calls in automated tests.
   Do not assert support for languages your chosen provider has not verified.

7. Run this application's relevant type checks, tests, and production build.
   Report changed files, how to try the feature, provider behavior, verification
   results, and any concrete remaining limitations. Do not publish or deploy
   unless that is included in my request.
```

## What the agent needs

A package version or local tarball, an existing ProseMirror editor, a language, and a provider decision. For a custom endpoint, supply the response contract and server authentication approach. Do not paste secrets into the prompt.

## Review the result

The final integration should preserve the existing schema and state ownership. Test input in the real browser, including the empty-result path. An offline word list proves integration behavior; it does not establish general language support or external-service reliability.
