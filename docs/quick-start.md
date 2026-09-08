# Quick start

Add transliteration to an existing ProseMirror editor in one plugin. Your schema and document format stay yours.

## Install locally

This checkout is a development build. Build and pack it before installing in another project:

```sh
# In this repository
pnpm install
pnpm build
npm pack

# In your application: replace the path with the generated tarball path
npm install /absolute/path/prosemirror-transliterate-0.0.0.tgz
npm install prosemirror-state prosemirror-view prosemirror-model prosemirror-schema-basic prosemirror-keymap prosemirror-commands
```

Once a release has been published to npm, replace the tarball installation with `npm install prosemirror-transliterate`.

## Create an editor

Add `<div id="editor"></div>` to your page. Use a bundler that supports CSS imports, such as Vite.

```ts
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { transliterationPlugin } from 'prosemirror-transliterate';
import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-transliterate/style.css';

const element = document.querySelector('#editor');
if (!element) throw new Error('Missing editor element');

const view = new EditorView(element, {
  state: EditorState.create({
    schema,
    plugins: [
      transliterationPlugin({ lang: 'hi', debounceMs: 150 }),
      keymap(baseKeymap),
    ],
  }),
  attributes: {
    role: 'textbox',
    'aria-label': 'Document editor',
    'aria-multiline': 'true',
  },
});

// On route change or component unmount:
// view.destroy();
```

The default provider sends the active Latin word to Google Input Tools. For sensitive text or a production integration, choose and configure a provider appropriate for your application. See [custom providers](providers.md).

## Try a word

Focus the editor and type `namaste`. Once suggestions arrive, use ↑ / ↓ to select, Enter to insert, or Space to insert with a trailing space. Escape closes the menu and cancels a pending request. Mouse selection keeps focus in the editor.

When there are no suggestions, the plugin leaves normal key handling to the editor. It does not hold Space while a request is pending. If you type a space before suggestions arrive, your original text remains.

## Add to an existing editor

Put `transliterationPlugin()` before other keymaps that consume Enter, Space, or the arrow keys. Add it once per editor state. Include both the core ProseMirror stylesheet and the small popup stylesheet. Do not copy implementation source into your application.

In a React or Vue application, create the `EditorView` on mount and destroy it during cleanup. Importing the package is safe during SSR; do not instantiate an editor until the DOM is available. Preserve your application's existing state ownership and transaction dispatch pattern.

## Change language

Options are fixed for a plugin instance. Create a new plugin when the language or provider changes and reconfigure the state, preserving other plugins:

```ts
const previousPlugin = plugin; // Track this reference in your integration.
plugin = transliterationPlugin({ lang: 'bn' });
view.updateState(view.state.reconfigure({
  plugins: view.state.plugins.map(item => item === previousPlugin ? plugin : item),
}));
```

This is a replacement pattern, not a complete snippet: initialize `plugin` when creating your editor. Reconfiguration destroys the old view resources and cancels pending work. In collaborative editors, remote document changes also invalidate the active suggestion range.
