import assert from "node:assert/strict";
import test from "node:test";
import { createHtmlDocument } from "../bin/html.js";

function createDocument(overrides = {}) {
  return createHtmlDocument({
    title: "Test document",
    language: "en",
    content: '<h1 id="test">Test</h1>',
    ...overrides,
  });
}

test("generates a complete HTML5 document", () => {
  const html = createDocument();

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<title>Test document<\/title>/);
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /<article>/);
  assert.match(html, /<h1 id="test">Test<\/h1>/);
  assert.doesNotMatch(html, /<script/i);
});

test("includes an accessible skip link", () => {
  const html = createDocument();

  assert.match(
    html,
    /<a class="skip-link" href="#main-content">Skip to main content<\/a>/,
  );
});

test("escapes the document title", () => {
  const html = createDocument({
    title: "<script>alert(\"x\")</script> & 'quoted'",
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
  assert.match(html, /&#39;quoted&#39;/);
});

test("supports configurable document languages", () => {
  assert.match(createDocument({ language: "hi" }), /<html lang="hi">/);
  assert.match(createDocument({ language: "en-IN" }), /<html lang="en-IN">/);
});

test("falls back to English for invalid languages", () => {
  const html = createDocument({ language: 'en"><script>alert(1)</script>' });

  assert.match(html, /<html lang="en">/);
  assert.doesNotMatch(html, /<script>/);
});

test("falls back to a default title when blank", () => {
  const html = createDocument({ title: "   " });

  assert.match(html, /<title>Markdown document<\/title>/);
});

test("includes minimal presentational CSS only", () => {
  const html = createDocument();

  assert.match(html, /<style>/);
  assert.match(html, /@media|skip-link/);
  assert.doesNotMatch(html, /position:\s*fixed/i);
});
