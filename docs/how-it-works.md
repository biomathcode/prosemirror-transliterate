# How the plugin works

A transliteration menu is a useful way to learn one of ProseMirror's central ideas: the document and plugin state change through transactions, while browser effects belong to the view.

## 1. Locate an eligible word

After a document or selection change, the view checks the text around the collapsed cursor in the current text block. An ASCII Latin word ending at that cursor becomes a candidate. Code content, mixed-script suffixes, and partial words are excluded.

The document is not serialized or scanned end to end. Only the current text block is inspected. Detection cost grows with the current block's length, not the full document. Very large single-paragraph documents can still make this work more expensive.

## 2. Delay and cancel work

The view waits 150 ms by default. Another edit cancels the timer and aborts any previous request. Each request captures a generation number and a word range. A returned result is only eligible if the generation, text, selection, and focus still match.

Why check both generation and range? A user can type a word, delete it, and type the same word at the same position before an old request finishes. Matching the text alone would accept the old result.

## 3. Commit suggestions through a transaction

The view dispatches metadata containing the candidates and their range. The plugin's `state.apply` returns a new state value. It never writes directly into an existing `EditorState`.

This keeps state transitions predictable. Arrow-key navigation also dispatches metadata, so readers of an older state see the older selection index. Suggestion-only updates are excluded from history.

## 4. Render without changing the document

A view-owned popup reads the plugin state. It renders candidates as text nodes, avoiding HTML interpretation of provider strings. Its listbox follows cursor coordinates, and its options identify the active suggestion for assistive technology.

The popup is created only when an `EditorView` exists. Importing the module on a server does not touch `document` or `window`.

## 5. Accept or dismiss

Enter, Space, and mouse selection validate the current range before inserting. Space and the selected candidate are inserted in one transaction. Escape discards suggestions. With no candidates, normal editor behavior continues.

## 6. Dispose everything the view owns

Timers, abort controllers, cache entries, DOM nodes, and event listeners belong to a single view and are cleaned up on destruction. A weak map connects event handlers to that view's controller. Two editors can share a plugin instance without sharing requests or popup state.

## What to read next

Read `src/plugin.ts` alongside `tests/index.test.ts`. Start with the stale-response test, then the shared-plugin test. These are useful patterns for mentions, autocomplete, inline search, and other async editor features.

The [official ProseMirror guide](https://prosemirror.net/docs/guide/) explains transactions, editor state, and plugin views. The [reference manual](https://prosemirror.net/docs/ref/) documents the underlying APIs.
