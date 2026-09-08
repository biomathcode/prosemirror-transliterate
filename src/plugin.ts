import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { getTransliterateSuggestions } from './suggestions';
import type { Language } from './suggestions';

export interface SuggestionContext {
  lang: Language;
  numOptions: number;
  signal: AbortSignal;
}
export type SuggestionProvider = (word: string, context: SuggestionContext) => Promise<readonly string[]> | readonly string[];
export interface TransliterationOptions {
  lang?: Language;
  numOptions?: number;
  debounceMs?: number;
  /** Maximum number of words cached per editor. Set to 0 to disable. */
  cacheSize?: number;
  /** Defaults to the optional, unofficial Google Input Tools adapter. */
  getSuggestions?: SuggestionProvider;
  /** Called for custom provider failures; never called for cancellation. */
  onError?: (error: unknown) => void;
}
export interface TransliterationState {
  readonly suggestions: readonly string[];
  readonly index: number;
  readonly from: number;
  readonly to: number;
  readonly word: string | null;
}
type Word = { word: string; from: number; to: number };
type Action = { type: 'show'; target: Word; suggestions: readonly string[] }
  | { type: 'move'; dir: number } | { type: 'clear' } | { type: 'accept' };
const empty = (): TransliterationState => ({ suggestions: [], index: 0, from: 0, to: 0, word: null });
export const transliterationKey = new PluginKey<TransliterationState>('transliteration');
let popupId = 0;

function detectWord(state: EditorState): Word | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code || $from.marks().some(mark => mark.type.spec.code)) return null;
  // Only inspect the current text block. Inline atoms are word boundaries.
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
  const after = $from.parent.textBetween($from.parentOffset, $from.parent.content.size, undefined, '\ufffc');
  if (/^[\p{L}\p{M}\p{N}_]/u.test(after)) return null;
  const match = before.match(/(?:^|[^\p{L}\p{M}\p{N}_])([a-zA-Z]+)$/u);
  if (!match) return null;
  return { word: match[1], from: $from.pos - match[1].length, to: $from.pos };
}
function matches(a: Word | null, b: Word): boolean {
  return !!a && a.word === b.word && a.from === b.from && a.to === b.to;
}
function bounded(value: number | undefined, fallback: number, max: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : Math.max(0, Math.min(max, Math.floor(value)));
}

