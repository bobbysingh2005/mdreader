# mdreader

A lightweight Markdown reader CLI that renders a document and opens it in your
default browser.

## Requirements

- Node.js 20 or newer
- pnpm

## Install dependencies

```sh
pnpm install
```

## Use

```sh
pnpm build
pnpm start -- ./README.md
```

After building, the CLI can also be run directly:

```sh
node ./dist/index.js ./README.md
```

The CLI accepts `.md` and `.markdown` files. Use `--help` to display usage.
Relative links and images are resolved from the directory containing the source
document.

## Development

```sh
pnpm check
```

`pnpm build` compiles the strict TypeScript sources in `src/` to `dist/`.
`pnpm check` verifies formatting and types, builds the project, and runs the
Node.js test suite.

Markdown is converted to HTML and sanitized before it is opened. Generated
documents are written to a unique directory in the operating system's temporary
folder so the browser can read them; files are removed if opening the browser
fails.
