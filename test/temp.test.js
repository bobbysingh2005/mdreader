import assert from "node:assert/strict";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  cleanupExpiredRuns,
  createRun,
  writeCustomOutput,
  writeHtmlFile,
} from "../bin/temp.js";
import { OutputWriteError } from "../bin/errors.js";

async function createRoot() {
  return mkdtemp(path.join(tmpdir(), "mdreader-temp-test-"));
}

test("creates unique run directories with an index.html path", async () => {
  const root = await createRoot();

  try {
    const runs = await Promise.all(
      Array.from({ length: 5 }, () => createRun({ rootDirectory: root })),
    );
    const directories = new Set(runs.map((run) => run.runDirectory));

    assert.equal(directories.size, 5);
    for (const run of runs) {
      assert.equal(path.basename(run.htmlPath), "index.html");
      assert.ok((await stat(run.runDirectory)).isDirectory());
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writes UTF-8 HTML to a run directory", async () => {
  const root = await createRoot();

  try {
    const run = await createRun({ rootDirectory: root });
    await writeHtmlFile(run.htmlPath, "<!doctype html><p>नमस्ते</p>");

    assert.equal(
      await readFile(run.htmlPath, "utf8"),
      "<!doctype html><p>नमस्ते</p>",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writes custom output, creating parent directories", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "mdreader-output-test-"));

  try {
    const inputPath = path.join(fixture, "notes.md");
    const outputPath = path.join(fixture, "nested", "deep", "notes.html");
    await writeFile(inputPath, "# Notes");

    const written = await writeCustomOutput({
      inputPath,
      outputPath,
      html: "<!doctype html><p>first</p>",
    });

    assert.equal(written, outputPath);
    assert.equal(
      await readFile(outputPath, "utf8"),
      "<!doctype html><p>first</p>",
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("overwrites existing HTML output", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "mdreader-output-test-"));

  try {
    const inputPath = path.join(fixture, "notes.md");
    const outputPath = path.join(fixture, "notes.html");
    await writeFile(inputPath, "# Notes");
    await writeFile(outputPath, "old");

    await writeCustomOutput({ inputPath, outputPath, html: "new" });

    assert.equal(await readFile(outputPath, "utf8"), "new");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("refuses to overwrite the input Markdown file", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "mdreader-output-test-"));

  try {
    const inputPath = path.join(fixture, "notes.md");
    await writeFile(inputPath, "# Notes");

    await assert.rejects(
      writeCustomOutput({ inputPath, outputPath: inputPath, html: "x" }),
      OutputWriteError,
    );

    const relativeOutput = path.relative(process.cwd(), inputPath);
    await assert.rejects(
      writeCustomOutput({ inputPath, outputPath: relativeOutput, html: "x" }),
      /Refusing to overwrite/,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("detects hard-link aliases of the input file", async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "mdreader-output-test-"));

  try {
    const inputPath = path.join(fixture, "notes.md");
    const outputPath = path.join(fixture, "alias.md");
    await writeFile(inputPath, "# Notes");

    try {
      await link(inputPath, outputPath);
    } catch {
      t.skip("Hard links are not available on this system");
      return;
    }

    await assert.rejects(
      writeCustomOutput({ inputPath, outputPath, html: "x" }),
      /Refusing to overwrite/,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("rejects an output path that is a directory", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "mdreader-output-test-"));

  try {
    const inputPath = path.join(fixture, "notes.md");
    const outputPath = path.join(fixture, "output.html");
    await writeFile(inputPath, "# Notes");
    await mkdir(outputPath);

    await assert.rejects(
      writeCustomOutput({ inputPath, outputPath, html: "x" }),
      /is a directory/,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("removes expired runs but preserves recent and unrelated entries", async () => {
  const root = await createRoot();
  const retentionMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  try {
    const oldRun = path.join(root, "run-old");
    const recentRun = path.join(root, "run-recent");
    const unrelated = path.join(root, "other");
    await mkdir(oldRun);
    await mkdir(recentRun);
    await mkdir(unrelated);

    const oldTime = new Date(now - retentionMs * 2);
    await utimes(oldRun, oldTime, oldTime);

    const result = await cleanupExpiredRuns({
      rootDirectory: root,
      retentionMs,
      now,
    });

    assert.deepEqual(result.removed, [oldRun]);
    await assert.rejects(lstat(oldRun), { code: "ENOENT" });
    assert.ok((await stat(recentRun)).isDirectory());
    assert.ok((await stat(unrelated)).isDirectory());
    assert.ok((await stat(root)).isDirectory());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not follow symbolic links during cleanup", async (t) => {
  const root = await createRoot();

  try {
    const target = path.join(root, "target");
    const linkPath = path.join(root, "run-link");
    await mkdir(target);

    try {
      await symlink(
        target,
        linkPath,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      t.skip("Symbolic links are not available on this system");
      return;
    }

    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await utimes(linkPath, oldTime, oldTime);

    const result = await cleanupExpiredRuns({
      rootDirectory: root,
      retentionMs: 24 * 60 * 60 * 1000,
      now: Date.now(),
    });

    assert.ok(!result.removed.includes(linkPath));
    assert.ok((await lstat(target)).isDirectory());
    assert.ok((await lstat(linkPath)).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ignores missing roots and reports other cleanup failures", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "mdreader-cleanup-test-"));

  try {
    const missingRoot = path.join(fixture, "missing");
    const missingResult = await cleanupExpiredRuns({
      rootDirectory: missingRoot,
    });
    assert.deepEqual(missingResult.removed, []);
    assert.deepEqual(missingResult.failures, []);

    const fileRoot = path.join(fixture, "not-a-directory");
    await writeFile(fileRoot, "x");
    const failureResult = await cleanupExpiredRuns({ rootDirectory: fileRoot });
    assert.equal(failureResult.failures.length, 1);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
