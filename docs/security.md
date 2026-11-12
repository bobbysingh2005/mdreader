# Security

Security is a primary design goal. Markdown is not HTML, and parsing Markdown
does not make raw HTML safe. Every rendered fragment is sanitized.

## Threat model

`mdreader` treats the Markdown file and any raw HTML it contains as untrusted.
The generated document is opened in a browser with `file://` privileges, so the
goal is to prevent script execution, event-handler injection, dangerous
navigation, embedded content, style-based attacks, and document-level redirects.

## Sanitization policy

Sanitization lives in `src/sanitizer.ts` and uses `sanitize-html` with explicit
allowlists. It does not spread the library's default allowlist.

### Allowed structural and semantic tags

Headings, paragraphs, line breaks, horizontal rules, blockquotes, ordered and
unordered lists, description lists, emphasis, strong, strikethrough, insert,
mark, abbreviation, citation, quote, code, preformatted code, keyboard/sample/
variable text, superscript, subscript, links, images, tables and captions,
table sections, rows, header/data cells, figures, details/summary, sections,
generic containers, and disabled task-list checkboxes.

### Removed tags

`script`, `style`, `iframe`, `object`, `embed`, `svg`, `math`, `meta`, `link`,
`base`, `form`, `button`, `select`, `textarea`, `audio`, `video`, `source`,
`track`, `canvas`, `template`, and similar executable or document-altering
elements.

`nonTextTags` ensures the contents of `script`, `style`, `noscript`, `template`,
`textarea`, and `option` are removed rather than preserved as text.

### Allowed attributes

Attributes are allowlisted per tag. Notable examples:

- `a`: `href`, `title`, `id`, `name`, `rel`
- `img`: `src`, `alt`, `title`, `width`, `height`
- `th`/`td`: `colspan`, `rowspan`, `scope`, `align`
- `code`/`pre`: restricted `class` values
- `input`: `type="checkbox"` only, plus `checked`/`disabled`
- headings: generated `id`

Everything else is removed, including `style`, `on*` event handlers, `srcset`,
`formaction`, and arbitrary `data-*` attributes. Non-checkbox `input` elements
are removed entirely.

### Classes

Class values are filtered. Code blocks may use `language-*`; task lists may use
`contains-task-list` and `task-list-item`. Other classes are removed to avoid
unexpected styling hooks.

## URL validation

Allowed schemes:

- Links: `http`, `https`, `mailto`, `tel`, `file`
- Images: `http`, `https`, `file`

`sanitize-html` also applies scheme checks after transforms, so a relative URL
rewritten to `file://` is valid while `javascript:`, `data:`, `vbscript:`, and
other schemes are rejected. Protocol-relative URLs (`//host/...`) are normalized
to `https:` before validation. Encoded schemes are decoded by the HTML parser
before validation.

External HTTP(S) links receive `rel="noopener noreferrer"`. Links are never
forced to open in a new tab.

Images without an `alt` attribute receive `alt=""`, so screen readers do not
announce filenames. With `--no-remote-resources`, remote image `src` attributes
are removed but the `alt` text remains.

## Raw HTML in Markdown

Raw HTML is rendered by `marked` and then sanitized. Unsafe raw HTML is removed,
not passed through. This means some author intent is intentionally lost:
scripts, embedded widgets, SVG artwork, custom styles, and interactive forms do
not survive.

## Temporary file security

Default output:

```text
<os temp directory>/mdreader/run-XXXXXX/index.html
```

- Directories are created with `fs.mkdtemp()`, so names are not predictable and
  concurrent executions cannot collide.
- The application directory is created with owner-only permissions where the
  platform supports them; files are written with mode `0600`.
- Generated HTML is retained after launch so browser refreshes keep working.
- Expired runs (default: 24 hours) are removed at the start of later executions.
- Cleanup only considers direct children named with the `run-` prefix.
- Cleanup skips symbolic links and uses `lstat()` so links are never followed.
- Cleanup ignores individual failures and never deletes the temp root or
  unrelated entries.
- `--no-cleanup` disables cleanup for the current execution.

## Custom output security

- The output path is resolved to an absolute path.
- Missing parent directories are created.
- Existing HTML at the exact output path is overwritten; this is the documented
  overwrite policy.
- The command refuses to write over the input Markdown file. Collision checks
  compare normalized paths, device/inode identity (hard links), and real paths
  (symbolic links).
- Output paths that are directories are rejected.
- Failures report the path without exposing internal stack traces unless
  `--debug` is enabled.

## Input handling

- Extensions are limited to `.md` and `.markdown`.
- The input must be a regular file; directories and special files are rejected.
- Input is read as UTF-8 and never modified.
- Symbolic links are followed only when the target is a regular file. The
  extension is checked on the supplied path.
- The default maximum size is 5 MiB.

## Browser local-file limitations

The generated document is a local `file://` page. Browsers may restrict
cross-directory subresource loading, navigation, or other local-file behaviors.
This is browser security policy, not sanitization. `mdreader` does not start an
HTTP server to work around it. If a browser blocks a relative resource, move the
generated file beside the resource directory or serve the files yourself.

Allowing `file:` URLs in links and images is intentional: it is required for
relative local resources to work. A Markdown author can already reference local
files by path, so this does not create a new trust boundary. Do not open Markdown
from untrusted sources if you are not prepared for it to reference local files.

## Reporting security issues

Please report suspected vulnerabilities privately to the maintainer before
opening a public issue. Include a minimal Markdown sample and the generated
HTML, if possible.
