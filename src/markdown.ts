/**
 * Markdown rendering for GitHub Flavored Markdown.
 *
 * Responsibilities:
 * - render GFM with stable, unique heading IDs,
 * - resolve relative resource URLs against the source Markdown file,
 * - optionally block remote images,
 * - extract a fallback document title,
 * - hand the rendered fragment to the security sanitizer.
 */
import { Marked, type Token, type Tokens, type TokensList } from "marked";
import { pathToFileURL } from "node:url";
import { escapeHtml } from "./escape.js";
import { MarkdownError } from "./errors.js";
import {
  sanitizeMarkdownHtml,
  type UrlKind,
  type UrlTransformer,
} from "./sanitizer.js";

const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export interface MarkdownRenderOptions {
  /** File URL of the source Markdown document. */
  sourceUrl: URL;
  /** When false, remote images are stripped but their alt text is retained. */
  allowRemoteResources?: boolean;
}

export interface RenderedMarkdown {
  html: string;
  title: string | null;
}

function toSlug(text: string): string {
  const slug = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "section";
}

function createUniqueHeadingId(text: string, usedIds: Set<string>): string {
  const base = toSlug(text);
  let candidate = base;
  let counter = 1;

  while (usedIds.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function splitUrlScheme(value: string): string | null {
  const match = SCHEME_PATTERN.exec(value);
  return match === null ? null : match[0].slice(0, -1).toLowerCase();
}

function isRemoteScheme(scheme: string | null): boolean {
  return scheme === "http" || scheme === "https";
}

/**
 * Build a URL transformer that resolves relative resources against the source
 * Markdown directory and blocks remote images when requested.
 */
export function createUrlTransformer(
  sourceUrl: URL,
  allowRemoteResources: boolean,
): UrlTransformer {
  return (rawUrl: string, kind: UrlKind): string | null => {
    const value = rawUrl.trim();

    if (value.length === 0 || value.startsWith("#")) {
      return value;
    }

    if (value.startsWith("//")) {
      if (kind === "image" && !allowRemoteResources) {
        return null;
      }

      return `https:${value}`;
    }

    const scheme = splitUrlScheme(value);

    if (scheme !== null) {
      if (kind === "image" && !allowRemoteResources && isRemoteScheme(scheme)) {
        return null;
      }

      return value;
    }

    if (/^[A-Za-z]:[\\/]/.test(value)) {
      return pathToFileURL(value).href;
    }

    try {
      return new URL(value, sourceUrl).href;
    } catch {
      // Let the sanitizer decide whether the untouched value is safe.
      return value;
    }
  };
}

function createMarked(usedIds: Set<string>): Marked {
  const instance = new Marked({
    gfm: true,
    breaks: false,
    async: false,
  });

  instance.use({
    renderer: {
      heading(token) {
        const innerHtml = this.parser.parseInline(token.tokens);
        const id = createUniqueHeadingId(token.text, usedIds);
        return `<h${token.depth} id="${escapeHtml(id)}">${innerHtml}</h${token.depth}>\n`;
      },
    },
  });

  return instance;
}

/** Remove lightweight inline Markdown syntax for use in the document title. */
export function stripInlineMarkdown(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isHeadingToken(token: Token): token is Tokens.Heading {
  return token.type === "heading";
}

function titleFromTokens(tokens: TokensList): string | null {
  const heading = tokens.find(isHeadingToken);
  if (heading === undefined) {
    return null;
  }

  const title = stripInlineMarkdown(heading.text).slice(0, 200).trim();
  return title.length > 0 ? title : null;
}

/**
 * Extract the first ATX or setext heading as a default document title.
 * Returns null when the Markdown contains no usable heading.
 */
export function extractDocumentTitle(markdown: string): string | null {
  const instance = new Marked({ gfm: true, breaks: false });
  return titleFromTokens(instance.lexer(markdown));
}

/**
 * Render Markdown to a sanitized HTML fragment.
 *
 * @throws {MarkdownError} when Marked fails to render the document.
 */
export async function renderMarkdown(
  markdown: string,
  options: MarkdownRenderOptions,
): Promise<RenderedMarkdown> {
  const allowRemoteResources = options.allowRemoteResources ?? true;
  const usedIds = new Set<string>();

  let renderedHtml: string;
  let title: string | null;
  try {
    const instance = createMarked(usedIds);
    const tokens = instance.lexer(markdown);
    title = titleFromTokens(tokens);
    renderedHtml = instance.parser(tokens);
  } catch (cause: unknown) {
    throw new MarkdownError("The Markdown document could not be rendered.", {
      cause,
    });
  }

  const html = sanitizeMarkdownHtml(renderedHtml, {
    transformUrl: createUrlTransformer(options.sourceUrl, allowRemoteResources),
  });

  return { html, title };
}
