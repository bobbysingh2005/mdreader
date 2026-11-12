# Accessibility

`mdreader` is built for everyone, including blind and low-vision users who rely
on screen readers and keyboard navigation. Accessibility is a requirement, not
an enhancement.

## Document structure

Every generated document includes:

- `<!doctype html>` and a complete HTML5 document.
- `<html lang="...">` with the language supplied by `--lang` (default `en`).
- `<meta charset="utf-8">` and a responsive viewport declaration.
- A meaningful `<title>`: `--title`, then the first Markdown heading, then the
  input file name.
- A `<main id="main-content" tabindex="-1">` landmark.
- An `<article>` containing the sanitized Markdown.
- A skip link as the first focusable element: "Skip to main content".

No JavaScript is generated. The document is readable and navigable with CSS
disabled.

## Headings and navigation

- Markdown heading levels are preserved (`h1` through `h6`).
- Every heading receives a unique, stable `id`, so table-of-contents links and
  fragment-only links such as `#installation` work.
- Duplicate headings receive numeric suffixes (`hello`, `hello-1`, ...).
- Unicode letters and combining marks are preserved in IDs, so Hindi and other
  non-Latin headings keep readable, linkable identifiers.
- Authors should still maintain a logical heading hierarchy; the tool preserves
  what is written rather than inventing levels.

## Tables

GFM tables remain native semantic tables: `table`, `caption`, `thead`, `tbody`,
`tfoot`, `tr`, `th`, `td`. Column alignment attributes are retained. Header
cells may declare `scope`. Screen readers can use native table navigation
commands.

## Code and preformatted text

Fenced code blocks remain `<pre><code>`; inline code remains `<code>`. Language
classes such as `language-js` are preserved. Code content is text, not rendered
HTML.

## Links and images

- Link text is preserved. External links receive `rel="noopener noreferrer"` and
  are not forced into new tabs.
- Image `alt` text is preserved. Images without alt text receive `alt=""` rather
  than an announcement based on the file name or URL.
- Decorative versus meaningful images are the author's responsibility; always
  write useful alt text for meaningful images.
- With `--no-remote-resources`, remote image sources are removed but alt text is
  retained, so the description is not lost.

## Language support

- `--lang` accepts BCP 47 tags such as `en`, `hi`, `en-IN`, or `fr-CA`.
- Invalid tags fall back to `en` defensively.
- UTF-8 input supports Hindi and other Unicode scripts throughout headings,
  body text, links, and alt text.
- Set the correct language for the document content so screen readers use the
  right pronunciation rules. If a document mixes languages, consider separate
  documents or author-supplied `lang` attributes where supported by the
  sanitizer (the document-level language remains the primary signal).

## Keyboard access

- Native elements are used wherever possible: links, tables, details/summary,
  headings, and lists are keyboard-accessible by default.
- The skip link is hidden off-screen until it receives focus, then becomes
  visible.
- Focus styles are defined with `:focus-visible`.
- No custom widgets or JavaScript keyboard traps are introduced.
- `tabindex="-1"` on the main landmark lets skip-link activation move focus to
  the content.

## Screen-reader behavior

- A `main` landmark allows quick navigation to primary content.
- The skip link is exposed to screen readers even when visually off-screen.
- Headings, lists, tables, code, and links use native semantics, so existing
  screen-reader commands work without ARIA.
- ARIA is intentionally avoided where native HTML already conveys the role and
  state. This avoids conflicting or redundant announcements.

## Styling

CSS is minimal and presentational only:

- system font stack,
- readable line length and line height,
- responsive images,
- scrollable code and tables,
- visible borders for table cells,
- visible focus indicators,
- light/dark color scheme support.

The HTML does not rely on CSS for meaning. Removing styles leaves a linear,
readable document.

## Known limitations

- `mdreader` preserves the author's heading hierarchy. It does not repair
  skipped levels.
- Raw HTML that is unsafe (including decorative SVG) is removed, so any
  accessibility affordance inside it is lost.
- Document-level language is a single value; mixed-language documents may need
  authored structure.
- Browser local-file restrictions can affect linked resources but not the
  document's semantic structure.

## Testing accessibility changes

When changing HTML generation or sanitization:

- Verify headings still have unique IDs and internal links work.
- Verify tables remain semantic and code keeps its element structure.
- Verify image alt text survives sanitization.
- Verify the document is readable with CSS disabled.
- Run the HTML and sanitizer tests, plus the full `npm run check`.
