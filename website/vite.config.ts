import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  resolve: { alias: { 'prosemirror-transliterate': fileURLToPath(new URL('../src/index.ts', import.meta.url)) } },
  build: {
    outDir: 'dist', emptyOutDir: true,
    rollupOptions: { input: [root + 'index.html', ...readdirSync(root + 'docs').filter(name => name.endsWith('.html')).map(name => root + 'docs/' + name)] },
  },
});
