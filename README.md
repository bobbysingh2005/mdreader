# mdreader

`mdreader` is a small, secure, accessible Node.js command-line tool that renders
a Markdown file as a sanitized, standalone HTML document and opens it in your
default browser. It runs entirely on your machine: no HTTP server, database,
frontend framework, or bundled JavaScript.

Built for everyone, with blind and low-vision users as first-class users.

## Features

- GitHub Flavored Markdown: headings, tables, task lists, nested lists,
  blockquotes, fenced code blocks, strikethrough, and more.
- Strict HTML sanitization with explicit tag, attribute, class, and URL scheme
  allowlists.
- Accessible HTML5 documents with a language attribute, meaningful title,
  heading IDs, semantic tables, image `alt` text, a `main` landmark, and a skip
  link.
- Relative links and images resolve against the **source Markdown file**, even
  though the generated HTML lives in a temporary directory.
- Fragment-only links such as `#installation` keep working.
- Unique temporary output directories that survive long enough for browser
  refreshes, with safe expiration-based cleanup.
- Optional custom output path, `--no-open`, language and title overrides, and
  remote-image blocking.
- TypeScript sources compiled to ES Modules; Node.js built-in test runner.

## Requirements

- Node.js 20 or newer
- npm

## Installation

After the package is published:

```sh
npm install --global mdreader
mdreader README.md
```

Without installing:

```sh
npx mdreader README.md
```

From a source checkout:

```sh
npm install
npm run build
node ./bin/mdreader.js ./README.md
```

## Quick start

```sh
mdreader README.md
mdreader README.md --no-open
mdreader README.md --output ./output/readme.html
mdreader README.md --output ./output/readme.html --no-open
mdreader README.md --lang hi
mdreader README.md --title "Release notes"
mdreader README.md --no-remote-resources
```

## CLI reference

```text
mdreader <file.md|file.markdown> [options]
```

| Option                  | Alias | Description                                                                                 |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `--output <path>`       | `-o`  | Write the HTML file to a custom path. Missing parent directories are created.               |
| `--no-open`             |       | Generate HTML without launching the browser.                                                |
| `--lang <language>`     | `-l`  | Set the document language using a BCP 47 tag such as `en`, `hi`, or `en-IN`. Default: `en`. |
| `--title <title>`       | `-t`  | Override the generated document title.                                                      |
| `--no-cleanup`          |       | Skip cleanup of expired mdreader temporary runs for this execution.                         |
| `--no-remote-resources` |       | Remove remote image sources. Alt text is preserved.                                         |
| `--debug`               |       | Include stack traces for unexpected errors.                                                 |
| `--help`                | `-h`  | Show help.                                                                                  |
| `--version`             | `-v`  | Show the application version.                                                               |

Options accept both `--output path` and `--output=path` forms. Short value
options accept `-o path` and `-o=path`. Use `--` to end option parsing.

Exit codes:

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| `0`  | Success.                                                     |
| `1`  | Runtime failure (file, Markdown, storage, or browser error). |
| `2`  | Invalid command-line usage.                                  |

Errors are written to stderr. Progress messages are written to stdout.

## Supported Markdown

GFM is enabled through `marked`, including:

- ATX and setext headings, with unique IDs generated for every heading.
- Paragraphs, emphasis, strong emphasis, strikethrough, and inline code.
- Ordered, unordered, nested, and task lists.
- Links, images, blockquotes, and horizontal rules.
- Fenced and indented code blocks with language classes.
- Tables with header cells.
- Unicode content, including Hindi and other scripts.

Raw HTML in Markdown is accepted only after sanitization. See
[docs/security.md](docs/security.md).

## How it works

1. Arguments are validated.
2. The input path is resolved, checked for `.md`/`.markdown`, size, and regular
   file status, then read as UTF-8.
3. Markdown is rendered to GFM, heading IDs are generated, and relative URLs are
   resolved against the source file.
4. The rendered fragment is sanitized.
5. A complete accessible HTML5 document is assembled.
6. The document is written to a unique temporary run directory, or to the path
   supplied with `--output`.
7. The file URL is opened in the default browser unless `--no-open` is given.

See [docs/architecture.md](docs/architecture.md) for module-level detail.

## Relative resources and local files

Relative links and images are rewritten to absolute `file://` URLs based on the
directory containing the source Markdown file. This is why an image such as
`![Pet](./images/pet.png)` still works when the generated HTML lives in the OS
temporary directory.

`mdreader` deliberately does **not** use an HTML `<base>` element. A base URL
would cause fragment-only links such as `#installation` to point at the source
directory instead of the generated document. Fragment-only links are left
unchanged.

