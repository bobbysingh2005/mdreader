import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeMarkdownHtml } from "../bin/sanitizer.js";

test("removes scripts and their contents", () => {
  const html = sanitizeMarkdownHtml(
    '<p>safe</p><script>alert("x")</script><p>after</p>',
  );

  assert.match(html, /safe/);
  assert.match(html, /after/);
  assert.doesNotMatch(html, /script|alert/i);
});

test("removes inline event handlers", () => {
  const html = sanitizeMarkdownHtml(
    '<p onclick="alert(1)">text</p><img src="https://example.com/a.png" onerror="alert(1)">',
  );

  assert.doesNotMatch(html, /onclick|onerror/i);
  assert.match(html, /text/);
});

test("removes JavaScript URLs", () => {
  const html = sanitizeMarkdownHtml(
    '<a href="javascript:alert(1)">click</a><a href=" JAVASCRIPT:alert(2)">two</a>',
  );

  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /href=/i);
  assert.match(html, /click/);
});

test("removes encoded dangerous URLs", () => {
  const html = sanitizeMarkdownHtml(
    '<a href="java&#x73;cript:alert(1)">encoded</a>',
  );

  assert.doesNotMatch(html, /href=/i);
  assert.match(html, /encoded/);
});

test("removes data URLs", () => {
  const html = sanitizeMarkdownHtml(
    '<a href="data:text/html,<script>alert(1)</script>">link</a><img src="data:image/png;base64,AAAA" alt="data">',
  );

  assert.doesNotMatch(html, /data:/i);
});

test("removes dangerous embedded content", () => {
  const html = sanitizeMarkdownHtml(
    '<iframe src="https://example.com"></iframe><object data="x"></object><embed src="x"><svg><script>alert(1)</script></svg>',
  );

  assert.doesNotMatch(html, /iframe|object|embed|svg|script|alert/i);
});

test("removes style attributes and meta refresh", () => {
  const html = sanitizeMarkdownHtml(
    '<p style="background:url(javascript:alert(1))">styled</p><meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  );

  assert.doesNotMatch(html, /style=|meta|http-equiv|javascript:/i);
  assert.match(html, /styled/);
});

test("keeps safe links and adds rel to external links", () => {
  const html = sanitizeMarkdownHtml(
    '<a href="https://example.com/docs">docs</a><a href="#install">install</a><a href="mailto:a@example.com">mail</a>',
  );

  assert.match(html, /href="https:\/\/example\.com\/docs"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /href="#install"/);
  assert.match(html, /href="mailto:a@example\.com"/);
  assert.doesNotMatch(html, /href="#install"[^>]*rel=/);
});

test("keeps safe images and adds an empty alt when missing", () => {
  const html = sanitizeMarkdownHtml(
    '<img src="https://example.com/a.png" alt="A cat"><img src="https://example.com/b.png">',
  );

  assert.match(html, /src="https:\/\/example\.com\/a\.png"/);
  assert.match(html, /alt="A cat"/);
  assert.match(html, /alt=""/);
});

test("preserves allowed semantic HTML", () => {
  const html = sanitizeMarkdownHtml(
    '<h2 id="usage">Usage</h2><table><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table><pre><code class="language-js">const x = 1;</code></pre><details open><summary>More</summary>Text</details><abbr title="HyperText">HTML</abbr>',
  );

  assert.match(html, /<h2 id="usage">/);
  assert.match(html, /<th scope="col">/);
  assert.match(html, /class="language-js"/);
  assert.match(html, /<details open>/);
  assert.match(html, /<abbr title="HyperText">/);
});

test("preserves accessible task-list checkboxes only", () => {
  const html = sanitizeMarkdownHtml(
    '<input type="checkbox" checked disabled><input type="text" value="ignored">',
  );

  assert.match(html, /type="checkbox"/);
  assert.match(html, /disabled/);
  assert.doesNotMatch(html, /type="text"|value=/);
});

test("removes disallowed classes but keeps language classes", () => {
  const html = sanitizeMarkdownHtml(
    '<code class="language-js evil">x</code><ul class="contains-task-list other"><li class="task-list-item weird">y</li></ul>',
  );

  assert.match(html, /language-js/);
  assert.doesNotMatch(html, /evil/);
  assert.match(html, /contains-task-list/);
  assert.doesNotMatch(html, /other/);
  assert.match(html, /task-list-item/);
  assert.doesNotMatch(html, /weird/);
});

test("supports rejecting URLs through the transform hook", () => {
  const html = sanitizeMarkdownHtml(
    '<img src="https://example.com/remote.png" alt="Remote"><a href="https://example.com">link</a>',
    {
      transformUrl: (url, kind) => (kind === "image" ? null : url),
    },
  );

  assert.doesNotMatch(html, /remote\.png/);
  assert.match(html, /alt="Remote"/);
  assert.match(html, /href="https:\/\/example\.com"/);
});

test("drops nested malicious elements", () => {
  const html = sanitizeMarkdownHtml(
    '<div><p><span><a href="javascript:alert(1)"><img src="x" onerror="alert(1)">nested</a></span></p></div>',
  );

  assert.doesNotMatch(html, /javascript:|onerror/i);
  assert.match(html, /nested/);
});
