import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { history, undo, redo } from 'prosemirror-history';
import { baseKeymap } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { transliterationPlugin, getTransliterateSuggestions } from 'prosemirror-transliterate';
import type { Language, SuggestionProvider } from 'prosemirror-transliterate';
import 'prosemirror-view/style/prosemirror.css';

type DemoLanguage = 'hi' | 'bn' | 'ta' | 'te';
const vocabulary: Record<DemoLanguage, Record<string, string[]>> = {
  hi: { namaste: ['नमस्ते', 'नमस्कार'], duniya: ['दुनिया'], dhanyavaad: ['धन्यवाद'], bharat: ['भारत'], pyaar: ['प्यार'] },
  bn: { nomoshkar: ['নমস্কার'], bhalobasha: ['ভালোবাসা'], dhonnobad: ['ধন্যবাদ'] },
  ta: { vanakkam: ['வணக்கம்'], nandri: ['நன்றி'], tamil: ['தமிழ்'] },
  te: { namaskaram: ['నమస్కారం'], dhanyavadalu: ['ధన్యవాదాలు'], telugu: ['తెలుగు'] },
};

export function mountPlayground() {
  const host = document.querySelector<HTMLElement>('#editor')!;
  const language = document.querySelector<HTMLSelectElement>('#language')!;
  const provider = document.querySelector<HTMLSelectElement>('#provider')!;
  const placeholder = document.querySelector<HTMLElement>('#editor-placeholder')!;
  const message = document.querySelector<HTMLElement>('#editor-message')!;
  const note = document.querySelector<HTMLElement>('#provider-note')!;
  const sampleWords = document.querySelector<HTMLElement>('#sample-words')!;
  let view: EditorView;
  const getSuggestions: SuggestionProvider = async (word, context) => {
    if (provider.value === 'offline') {
      const result = vocabulary[context.lang as DemoLanguage]?.[word.toLowerCase()] ?? [];
      if (!context.signal.aborted) message.textContent = result.length ? 'Suggestions are ready. Use the arrow keys, then Enter.' : 'That word is outside the sample vocabulary. Try one of the words on the left.';
      return result;
    }
    message.textContent = 'Looking up suggestions…';
    const result = await getTransliterateSuggestions(word, { ...context, showCurrentWordAsLastSuggestion: false });
    if (!context.signal.aborted) message.textContent = result.length ? 'Live suggestions are ready. Use the arrow keys, then Enter.' : 'No live suggestions returned. Try another word or switch to the offline demo.';
    return result;
  };
  function plugin() { return transliterationPlugin({ lang: language.value as Language, getSuggestions, cacheSize: 0 }); }
  let activePlugin = plugin();
  view = new EditorView(host, {
    state: EditorState.create({ schema, plugins: [activePlugin, history(), keymap({ 'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo }), keymap(baseKeymap)] }),
    attributes: { role: 'textbox', 'aria-label': 'Transliteration playground', 'aria-multiline': 'true', 'aria-describedby': 'provider-note', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off' },
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr));
      placeholder.hidden = view.state.doc.textContent.length > 0;
      if (tr.docChanged) message.textContent = view.state.doc.textContent ? 'Keep typing, or pause at the end of a sample word.' : 'Ready when you are. Try a sample word to see suggestions.';
    },
  });
  function reconfigure() {
    const next = plugin();
    view.updateState(view.state.reconfigure({ plugins: view.state.plugins.map(item => item === activePlugin ? next : item) }));
    activePlugin = next;
    note.textContent = provider.value === 'offline' ? 'A small sample vocabulary. Your words stay in this browser.' : 'Live mode sends the active word to Google’s unofficial Input Tools endpoint.';
    message.textContent = 'Updated. Type a new word or choose a sample.';
  }
  function samples() {
    const words = Object.keys(vocabulary[language.value as DemoLanguage]).slice(0, 3);
    sampleWords.replaceChildren(...words.map(word => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.word = word;
      button.append(word + ' '); const arrow = document.createElement('span'); arrow.textContent = '↗'; button.append(arrow);
      return button;
    }));
    placeholder.textContent = `Start with ${words[0]}…`;
  }
  sampleWords.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-word]');
    if (!button) return;
    view.focus();
    const end = view.state.doc.content.size - 1;
    const prefix = view.state.doc.textContent && !/\s$/.test(view.state.doc.textContent) ? ' ' : '';
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)).insertText(prefix + button.dataset.word));
  });
  document.querySelector('#clear-editor')!.addEventListener('click', () => {
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, schema.node('paragraph')));
    view.focus();
  });
  language.addEventListener('change', () => { reconfigure(); samples(); });
  provider.addEventListener('change', reconfigure);
  samples();
  // pagehide can be persisted in the back/forward cache; retain the view in that case.
  window.addEventListener('pagehide', event => { if (!event.persisted) view.destroy(); });
}
