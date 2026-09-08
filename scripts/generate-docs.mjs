import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { marked } from 'marked';
const root = new URL('../', import.meta.url);
const guides = [
  ['quick-start', 'Quick start'], ['api', 'API reference'], ['providers', 'Custom providers'],
  ['how-it-works', 'How it works'], ['agent-prompt', 'Agent prompt'], ['deployment', 'Cloudflare deployment'], ['releasing', 'Release checklist'],
];
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
await mkdir(new URL('website/docs/', root), { recursive: true });
let full = '# prosemirror-transliterate\n\nDevelopment build 0.0.0. Provider-agnostic transliteration for ProseMirror.\n\n';
for (const [slug, title] of guides) {
  const markdown = await readFile(new URL(`docs/${slug}.md`, root), 'utf8');
  full += markdown + '\n\n---\n\n';
  let codeId = 0;
  const content = marked(markdown.replace(/\]\(([a-z-]+)\.md\)/g, ']($1.html)')).replace(/<pre><code/g, () => `<pre tabindex="0" id="snippet-${++codeId}"><code`).replace(/(<pre tabindex="0" id="([^"]+)">[\s\S]*?<\/pre>)/g, '$1<div class="docs-copy-row"><button class="docs-copy" data-copy="$2">Copy code ⧉</button></div>');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(title)} for prosemirror-transliterate: practical developer documentation and examples."><meta name="theme-color" content="#244a37"><title>${escape(title)} · ProseMirror Transliterate</title><link rel="icon" href="/favicon.svg"></head><body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header shell"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">अ<span>a</span></span><span>prosemirror<span class="brand-bottom">transliterate</span></span></a><nav aria-label="Main navigation"><a href="/#playground">Playground</a><a href="/docs/quick-start.html">Documentation</a><a href="/docs/agent-prompt.html">For agents ↗</a></nav><a class="github-link" href="https://github.com/biomathcode/prosemirror-transliterate">GitHub ↗</a></header>
<div class="docs-layout shell"><nav class="docs-sidebar" aria-label="Documentation"><p class="eyebrow">THE DEVELOPER GUIDE</p>${guides.map(([path, name]) => `<a href="/docs/${path}.html" ${path === slug ? 'aria-current="page"' : ''}>${name}</a>`).join('')}</nav>
<main class="docs-article" id="main"><div class="docs-tools"><span>PROSEMIRROR TRANSLITERATE / DOCS</span><a href="/llms-full.txt">Agent-readable docs ↗</a></div>${slug === 'agent-prompt' ? '<button class="button primary" id="copy-agent">Copy the agent prompt ⧉</button><p></p>' : ''}${content}</main></div>
<footer class="site-footer shell"><a class="brand footer-brand" href="/">prosemirror / transliterate</a><div><a href="/docs/deployment.html">Deploy on Cloudflare ↗</a><a href="https://github.com/biomathcode/prosemirror-transliterate">Source ↗</a><span>MIT License</span></div></footer><div class="toast" id="toast" role="status" hidden></div><script type="module" src="/src/main.ts"></script></body></html>`;
  await writeFile(new URL(`website/docs/${slug}.html`, root), html);
}
await writeFile(new URL('website/public/llms-full.txt', root), full);
await writeFile(new URL('website/public/llms.txt', root), `# prosemirror-transliterate\n\n> Provider-agnostic ProseMirror transliteration plugin. Development build 0.0.0; use a local tarball until published.\n\n## Documentation\n\n${guides.map(([slug, title]) => `- [${title}](/docs/${slug}.html)`).join('\n')}\n- [Complete documentation](/llms-full.txt)\n- [Copyable integration prompt](/agent-prompt.md)\n\nDefault provider: unofficial Google Input Tools. Custom providers can keep input offline. The Language type is not a verified provider support matrix.\n`);
await writeFile(new URL('website/public/agent-prompt.md', root), await readFile(new URL('docs/agent-prompt.md', root)));
console.log(`Generated ${guides.length} guides and agent-readable documentation.`);
