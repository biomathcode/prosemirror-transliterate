import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'transliterate-consumer-'));
try {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary, '--cache', join(temporary, 'cache')], { cwd: root, encoding: 'utf8' }));
  const files = pack.files.map(item => item.path);
  for (const file of ['dist/index.mjs', 'dist/index.d.mts', 'dist/style.css', 'README.md', 'LICENSE', 'docs/agent-prompt.md']) assert(files.includes(file), `Missing ${file}`);
  assert(!files.some(file => /^(website|node_modules|tests|src)\//.test(file)), 'Development assets leaked into tarball');
  const modules = join(temporary, 'node_modules');
  await mkdir(modules);
  execFileSync('tar', ['-xzf', join(temporary, pack.filename), '-C', temporary]);
  await symlink(join(temporary, 'package'), join(modules, 'prosemirror-transliterate'));
  for (const name of ['prosemirror-state', 'prosemirror-view']) await symlink(join(root, 'node_modules', name), join(modules, name));
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ type: 'module' }));
  await writeFile(join(temporary, 'smoke.mjs'), `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transliterationPlugin, NewtransliterationPlugin, getTransliterateSuggestions } from 'prosemirror-transliterate';
assert.equal(typeof document, 'undefined');
assert.equal(typeof transliterationPlugin, 'function');
assert.equal(NewtransliterationPlugin, transliterationPlugin);
assert.equal(typeof getTransliterateSuggestions, 'function');
assert(transliterationPlugin({ getSuggestions: () => [] }));
assert(readFileSync(new URL(import.meta.resolve('prosemirror-transliterate/style.css')), 'utf8').includes('.transliteration-menu'));
`);
  execFileSync(process.execPath, [join(temporary, 'smoke.mjs')], { cwd: temporary, stdio: 'inherit' });
  await writeFile(join(temporary, 'consumer.mts'), `
import { transliterationPlugin, transliterationKey, type SuggestionProvider, type TransliterationOptions } from 'prosemirror-transliterate';
const getSuggestions: SuggestionProvider = (word, { signal, lang }) => signal.aborted ? [] : [word + lang];
const options: TransliterationOptions = { lang: 'hi', getSuggestions };
const plugin = transliterationPlugin(options);
void plugin; void transliterationKey;
`);
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(temporary, 'consumer.mts')], { cwd: temporary, stdio: 'inherit' });
  console.log(`Package consumer checks passed: ${files.length} files, ${(pack.size / 1024).toFixed(1)} KiB tarball. ESM, SSR import, CSS export, and TypeScript declarations resolve.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
