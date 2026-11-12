import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { BrowserLaunchError } from "../bin/errors.js";
import { openInBrowser, toFileUrl } from "../bin/browser.js";

test("creates valid file URLs", () => {
  const filePath = path.resolve("some folder", "page.html");
  const url = toFileUrl(filePath);

  assert.match(url, /^file:\/\//);
  assert.match(url, /some%20folder\/page\.html$/);
});

test("passes the file URL to the injected launcher", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "mdreader-browser-test-"));
  const filePath = path.join(fixture, "index.html");
  const calls = [];

  try {
    await writeFile(filePath, "<!doctype html>");
    await openInBrowser(filePath, async (url) => {
      calls.push(url);
    });

    assert.deepEqual(calls, [toFileUrl(filePath)]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("reports browser launch failures with the retained path", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "mdreader-browser-test-"));
  const filePath = path.join(fixture, "index.html");

  try {
    await writeFile(filePath, "<!doctype html>");

    await assert.rejects(
      openInBrowser(filePath, async () => {
        throw new Error("no browser");
      }),
      (error) => {
        assert.ok(error instanceof BrowserLaunchError);
        assert.match(error.message, /Could not open the default browser/);
        assert.ok(error.message.includes(filePath));
        assert.equal(error.exitCode, 1);
        return true;
      },
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
