import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

const markdown = new Marked({
  gfm: true,
  breaks: false,
});

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "input",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    code: ["class"],
    img: ["src", "alt", "title", "width", "height"],
    li: ["class"],
    pre: ["class"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    ul: ["class"],
    input: ["type", "checked", "disabled"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform(
      "a",
      {
        target: "_blank",
        rel: "noopener noreferrer",
      },
      true,
    ),
  },
};

export async function parseMarkdown(markdownContent: string): Promise<string> {
  const htmlContent = await markdown.parse(markdownContent);
  // Markdown may contain raw HTML, so sanitize the rendered output before use.
  return sanitizeHtml(htmlContent, sanitizeOptions);
}
