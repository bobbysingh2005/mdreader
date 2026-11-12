import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { run } from "../dist/cli.js";
import { parseMarkdown } from "../dist/markdown.js";

async function createFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "mdreader-test-"));
  return {
    directory,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("requires exactly one Markdown file", async () => {
  await assert.rejects(run([]), /Please provide a Markdown file path/);
  await assert.rejects(run(["one.md", "two.md"]), /Only one Markdown file/);
});

test("reports a missing file", async () => {
  await assert.rejects(run(["missing.md"]), /File not found/);
});

test("rejects a directory and an unsupported file type", async () => {
  const fixture = await createFixture();

  try {
    const markdownDirectory = path.join(fixture.directory, "folder.md");
    const textFile = path.join(fixture.directory, "notes.txt");
    await mkdir(markdownDirectory);
    await writeFile(textFile, "not Markdown");

    await assert.rejects(run([markdownDirectory]), /Not a file/);
    await assert.rejects(run([textFile]), /Invalid file type/);
  } finally {
    await fixture.cleanup();
  }
});

test("renders a document and passes its file URL to the browser launcher", async () => {
  const fixture = await createFixture();

  try {
    const markdownPath = path.join(fixture.directory, "chapter.md");
    await writeFile(markdownPath, "# Chapter\n\n[Next](next.md)");
    let outputPath;

    await run([markdownPath], async (url) => {
      outputPath = fileURLToPath(url);
    });

    assert.ok(outputPath);
    const html = await readFile(outputPath, "utf8");
    assert.match(html, /<title>chapter<\/title>/);
    assert.match(html, /<h1>Chapter<\/h1>/);
    assert.match(html, /<base href="file:/);

    await rm(path.dirname(outputPath), { recursive: true, force: true });
  } finally {
    await fixture.cleanup();
  }
});

test("removes the temporary document when the browser cannot be opened", async () => {
  const fixture = await createFixture();

  try {
    const markdownPath = path.join(fixture.directory, "chapter.md");
    await writeFile(markdownPath, "# Chapter");
    let outputPath;

    await assert.rejects(
      run([markdownPath], async (url) => {
        outputPath = fileURLToPath(url);
        throw new Error("Browser launch failed");
      }),
      /Browser launch failed/,
    );

    assert.ok(outputPath);
    await assert.rejects(readFile(outputPath), { code: "ENOENT" });
  } finally {
    await fixture.cleanup();
  }
});

test("sanitizes unsafe HTML while preserving Markdown", async () => {
  const html = await parseMarkdown(
    "# Safe\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>",
  );

  assert.match(html, /<h1>Safe<\/h1>/);
  assert.doesNotMatch(html, /<script|onerror|alert\(1\)/i);
});
