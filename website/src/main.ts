import './style.css';

const examples = {
  basic: `import { transliterationPlugin } from
  'prosemirror-transliterate';
import 'prosemirror-transliterate/style.css';

// Add before your editor's keymaps.
const plugin = transliterationPlugin({
  lang: 'hi',
  debounceMs: 150,
});`,
  provider: `import { transliterationPlugin } from
  'prosemirror-transliterate';

// A tiny vocabulary. No network needed.
const words: Record<string, string[]> = {
  namaste: ['नमस्ते', 'नमस्कार'],
};

const plugin = transliterationPlugin({
  getSuggestions: word => words[word] ?? [],
});`,
};
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function highlight(text: string) {
  return text.split(/(\/\/[^\n]*|'[^'\n]*'|\b(?:import|from|const|return|async|await)\b|\b\d+\b)/g).map(part => {
    const kind = part.startsWith('//') ? 'comment' : part.startsWith("'") ? 'string' : /^(import|from|const|return|async|await)$/.test(part) ? 'keyword' : /^\d+$/.test(part) ? 'number' : null;
    return kind ? `<span class="token-${kind}">${escape(part)}</span>` : escape(part);
  }).join('');
}
const code = document.querySelector<HTMLElement>('#code-example');
function chooseExample(name: keyof typeof examples) {
  if (!code) return;
  code.innerHTML = `<code>${highlight(examples[name])}</code>`;
  code.setAttribute('aria-labelledby', `tab-${name}`);
  document.querySelectorAll<HTMLButtonElement>('[data-example]').forEach(button => {
    const active = button.dataset.example === name;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
  });
}
if (code) chooseExample('basic');
document.querySelectorAll<HTMLButtonElement>('[data-example]').forEach(button => {
  button.addEventListener('click', () => chooseExample(button.dataset.example as keyof typeof examples));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'basic' : event.key === 'End' ? 'provider' : button.dataset.example === 'basic' ? 'provider' : 'basic';
    chooseExample(next); document.querySelector<HTMLButtonElement>(`#tab-${next}`)?.focus();
  });
});
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  const el = document.querySelector<HTMLElement>('#toast'); if (!el) return;
  clearTimeout(toastTimer); el.textContent = message; el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
  catch { toast('Clipboard unavailable. Select the text and copy it manually.'); }
}
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button => {
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.copy!);
    if (target) void copy(target.textContent ?? '');
  });
});
document.querySelector<HTMLButtonElement>('#copy-agent')?.addEventListener('click', async () => {
  try {
    const response = await fetch('/agent-prompt.md');
    if (!response.ok) throw new Error('Prompt unavailable');
    const markdown = await response.text();
    const prompt = markdown.match(/```text\n([\s\S]*?)```/)?.[1];
    if (!prompt) throw new Error('Prompt unavailable');
    await copy(prompt.trim());
  } catch { toast('Could not load the prompt. Open “Read it first” to copy it.'); }
});
// Documentation stays lightweight: load the editor only on the playground page.
if (document.querySelector('#editor')) {
  void import('./playground').then(module => module.mountPlayground()).catch(() => {
    const message = document.querySelector('#editor-message');
    if (message) message.textContent = 'The editor could not load. Reload this page to try again.';
  });
}