/** Add once per editor, before keymaps that handle Enter and Space. */
export function transliterationPlugin(options: TransliterationOptions = {}): Plugin<TransliterationState> {
  const lang = options.lang ?? 'hi';
  const numOptions = Math.max(1, bounded(options.numOptions, 5, 10));
  const debounceMs = bounded(options.debounceMs, 150, 10_000);
  const cacheSize = bounded(options.cacheSize, 100, 10_000);
  const provider: SuggestionProvider = options.getSuggestions ?? ((word, context) =>
    getTransliterateSuggestions(word, { ...context, showCurrentWordAsLastSuggestion: false }));
  // Every EditorView owns its async work, even when a plugin instance is shared.
  const controllers = new WeakMap<EditorView, { cancel: () => void; schedule: () => void; composing: boolean; accepting: boolean; pending: () => boolean }>();
  function clear(view: EditorView) {
    controllers.get(view)?.cancel();
    if (transliterationKey.getState(view.state)?.suggestions.length) {
      view.dispatch(view.state.tr.setMeta(transliterationKey, { type: 'clear' } satisfies Action));
    }
  }
  function accept(view: EditorView, index: number, space = false): boolean {
    const state = transliterationKey.getState(view.state);
    if (!view.editable || !state?.word || !matches(detectWord(view.state), { word: state.word, from: state.from, to: state.to })) return false;
    const value = state.suggestions[index];
    if (value === undefined) return false;
    const controller = controllers.get(view);
    controller?.cancel();
    if (controller) controller.accepting = true;
    try {
      view.dispatch(view.state.tr.insertText(value + (space ? ' ' : ''), state.from, state.to)
        .setMeta(transliterationKey, { type: 'accept' } satisfies Action).scrollIntoView());
      view.focus();
    } finally {
      if (controller) controller.accepting = false;
    }
    return true;
  }
  return new Plugin<TransliterationState>({
    key: transliterationKey,
    state: {
      init: empty,
      apply(tr, previous) {
        const action = tr.getMeta(transliterationKey) as Action | undefined;
        if (action?.type === 'show') return { ...action.target, suggestions: [...action.suggestions], index: 0 };
        if (action?.type === 'clear' || action?.type === 'accept') return empty();
        // Never retain a replacement range across document or selection changes.
        if (tr.docChanged || tr.selectionSet) return previous.word ? empty() : previous;
        if (action?.type === 'move' && previous.suggestions.length) {
          return { ...previous, index: (previous.index + action.dir + previous.suggestions.length) % previous.suggestions.length };
        }
        return previous;
      },
    },
    props: {
      handleKeyDown(view, event) {
        const controller = controllers.get(view);
        if (!view.editable || event.isComposing || view.composing || controller?.composing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
        const state = transliterationKey.getState(view.state);
        if (event.key === 'Escape' && (state?.suggestions.length || controller?.pending())) {
          clear(view);
          return true;
        }
        if (!state?.suggestions.length) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          view.dispatch(view.state.tr.setMeta(transliterationKey, { type: 'move', dir: event.key === 'ArrowDown' ? 1 : -1 } satisfies Action));
          return true;
        }
        if (event.key === 'Enter' || event.key === ' ') return accept(view, state.index, event.key === ' ');
        return false;
      },
      handleDOMEvents: {
        blur(view) { clear(view); return false; },
        focus(view) { controllers.get(view)?.schedule(); return false; },
        compositionstart(view) {
          const controller = controllers.get(view);
          if (controller) controller.composing = true;
          clear(view);
          return false;
        },
        compositionend(view) {
          const controller = controllers.get(view);
          if (controller) { controller.composing = false; controller.schedule(); }
          return false;
        },
      },
    },
    view(view) {
      const doc = view.dom.ownerDocument;
      const win = doc.defaultView;
      const popup = doc.createElement('div');
      popup.className = 'transliteration-menu';
      popup.id = `transliteration-${++popupId}`;
      popup.setAttribute('role', 'listbox');
      popup.setAttribute('aria-label', 'Transliteration suggestions');
      popup.hidden = true;
      popup.style.position = 'fixed';
      doc.body.appendChild(popup);
      const status = doc.createElement('div');
      status.className = 'transliteration-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      doc.body.appendChild(status);
      const cache = new Map<string, readonly string[]>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: AbortController | undefined;
      let generation = 0;
      let destroyed = false;
      let lastState: TransliterationState | undefined;
      let wasEditable = view.editable;
      const originalAttributes = new Map(['aria-controls', 'aria-activedescendant'].map(name => [name, view.dom.getAttribute(name)]));
      function restoreAttributes() {
        originalAttributes.forEach((value, name) => value === null ? view.dom.removeAttribute(name) : view.dom.setAttribute(name, value));
      }
      function cancel() {
        generation++;
        clearTimeout(timer);
        timer = undefined;
        abort?.abort();
        abort = undefined;
      }
      function position() {
        if (popup.hidden || destroyed) return;
        const state = transliterationKey.getState(view.state);
        if (!state?.word) return;
        const coords = view.coordsAtPos(state.to);
        const width = win?.innerWidth ?? 1024;
        const height = win?.innerHeight ?? 768;
        popup.style.left = `${Math.max(8, Math.min(coords.left, width - popup.offsetWidth - 8))}px`;
        popup.style.top = `${Math.max(8, coords.bottom + popup.offsetHeight + 8 > height ? coords.top - popup.offsetHeight - 6 : coords.bottom + 6)}px`;
      }
      function render() {
        const state = transliterationKey.getState(view.state);
        if (state === lastState && wasEditable === view.editable) { position(); return; }
        wasEditable = view.editable;
        lastState = state;
        popup.replaceChildren();
        popup.hidden = !view.editable || !state?.suggestions.length;
        if (!state || popup.hidden) { restoreAttributes(); status.textContent = ''; return; }
        state.suggestions.forEach((suggestion, index) => {
          const item = doc.createElement('div');
          item.className = 'transliteration-item';
          item.id = `${popup.id}-${index}`;
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(index === state.index));
          item.textContent = suggestion;
          item.addEventListener('mousedown', event => { event.preventDefault(); accept(view, index); });
          popup.appendChild(item);
        });
        view.dom.setAttribute('aria-controls', popup.id);
        view.dom.setAttribute('aria-activedescendant', `${popup.id}-${state.index}`);
        status.textContent = `${state.suggestions.length} suggestions. ${state.suggestions[state.index]}. Use arrow keys to choose, Enter to insert, Escape to dismiss.`;
        position();
      }
      function schedule() {
        cancel();
        if (destroyed || controller.composing || controller.accepting || !view.hasFocus() || !view.editable) return;
        const target = detectWord(view.state);
        if (!target) return;
        const id = generation;
        timer = setTimeout(async () => {
          timer = undefined;
          if (destroyed || id !== generation || view.composing || !view.hasFocus() || !view.editable) return;
          const request = new AbortController();
          abort = request;
          try {
            const cached = cache.get(target.word);
            const values = cached ?? await provider(target.word, { lang, numOptions, signal: request.signal });
            if (destroyed || id !== generation || request.signal.aborted || !view.hasFocus() || !view.editable || !matches(detectWord(view.state), target)) return;
            const suggestions = [...new Set(values.filter(item => typeof item === 'string' && item.length > 0))].slice(0, numOptions);
            if (cacheSize && suggestions.length) {
              cache.delete(target.word);
              cache.set(target.word, suggestions);
              if (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
            }
            view.dispatch(view.state.tr.setMeta(transliterationKey, { type: 'show', target, suggestions } satisfies Action).setMeta('addToHistory', false));
          } catch (error) {
            if (!destroyed && id === generation && !request.signal.aborted) {
              // Error reporting must not create an unhandled rejection in the editor.
              try { options.onError?.(error); } catch { /* ignore consumer callback errors */ }
            }
          } finally {
            if (abort === request) abort = undefined;
          }
        }, debounceMs);
      }
      const controller = { cancel, schedule, composing: false, accepting: false, pending: () => timer !== undefined || abort !== undefined };
      controllers.set(view, controller);
      win?.addEventListener('resize', position);
      doc.addEventListener('scroll', position, true);
      render();
      return {
        update(currentView, previous) {
          if (!currentView.editable) cancel();
          const docChanged = !currentView.state.doc.eq(previous.doc);
          const selectionChanged = !currentView.state.selection.eq(previous.selection);
          if (docChanged || selectionChanged) {
            if (controller.accepting) cancel();
            else schedule();
          }
          render();
        },
        destroy() {
          destroyed = true;
          cancel();
          cache.clear();
          controllers.delete(view);
          win?.removeEventListener('resize', position);
          doc.removeEventListener('scroll', position, true);
          restoreAttributes();
          popup.remove();
          status.remove();
        },
      };
    },
  });
}
