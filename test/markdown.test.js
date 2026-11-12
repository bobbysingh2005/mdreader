import assert from "node:assert/strict";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  extractDocumentTitle,
  renderMarkdown,
  stripInlineMarkdown,
} from "../bin/markdown.js";

const sourceUrl = pathToFileURL(
  path.join(tmpdir(), "mdreader-fixture", "README.md"),
);

async function render(markdown, options = {}) {
  return renderMarkdown(markdown, { sourceUrl, ...options });
}

test("renders basic Markdown", async () => {
  const result = await render(
    "# Title\n\nA **bold** and *italic* [link](https://example.com).",
  );

  assert.match(result.html, /<h1 id="title">Title<\/h1>/);
  assert.match(result.html, /<strong>bold<\/strong>/);
  assert.match(result.html, /<em>italic<\/em>/);
  assert.match(result.html, /<a href="https:\/\/example\.com"/);
});

test("generates unique heading IDs", async () => {
  const result = await render("# Hello\n\n# Hello\n\n# Hello, World!");

  assert.match(result.html, /<h1 id="hello">/);
  assert.match(result.html, /<h1 id="hello-1">/);
  assert.match(result.html, /<h1 id="hello-world">/);
});

test("supports GFM tables", async () => {
  const result = await render(
    "| Name | Value |\n| --- | ---: |\n| A | 1 |\n| B | 2 |",
  );

  assert.match(result.html, /<table>/);
  assert.match(result.html, /<thead>/);
  assert.match(result.html, /<th[^>]*>Name<\/th>/);
  assert.match(result.html, /<td[^>]*>A<\/td>/);
});

test("supports task lists", async () => {
  const result = await render("- [x] Done\n- [ ] Todo");

  assert.match(result.html, /type="checkbox"/);
  assert.match(result.html, /checked/);
  assert.match(result.html, /Done/);
  assert.match(result.html, /Todo/);
});

test("supports nested lists, blockquotes, and code", async () => {
  const result = await render(
    "> quote\n\n1. one\n   - nested\n\n`inline`\n\n```js\nconst x = 1;\n```\n\n---",
  );

  assert.match(result.html, /<blockquote>/);
  assert.match(result.html, /<ol>/);
  assert.match(result.html, /<ul>/);
  assert.match(result.html, /<code>inline<\/code>/);
  assert.match(result.html, /<pre><code class="language-js">/);
  assert.match(result.html, /<hr\s*\/?>/);
});

test("preserves Unicode and Hindi content", async () => {
  const result = await render("# नमस्ते दुनिया\n\nयह एक परीक्षण है।");

  assert.match(result.html, /<h1 id="नमस्ते-दुनिया">नमस्ते दुनिया<\/h1>/);
  assert.match(result.html, /यह एक परीक्षण है।/);
});

test("handles empty and malformed Markdown", async () => {
  assert.equal((await render("")).html, "");

  const malformed = await render("# Heading\n\n[unclosed link( and **bold");
  assert.match(malformed.html, /Heading/);
});

test("keeps fragment-only links unchanged", async () => {
  const result = await render("[Install](#installation)");

  assert.match(result.html, /href="#installation"/);
  assert.doesNotMatch(result.html, /file:/);
});

test("resolves relative links and images against the source file", async () => {
  const result = await render(
    "[Guide](docs/guide.md) ![Logo](./images/logo.png)",
  );
  const expectedLink = new URL("docs/guide.md", sourceUrl).href;
  const expectedImage = new URL("images/logo.png", sourceUrl).href;

  assert.ok(result.html.includes(`href="${expectedLink}"`), result.html);
  assert.ok(result.html.includes(`src="${expectedImage}"`), result.html);
});

test("allows remote resources by default", async () => {
  const result = await render("![Remote](https://example.com/pic.png)", {
    allowRemoteResources: true,
  });

  assert.match(result.html, /src="https:\/\/example\.com\/pic\.png"/);
  assert.match(result.html, /alt="Remote"/);
});

test("blocks remote images while preserving alt text", async () => {
  const result = await render("![Remote](https://example.com/pic.png)", {
    allowRemoteResources: false,
  });

  assert.doesNotMatch(result.html, /example\.com/);
  assert.match(result.html, /alt="Remote"/);
});

test("normalizes protocol-relative resources", async () => {
  const result = await render("[Site](//example.com/page)");

  assert.match(result.html, /href="https:\/\/example\.com\/page"/);
});

test("sanitizes raw HTML in Markdown", async () => {
  const result = await render(
    '# Safe\n\n<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))',
  );

  assert.match(result.html, /<h1 id="safe">Safe<\/h1>/);
  assert.doesNotMatch(result.html, /script|onerror|javascript:/i);
});

test("extracts document titles from ATX and setext headings", () => {
  assert.equal(extractDocumentTitle("# **Bold** `code`"), "Bold code");
  assert.equal(extractDocumentTitle("Title\n====="), "Title");
  assert.equal(extractDocumentTitle("No heading here"), null);
  assert.equal(extractDocumentTitle(""), null);
});

test("strips inline Markdown from titles", () => {
  assert.equal(stripInlineMarkdown("[Link](x) and ![alt](y)"), "Link and alt");
  assert.equal(stripInlineMarkdown("<span>text</span>"), "text");
});