Browser local-file behavior varies by browser and is outside the CLI's control.
Some browsers restrict cross-directory local subresources or navigations from
`file://` pages. If an image does not load, open the generated HTML from a
location with access to the resource directory, or use a server if your browser
requires one. `mdreader` will not start a server.

`--no-remote-resources` removes `http`/`https` image sources from the output.
The image element and its `alt` text remain so screen-reader users still receive
the description.

## Security

- Every rendered fragment passes through `sanitize-html` with explicit
  allowlists. Markdown parsing is never treated as sanitization.
- `script`, `style`, `iframe`, `object`, `embed`, `svg`, `meta`, `link`, forms,
  and other executable or document-altering elements are removed.
- Inline event handlers and `style` attributes are removed.
- URL schemes are limited to `http`, `https`, `mailto`, `tel`, and `file` for
  links, and `http`, `https`, and `file` for images. `javascript:`, `data:`,
  `vbscript:`, and similar schemes are rejected.
- Custom output refuses to overwrite the input Markdown file, including through
  path aliases, symbolic links, and hard links.
- Temporary cleanup only targets application-owned `run-*` directories, skips
  symbolic links, ignores failures, and never deletes the temp root.
- The input Markdown file is never modified.

Full details: [docs/security.md](docs/security.md).

## Accessibility

- Complete HTML5 document with `<html lang>`, UTF-8 metadata, and a `<title>`.
- `<main>` landmark, `<article>`, and a skip link to the main content.
- Native semantic elements instead of unnecessary ARIA.
- Heading hierarchy preserved and every heading receives a stable unique ID.
- Tables remain semantic (`table`, `thead`, `tbody`, `th`, `td`).
- Code blocks remain `pre`/`code` with language classes.
- Link text and image `alt` text are preserved; images without alt text get an
  empty `alt` attribute instead of a misleading filename.
- No JavaScript. The document is fully readable with CSS disabled.
- Support for document languages such as `hi` and `en-IN`, plus Unicode text.

Full details: [docs/accessibility.md](docs/accessibility.md).

## Temporary files

By default, output is written to:

```text
<os temp directory>/mdreader/run-XXXXXX/index.html
```

Each execution gets a unique directory created with `mkdtemp()`. Generated HTML
is never deleted immediately after launch, so refreshing the browser keeps
working. Expired runs older than 24 hours are removed at the start of a later
execution unless `--no-cleanup` is used. Cleanup ignores failures and never
touches unrelated files.

## Custom output

With `--output`, `mdreader`:

- resolves the path to an absolute path,
- creates missing parent directories,
- writes UTF-8 HTML,
- overwrites an existing HTML file at that exact path (documented policy),
- refuses to write over the input Markdown file,
- reports the final absolute path.

## Troubleshooting

| Problem                   | What to try                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Input file not found`    | Check the path. Relative paths are resolved from the current directory.                               |
| `Unsupported file type`   | Use a `.md` or `.markdown` file.                                                                      |
| `Input file is too large` | The limit is 5 MiB. Split the document or raise the limit in `src/config.ts` if you maintain a build. |
| Browser did not open      | The HTML is retained and its absolute path is printed in the error. Open it manually.                 |
| Image missing             | The browser may restrict local `file://` subresources. See the relative-resource notes above.         |
| Raw HTML disappeared      | Sanitization removes unsafe elements and attributes by design.                                        |
| Need a stack trace        | Add `--debug` or set `MDREADER_DEBUG=1`.                                                              |

## Development

```sh
npm install
npm run build       # compile src/*.ts -> bin/*.js
npm run typecheck   # TypeScript, no emit
npm test            # build, then run the Node.js test suite
npm run check       # Prettier check, typecheck, and tests
npm start -- ./README.md
```

Source layout:

```text
src/
  mdreader.ts   entry point and error boundary
  cli.ts        workflow orchestration
  args.ts       argument parsing and validation
  config.ts     defaults, limits, version, exit codes
  errors.ts     typed errors and formatting
  file.ts       input validation and UTF-8 reading
  markdown.ts   GFM, heading IDs, titles, URL resolution
  sanitizer.ts  sanitization policy
  html.ts       accessible document shell
  temp.ts       temp runs, cleanup, custom output
  browser.ts    file URLs and browser launch
test/           Node.js built-in tests
docs/           architecture, security, accessibility
```

Tests never open a real browser; the launcher is injected.

## Publishing

```sh
npm run check
npm publish
```

`prepublishOnly` runs the build. The published package exposes
`bin/mdreader.js` as the `mdreader` executable and includes `bin/`, `docs/`,
`README.md`, and `LICENSE`.

## License

MIT. See [LICENSE](LICENSE).
