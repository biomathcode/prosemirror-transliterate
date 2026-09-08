import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { closeHistory, history, undo } from 'prosemirror-history';
import { NewtransliterationPlugin, transliterationPlugin, transliterationKey } from '../src';
import type { SuggestionContext, TransliterationOptions } from '../src';

const views: EditorView[] = [];
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(window, 'scrollBy').mockImplementation(() => {}); });
afterEach(() => { views.forEach(view => { if (!view.isDestroyed) view.destroy(); }); views.length = 0; document.body.replaceChildren(); vi.useRealTimers(); });
function create(options: TransliterationOptions = {}, plugin = transliterationPlugin({ getSuggestions: () => ['नमस्ते', 'नमस्कार'], ...options }), node = 'paragraph') {
  const host = document.createElement('div'); document.body.appendChild(host);
  const view = new EditorView(host, { state: EditorState.create({ schema, doc: schema.node('doc', null, [schema.node(node)]), plugins: [plugin, history()] }) });
  vi.spyOn(view, 'coordsAtPos').mockReturnValue({ top: 10, bottom: 30, left: 20, right: 20 });
  views.push(view); view.focus(); return view;
}
function type(view: EditorView, text: string) { view.dispatch(view.state.tr.insertText(text)); }
async function settle() { await vi.advanceTimersByTimeAsync(200); }
function key(view: EditorView, name: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
  view.dom.dispatchEvent(event); return event.defaultPrevented;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

test('preserves the legacy export', () => expect(NewtransliterationPlugin).toBe(transliterationPlugin));
test('debounces rapid typing and keeps state immutable while navigating', async () => {
  const getSuggestions = vi.fn((_word: string) => ['नमस्ते', 'नमस्कार']);
  const view = create({ getSuggestions });
  type(view, 'na'); await vi.advanceTimersByTimeAsync(100); type(view, 'maste'); await settle();
  expect(getSuggestions).toHaveBeenCalledTimes(1);
  expect(getSuggestions.mock.calls[0][0]).toBe('namaste');
  const previous = transliterationKey.getState(view.state)!;
  expect(previous.suggestions).toEqual(['नमस्ते', 'नमस्कार']);
  expect(key(view, 'ArrowUp')).toBe(true);
  expect(previous.index).toBe(0);
  expect(transliterationKey.getState(view.state)?.index).toBe(1);
  expect(document.querySelector('[aria-selected="true"]')?.textContent).toBe('नमस्कार');
  expect(key(view, 'ArrowDown')).toBe(true);
  expect(transliterationKey.getState(view.state)?.index).toBe(0);
});
test.each(['Enter', ' '])('accepts the highlighted option using %j', async name => {
  const view = create(); type(view, 'namaste'); await settle(); key(view, 'ArrowDown');
  expect(key(view, name)).toBe(true);
  expect(view.state.doc.textContent).toBe('नमस्कार' + (name === ' ' ? ' ' : ''));
  expect(transliterationKey.getState(view.state)?.suggestions).toEqual([]);
  await settle(); expect(document.querySelector('.transliteration-menu')?.hasAttribute('hidden')).toBe(true);
});
test('replacement and trailing space undo together at a host history boundary', async () => {
  const view = create(); type(view, 'namaste'); await settle(); view.dispatch(closeHistory(view.state.tr)); key(view, ' ');
  expect(undo(view.state, view.dispatch)).toBe(true);
  expect(view.state.doc.textContent).toBe('namaste');
});
test('click selection keeps editor focus and inserts text safely', async () => {
  const view = create({ getSuggestions: () => ['<img src=x onerror=alert(1)>'] });
  type(view, 'namaste'); await settle();
  expect(document.querySelector('.transliteration-menu img')).toBeNull();
  document.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  expect(view.state.doc.textContent).toBe('<img src=x onerror=alert(1)>'); expect(view.hasFocus()).toBe(true);
});
test('dismisses visible suggestions and does not intercept unrelated keys', async () => {
  const view = create(); type(view, 'namaste'); await settle();
  expect(key(view, 'Enter', { ctrlKey: true })).toBe(false);
  expect(key(view, 'Tab')).toBe(false);
  expect(key(view, 'Escape')).toBe(true);
  expect(key(view, 'Enter')).toBe(false);
  expect(view.state.doc.textContent).toBe('namaste');
});
test('Escape cancels pending work before results arrive', async () => {
  const pending = deferred<string[]>(); const view = create({ getSuggestions: () => pending.promise });
  type(view, 'namaste'); await settle(); expect(key(view, 'Escape')).toBe(true);
  pending.resolve(['late']); await settle();
  expect(transliterationKey.getState(view.state)?.suggestions).toEqual([]);
});
test('aborts superseded requests and rejects stale responses from providers that ignore abort', async () => {
  const first = deferred<string[]>(), second = deferred<string[]>(); const signals: AbortSignal[] = [];
  const view = create({ getSuggestions: (word, context) => { signals.push(context.signal); return word === 'na' ? first.promise : second.promise; } });
  type(view, 'na'); await settle(); type(view, 'maste');
  expect(signals[0].aborted).toBe(true); await settle();
  second.resolve(['new']); await settle(); first.resolve(['old']); await settle();
  expect(transliterationKey.getState(view.state)?.suggestions).toEqual(['new']);
});
test.each([' ', '.'])('invalidates suggestions after punctuation %j', async text => {
  const view = create(); type(view, 'namaste'); await settle(); type(view, text);
  expect(transliterationKey.getState(view.state)?.suggestions).toEqual([]); expect(key(view, 'Enter')).toBe(false);
});
test('clears stale ranges on selection and document changes', async () => {
  const view = create(); type(view, 'namaste'); await settle();
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 5)));
  expect(transliterationKey.getState(view.state)?.suggestions).toEqual([]); await settle();
  expect(key(view, 'Enter')).toBe(false);
});
test('backspace-style transactions refresh suggestions', async () => {
  const getSuggestions = vi.fn((word: string) => [word.toUpperCase()]);
  const view = create({ getSuggestions }); type(view, 'namaste'); await settle();
  view.dispatch(view.state.tr.delete(7, 8)); await settle();
  expect(transliterationKey.getState(view.state)?.suggestions).toEqual(['NAMAST']);
});
test('does not replace partial words or words in code blocks', async () => {
  const getSuggestions = vi.fn(() => ['x']); const view = create({ getSuggestions });
  type(view, 'namaste'); view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3))); await settle();
  expect(getSuggestions).not.toHaveBeenCalled();
  const code = create({ getSuggestions }, undefined, 'code_block'); type(code, 'namaste'); await settle();
  expect(getSuggestions).not.toHaveBeenCalled();
});
test('skips inline code and mixed-script suffixes', async () => {
  const getSuggestions = vi.fn(() => ['x']); const view = create({ getSuggestions });
  view.dispatch(view.state.tr.addStoredMark(schema.marks.code.create())); type(view, 'namaste'); await settle();
  expect(getSuggestions).not.toHaveBeenCalled();
  view.dispatch(view.state.tr.removeStoredMark(schema.marks.code).insertText(' हिंदीabc')); await settle();
  expect(getSuggestions).not.toHaveBeenCalled();
});
test('composition defers requests and does not consume IME Enter', async () => {
  const getSuggestions = vi.fn(() => ['x']); const view = create({ getSuggestions });
  view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); type(view, 'namaste'); await settle();
  expect(getSuggestions).not.toHaveBeenCalled(); expect(key(view, 'Enter', { isComposing: true })).toBe(false);
  view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); await settle();
  expect(getSuggestions).toHaveBeenCalledTimes(1);
});
test('blur cancels requests and removes the active descendant', async () => {
  const view = create(); type(view, 'namaste'); await settle(); view.dom.blur();
  expect(transliterationKey.getState(view.state)?.suggestions).toEqual([]);
  expect(view.dom.hasAttribute('aria-activedescendant')).toBe(false);
});
test('destroy cancels debounce, aborts work, and removes popups', async () => {
  const getSuggestions = vi.fn(() => ['x']); const view = create({ getSuggestions }); type(view, 'hello'); view.destroy(); await settle();
  expect(getSuggestions).not.toHaveBeenCalled(); expect(document.querySelector('[role="listbox"]')).toBeNull();
  const pending = deferred<string[]>(); let signal!: AbortSignal;
  const next = create({ getSuggestions: (_, context) => { signal = context.signal; return pending.promise; } });
  type(next, 'world'); await settle(); next.destroy(); expect(signal.aborted).toBe(true); pending.resolve(['late']); await settle();
  expect(document.querySelector('.transliteration-status')).toBeNull();
});
test('caches a bounded number of words and can disable caching', async () => {
  const getSuggestions = vi.fn((word: string) => [word.toUpperCase()]); const view = create({ getSuggestions, cacheSize: 1 });
  type(view, 'one'); await settle(); type(view, ' one'); await settle(); expect(getSuggestions).toHaveBeenCalledTimes(1);
  type(view, ' two'); await settle(); type(view, ' one'); await settle(); expect(getSuggestions).toHaveBeenCalledTimes(3);
  const uncached = create({ getSuggestions, cacheSize: 0 }); type(uncached, 'one'); await settle(); type(uncached, ' one'); await settle();
  expect(getSuggestions).toHaveBeenCalledTimes(5);
});
test('isolates view state and cleanup when sharing a plugin instance', async () => {
  const plugin = transliterationPlugin({ getSuggestions: word => [word.toUpperCase()], debounceMs: 0 });
  const first = create({}, plugin); type(first, 'one'); await settle();
  const second = create({}, plugin); type(second, 'two'); await settle(); first.destroy();
  expect(transliterationKey.getState(second.state)?.suggestions).toEqual(['TWO']); expect(key(second, 'Enter')).toBe(true);
  expect(second.state.doc.textContent).toBe('TWO'); await settle();
  expect(transliterationKey.getState(second.state)?.suggestions).toEqual([]);
});
test('reports custom provider errors without breaking typing and retries failures', async () => {
  const error = new Error('offline'); const onError = vi.fn(); const getSuggestions = vi.fn(() => { throw error; });
  const view = create({ getSuggestions, onError }); type(view, 'hello'); await settle();
  expect(onError).toHaveBeenCalledWith(error); expect(view.state.doc.textContent).toBe('hello'); expect(key(view, 'Enter')).toBe(false);
  type(view, ' hello'); await settle(); expect(getSuggestions).toHaveBeenCalledTimes(2);
});
test('provides language, count and signal, deduplicates and caps custom results', async () => {
  const getSuggestions = vi.fn((_word: string, _context: SuggestionContext) => ['a', 'a', '', 'b', 'c']);
  const view = create({ getSuggestions, lang: 'bn', numOptions: 2 }); type(view, 'hello'); await settle();
  expect(getSuggestions.mock.calls[0][1]).toMatchObject({ lang: 'bn', numOptions: 2 });
  expect(transliterationKey.getState(view.state)?.suggestions).toEqual(['a', 'b']);
});


test('read-only editors hide suggestions and never accept or request candidates', async () => {
  const getSuggestions = vi.fn(() => ['नमस्ते']); const view = create({ getSuggestions });
  type(view, 'namaste'); await settle();
  view.setProps({ editable: () => false });
  expect(document.querySelector('.transliteration-menu')?.hasAttribute('hidden')).toBe(true);
  expect(key(view, 'Enter')).toBe(false);
  type(view, ' hello'); await settle();
  expect(getSuggestions).toHaveBeenCalledTimes(1);
});
