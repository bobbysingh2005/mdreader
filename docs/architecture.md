# Architecture

`mdreader` is intentionally small. It composes focused modules instead of
introducing layers, servers, or frameworks.

## Lifecycle

1. **Process start.** `bin/mdreader.js` (built from `src/mdreader.ts`) runs
   `run(process.argv.slice(2))`. It owns the only process-level error boundary
   and the only place that assigns `process.exitCode`.
2. **Parse.** `src/args.ts` validates argv and returns a `ParsedArguments`
   object. `--help` and `--version` short-circuit the workflow. Parsing is pure:
   it never prints, reads files, or exits.
3. **Cleanup.** `src/cli.ts` asks `src/temp.ts` to remove expired `run-*`
   directories unless `--no-cleanup` was supplied. Cleanup failures are ignored.
4. **Read.** `src/file.ts` resolves the path, checks the extension, regular-file
   status, and size limit, then reads UTF-8 asynchronously. The input is never
   written.
5. **Render.** `src/markdown.ts` lexes GFM, generates unique heading IDs, builds
   a URL transformer against the source file URL, extracts a default title, and
   parses the tokens to an HTML fragment.
6. **Sanitize.** `src/sanitizer.ts` applies explicit allowlists and URL scheme
   validation. It accepts an optional URL transformer so policy and resource
   resolution stay independent.
7. **Generate.** `src/html.ts` wraps the sanitized fragment in a complete
   accessible HTML5 document.
8. **Store.** `src/temp.ts` creates a unique run directory and writes
   `index.html`, or validates and writes a custom `--output` path.
9. **Open.** `src/browser.ts` converts the file path to a file URL and launches
   the default browser through `open`, unless `--no-open` was given.
10. **Report.** Progress goes to stdout. Errors are formatted by
    `src/errors.ts`, written to stderr by the entry point, and mapped to exit
    codes 1 (runtime) or 2 (usage).

## Module responsibilities

| Module         | Responsibility                                       | Depends on                      |
| -------------- | ---------------------------------------------------- | ------------------------------- |
| `mdreader.ts`  | Shebang, top-level error boundary, exit code.        | `cli`, `config`, `errors`       |
| `cli.ts`       | Orchestration and dependency injection.              | all workflow modules            |
| `args.ts`      | Pure argv parsing/validation, help text.             | `config`, `errors`              |
| `config.ts`    | Defaults, limits, retention, version, exit codes.    | `package.json`                  |
| `errors.ts`    | Error hierarchy and formatting.                      | `config`                        |
| `file.ts`      | Path validation, size checks, UTF-8 reading.         | `config`, `errors`              |
| `markdown.ts`  | GFM rendering, heading IDs, titles, URL resolution.  | `marked`, `sanitizer`, `escape` |
| `sanitizer.ts` | Sanitization policy and URL hook.                    | `sanitize-html`, `errors`       |
| `html.ts`      | Accessible document shell.                           | `config`, `escape`, `errors`    |
| `temp.ts`      | Temp runs, cleanup, custom output, collision checks. | `config`, `errors`              |
| `browser.ts`   | File URLs and browser launch.                        | `open`, `errors`                |
| `escape.ts`    | HTML escaping helper.                                | none                            |

Dependencies point inward. Pure modules do not import `cli.ts`.

## Design decisions

### TypeScript compiled to `bin/`

The implementation keeps TypeScript for type safety and compiles ESM output to
`bin/`. The package executable is `bin/mdreader.js`, and the package `files`
list ships only built output plus documentation. Sources use `.js` import
specifiers so both TypeScript and Node resolve modules identically.

### No `<base>` element

A `<base href="file:///source/dir/">` would break fragment-only links: `#install`
would resolve against the source directory rather than the generated document.
Instead, a `transformUrl` callback resolves relative links and images to absolute
`file://` URLs. Fragment-only URLs return unchanged. This keeps both relative
assets and in-document navigation working.

### Sanitizer policy is central and independent

All rendered Markdown, including raw HTML authored in Markdown, passes through
one sanitizer. The sanitizer does not know where files live; it exposes a URL
transformation hook. This keeps the security policy independently testable and
lets resource resolution evolve without weakening allowlists.

### Dependency injection at the edge

`run()` accepts an optional dependency object:

```ts
{
  launchBrowser,      // never open a real browser during tests
  logger,             // capture stdout messages
  now,                // deterministic cleanup clocks
  tempRootDirectory,  // isolated temporary roots
  maxInputBytes,      // size-limit tests
  retentionMs,        // cleanup tests
}
```

Pure modules remain easy to unit test; the workflow is integration-tested with
mocks rather than OS side effects.

### Typed errors and exit codes

Expected failures extend `MdreaderError`. Validation errors carry exit code `2`;
everything else carries `1`. The entry point prints `Error: <message>` to stderr
and includes a stack only with `--debug` or `MDREADER_DEBUG=1`.

## Data flow

```text
argv -> args -> file -> markdown -> sanitizer -> html -> temp -> browser
                    \-> title -----------------------------------^
```

## Concurrency

- Each default execution creates a new directory with `fs.mkdtemp()`, so two
  executions cannot collide.
- Cleanup runs before the new run directory is created and only removes runs
  older than the retention period. Recent outputs are preserved.
- Custom output writes to an explicit path; callers are responsible for not
  racing two processes against the same custom path.
