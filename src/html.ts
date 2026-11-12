/**
 * Standalone accessible HTML5 document generation.
 *
 * The content passed in must already be sanitized. This module only assembles
 * the document shell and never parses untrusted Markdown.
 */
import { DEFAULT_LANGUAGE } from "./config.js";
import { escapeHtml } from "./escape.js";
import { HtmlGenerationError } from "./errors.js";

export interface HtmlDocumentOptions {
  title: string;
  language: string;
  content: string;
}

const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;

const DOCUMENT_STYLES = `
  :root {
    color-scheme: light dark;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  body {
    margin: 0 auto;
    max-width: 52rem;
    padding: 1.5rem 1.25rem 4rem;
    line-height: 1.7;
  }
  .skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
  }
  .skip-link:focus {
    position: static;
    display: inline-block;
    margin-bottom: 1rem;
    padding: 0.5rem 0.75rem;
    outline: 3px solid currentColor;
  }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    margin-top: 2em;
  }
  img { height: auto; max-width: 100%; }
  pre {
    overflow-x: auto;
    padding: 1rem;
    background: color-mix(in srgb, CanvasText 8%, Canvas);
  }
  code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  table { border-collapse: collapse; display: block; overflow-x: auto; }
  th, td { border: 1px solid currentColor; padding: 0.4rem 0.7rem; }
  blockquote { border-left: 0.25rem solid currentColor; margin-left: 0; padding-left: 1rem; }
  a { text-underline-offset: 0.15em; }
  :focus-visible { outline: 3px solid Highlight; outline-offset: 3px; }
`;

function normalizeLanguage(language: string): string {
  return LANGUAGE_PATTERN.test(language) ? language : DEFAULT_LANGUAGE;
}

/**
 * Build a complete HTML5 document with semantic landmarks, UTF-8 metadata, and
 * minimal CSS that is purely presentational.
 */
export function createHtmlDocument(options: HtmlDocumentOptions): string {
  try {
    const language = normalizeLanguage(options.language);
    const title =
      options.title.trim().length > 0
        ? options.title.trim()
        : "Markdown document";

    return `<!doctype html>
<html lang="${escapeHtml(language)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="generator" content="mdreader">
    <title>${escapeHtml(title)}</title>
    <style>${DOCUMENT_STYLES}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <main id="main-content" tabindex="-1">
      <article>
${options.content}
      </article>
    </main>
  </body>
</html>
`;
  } catch (cause: unknown) {
    throw new HtmlGenerationError("The HTML document could not be generated.", {
      cause,
    });
  }
}
