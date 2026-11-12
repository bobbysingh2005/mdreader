/**
 * Central HTML sanitization policy.
 *
 * Marked output (including raw HTML authored in Markdown) is untrusted. This
 * module applies explicit tag/attribute allowlists and URL scheme validation.
 * It never decides which resource a URL points to; callers may inject a URL
 * transformer for local-resource resolution.
 */
import sanitizeHtml from "sanitize-html";
import { SanitizationError } from "./errors.js";

export type UrlKind = "link" | "image";

export type UrlTransformer = (url: string, kind: UrlKind) => string | null;

export interface SanitizeOptions {
  /** Resolve or reject a URL. Returning null removes the attribute. */
  transformUrl?: UrlTransformer;
}

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

const ALLOWED_TAGS = [
  ...HEADING_TAGS,
  "p",
  "br",
  "hr",
  "blockquote",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "mark",
  "abbr",
  "cite",
  "q",
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  "sup",
  "sub",
  "a",
  "img",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "details",
  "summary",
  "section",
  "div",
  "span",
  "input",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "id", "name", "rel"],
  abbr: ["title"],
  img: ["src", "alt", "title", "width", "height"],
  code: ["class"],
  pre: ["class"],
  ul: ["class"],
  ol: ["class", "start", "reversed", "type"],
  li: ["class", "value"],
  table: [],
  th: ["colspan", "rowspan", "scope", "align"],
  td: ["colspan", "rowspan", "align"],
  details: ["open"],
  input: [{ name: "type", values: ["checkbox"] }, "checked", "disabled"],
  ...Object.fromEntries(HEADING_TAGS.map((tag) => [tag, ["id"]])),
};

const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel", "file"];

const ALLOWED_SCHEMES_BY_TAG = {
  a: ["http", "https", "mailto", "tel", "file"],
  img: ["http", "https", "file"],
};

const EXTERNAL_URL_PATTERN = /^https?:\/\//i;

function applyUrlTransformation(
  attribute: "href" | "src",
  attribs: sanitizeHtml.Attributes,
  kind: UrlKind,
  transformUrl: UrlTransformer | undefined,
): sanitizeHtml.Attributes {
  const rawValue = attribs[attribute];
  if (rawValue === undefined) {
    return attribs;
  }

  const nextAttribs = { ...attribs };
  const transformed =
    transformUrl === undefined ? rawValue : transformUrl(rawValue, kind);

  if (transformed === null) {
    delete nextAttribs[attribute];
  } else {
    nextAttribs[attribute] = transformed;
  }

  return nextAttribs;
}

function buildOptions(
  transformUrl: UrlTransformer | undefined,
): sanitizeHtml.IOptions {
  return {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedClasses: {
      code: [/^language-/],
      pre: [/^language-/],
      ul: ["contains-task-list"],
      ol: ["contains-task-list"],
      li: ["task-list-item"],
    },
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: ALLOWED_SCHEMES_BY_TAG,
    allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
    allowProtocolRelative: false,
    allowVulnerableTags: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    exclusiveFilter: (frame) =>
      frame.tag === "input" && frame.attribs.type !== "checkbox",
    nonTextTags: [
      "script",
      "style",
      "title",
      "textarea",
      "option",
      "noscript",
      "template",
    ],
    transformTags: {
      a: (tagName, attribs) => {
        let nextAttribs = applyUrlTransformation(
          "href",
          attribs,
          "link",
          transformUrl,
        );
        const href = nextAttribs.href;

        if (href !== undefined && EXTERNAL_URL_PATTERN.test(href)) {
          nextAttribs = { ...nextAttribs, rel: "noopener noreferrer" };
        } else if (nextAttribs.rel !== undefined) {
          nextAttribs = { ...nextAttribs };
          delete nextAttribs.rel;
        }

        return { tagName, attribs: nextAttribs };
      },
      img: (tagName, attribs) => {
        const nextAttribs = applyUrlTransformation(
          "src",
          attribs,
          "image",
          transformUrl,
        );

        if (nextAttribs.alt === undefined) {
          nextAttribs.alt = "";
        }

        return { tagName, attribs: nextAttribs };
      },
    },
  };
}

/**
 * Sanitize rendered Markdown HTML using the application's strict policy.
 *
 * @throws {SanitizationError} when the underlying sanitizer cannot process input.
 */
export function sanitizeMarkdownHtml(
  html: string,
  options: SanitizeOptions = {},
): string {
  try {
    return sanitizeHtml(html, buildOptions(options.transformUrl));
  } catch (cause: unknown) {
    throw new SanitizationError(
      "The generated HTML could not be sanitized safely.",
      { cause },
    );
  }
}
