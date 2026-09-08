# prosemirror-transliterate

Type with a familiar keyboard. Choose a suggestion in another script, directly inside ProseMirror.

A small TypeScript plugin with keyboard and mouse selection, debounced requests, cancellation, a bounded per-editor cache, and a replaceable suggestion provider. It transliterates sounds; it does **not** translate meanings.

```ts
import { transliterationPlugin } from 'prosemirror-transliterate';
import 'prosemirror-transliterate/style.css';

const plugin = transliterationPlugin({ lang: 'hi' });
// Add plugin before keymaps in your EditorState's plugins array.
```

**Release status:** this repository is a local development build (`0.0.0`). Registry availability is not assumed. To try it now, run `pnpm install && pnpm site:dev` here, or build a tarball with `pnpm build && npm pack` and install that tarball in your app. After publishing, consumers can use `npm install prosemirror-transliterate prosemirror-state prosemirror-view`.

## Start here

- [Quick start](docs/quick-start.md): a complete editor and local installation.
- [API reference](docs/api.md): options, exports, keyboard controls, and behavior.
- [Custom providers](docs/providers.md): use your own service or an offline vocabulary.
- [How it works](docs/how-it-works.md): learn ProseMirror state and async plugin design.
- [Agent integration prompt](docs/agent-prompt.md): copy into your coding agent.
- [Cloudflare deployment](docs/deployment.md): deploy the documentation website.
- [Release checklist](docs/releasing.md): validate and publish the npm package.

## Provider choice

The default adapter sends the current Latin word to the **unofficial Google Input Tools endpoint**. Availability, browser CORS behavior, and language support are outside this package's control. This is not an official Google SDK or a production service guarantee. Normal typing continues if it fails. Use `getSuggestions` for a service you control or offline use; never put provider secrets in a browser bundle.

The website starts with an explicitly labeled, limited offline demo. It uses the same plugin source as the package and requires a deliberate switch to enable Google requests.

## Development

Requires Node.js 22+ and pnpm 10.12.1.

```sh
pnpm install
pnpm check           # types, unit tests, package, and website build
pnpm test:coverage   # includes minimum coverage thresholds
pnpm test:package    # tarball exports, SSR import, and consumer types
pnpm exec playwright install chromium
pnpm test:e2e        # desktop + mobile Chromium against the built site
pnpm site:dev        # local playground and guides
pnpm site:check      # build + Cloudflare deployment dry run
```

The library builds to `dist/`; the static website builds to `website/dist/`. ProseMirror is a peer dependency and is not bundled into the library. Only the library, guides, README, and license enter the npm tarball. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Compatibility

ES modules with TypeScript declarations. Requires ProseMirror State 1.4.4+ and View 1.41.6+ within their 1.x lines. Importing the library is safe without a DOM; creating an `EditorView` requires a browser. The original `NewtransliterationPlugin` export remains as a deprecated alias.

MIT © Pratik Sharma
