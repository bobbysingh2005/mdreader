import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readMarkdownFile } from "../bin/file.js";
import { FileAccessError } from "../bin/errors.js";

async function createFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "mdreader-file-test-"));
  return {
    directory,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("reads UTF-8 Markdown, including Hindi", async () => {
  const fixture = await createFixture();

  try {
    const filePath = path.join(fixture.directory, "notes.md");
    const content = "# नमस्ते\n\nसामग्री";
    await writeFile(filePath, content, "utf8");

    const result = await readMarkdownFile(filePath);

    assert.equal(result.content, content);
    assert.equal(result.resolvedPath, filePath);
    assert.equal(result.directory, fixture.directory);
    assert.match(result.sourceUrl.href, /^file:\/\//);
  } finally {
    await fixture.cleanup();
  }
});

test("accepts empty Markdown files", async () => {
  const fixture = await createFixture();

  try {
    const filePath = path.join(fixture.directory, "empty.markdown");
    await writeFile(filePath, "");

    const result = await readMarkdownFile(filePath);
    assert.equal(result.content, "");
  } finally {
    await fixture.cleanup();
  }
});

test("reports missing files and permission-style errors clearly", async () => {
  const fixture = await createFixture();

  try {
    await assert.rejects(
      readMarkdownFile(path.join(fixture.directory, "missing.md")),
      (error) => {
        assert.ok(error instanceof FileAccessError);
        assert.match(error.message, /Input file not found/);
        return true;
      },
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects directories and unsupported extensions", async () => {
  const fixture = await createFixture();

  try {
    const folder = path.join(fixture.directory, "folder.md");
    const textFile = path.join(fixture.directory, "notes.txt");
    await mkdir(folder);
    await writeFile(textFile, "not markdown");

    await assert.rejects(readMarkdownFile(folder), /is a directory/);
    await assert.rejects(
      readMarkdownFile(textFile),
      /Unsupported file type ".txt"/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("enforces a configurable maximum input size", async () => {
  const fixture = await createFixture();

  try {
    const filePath = path.join(fixture.directory, "large.md");
    await writeFile(filePath, "x".repeat(64));

    await assert.rejects(
      readMarkdownFile(filePath, { maxBytes: 16 }),
      /Input file is too large/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("follows symbolic links to regular Markdown files", async (t) => {
  const fixture = await createFixture();

  try {
    const target = path.join(fixture.directory, "target.md");
    const link = path.join(fixture.directory, "link.md");
    await writeFile(target, "# Linked");

    try {
      await symlink(target, link, "file");
    } catch {
      t.skip("Symbolic links are not available on this system");
      return;
    }

    const result = await readMarkdownFile(link);
    assert.equal(result.content, "# Linked");
    assert.equal(result.resolvedPath, link);
  } finally {
    await fixture.cleanup();
  }
});

test("never writes to the input file", async () => {
  const fixture = await createFixture();

  try {
    const filePath = path.join(fixture.directory, "immutable.md");
    const content = "# Unchanged\n\nBody";
    await writeFile(filePath, content);

    await readMarkdownFile(filePath);

    assert.equal(await readFile(filePath, "utf8"), content);
  } finally {
    await fixture.cleanup();
  }
});
