import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { run } from "../bin/cli.js";
import { APP_VERSION } from "../bin/config.js";
import { BrowserLaunchError, CliValidationError } from "../bin/errors.js";
import { toFileUrl } from "../bin/browser.js";

const binPath = fileURLToPath(new URL("../bin/mdreader.js", import.meta.url));

async function createFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "mdreader-int-test-"));
  return {
    directory,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

function createLogger() {
  const messages = [];
  return {
    messages,
    logger: {
      info: (message) => messages.push(message),
    },
  };
}

function runCli(args, cwd) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [binPath, ...args],
      { cwd, encoding: "utf8" },
      (error, stdout, stderr) => {
        resolve({
          code: typeof error?.code === "number" ? error.code : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}

test("displays help and version without touching the filesystem", async () => {
  const help = createLogger();
  const helpResult = await run(["--help"], { logger: help.logger });

  assert.deepEqual(helpResult, { action: "help" });
  assert.match(help.messages.join("\n"), /Usage:/);
  assert.match(help.messages.join("\n"), /--output/);

  const version = createLogger();
  const versionResult = await run(["--version"], { logger: version.logger });

  assert.deepEqual(versionResult, { action: "version" });
  assert.equal(version.messages[0], APP_VERSION);
});

test("generates custom HTML without opening the browser", async () => {
  const fixture = await createFixture();

  try {
    const source = path.join(fixture.directory, "notes.md");
    const output = path.join(fixture.directory, "output", "notes.html");
    const sourceContent =
      "# Notes\n\n[Guide](docs/guide.md)\n\n## Install\n\n[Go](#install)\n\n![Logo](./images/logo.png)\n";
    await writeFile(source, sourceContent, "utf8");

    const { logger, messages } = createLogger();
    const browserCalls = [];
    const result = await run([source, "--output", output, "--no-open"], {
      logger,
      tempRootDirectory: path.join(fixture.directory, "temp"),
      launchBrowser: async (url) => browserCalls.push(url),
    });

    assert.deepEqual(result, {
      action: "rendered",
      outputPath: output,
      opened: false,
    });
    assert.deepEqual(browserCalls, []);
    assert.match(messages.join("\n"), /Reading Markdown file/);
    assert.match(messages.join("\n"), /HTML generated:/);
    assert.match(messages.join("\n"), /Browser not opened/);

    assert.equal(await readFile(source, "utf8"), sourceContent);

    const html = await readFile(output, "utf8");
    const expectedGuide = new URL("docs/guide.md", toFileUrl(source)).href;
    const expectedLogo = new URL("images/logo.png", toFileUrl(source)).href;

    assert.match(html, /<title>Notes<\/title>/);
    assert.match(html, /<h1 id="notes">Notes<\/h1>/);
    assert.match(html, /href="#install"/);
    assert.ok(html.includes(`href="${expectedGuide}"`), html);
    assert.ok(html.includes(`src="${expectedLogo}"`), html);
  } finally {
    await fixture.cleanup();
  }
});

test("writes to a unique temporary run when no output is supplied", async () => {
  const fixture = await createFixture();
  const tempRoot = path.join(fixture.directory, "temp");

  try {
    const source = path.join(fixture.directory, "temp.md");
    await writeFile(source, "# Temporary");

    const { logger } = createLogger();
    let browserCalls = 0;
    const result = await run([source, "--no-open"], {
      logger,
      tempRootDirectory: tempRoot,
      launchBrowser: async () => {
        browserCalls += 1;
      },
    });

    assert.equal(result.action, "rendered");
    assert.equal(result.opened, false);
    assert.equal(browserCalls, 0);
    assert.ok(result.outputPath.startsWith(tempRoot));
    assert.ok(result.outputPath.includes(`${path.sep}run-`));
    assert.ok((await stat(result.outputPath)).isFile());
    assert.match(
      await readFile(result.outputPath, "utf8"),
      /<h1 id="temporary">Temporary<\/h1>/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("opens the default browser when enabled", async () => {
  const fixture = await createFixture();

  try {
    const source = path.join(fixture.directory, "open.md");
    await writeFile(source, "# Open me");

    const { logger, messages } = createLogger();
    const browserCalls = [];
    const result = await run([source], {
      logger,
      tempRootDirectory: path.join(fixture.directory, "temp"),
      launchBrowser: async (url) => browserCalls.push(url),
    });

    assert.equal(result.action, "rendered");
    assert.equal(result.opened, true);
    assert.deepEqual(browserCalls, [toFileUrl(result.outputPath)]);
    assert.match(messages.join("\n"), /Opening default browser/);
    assert.match(messages.join("\n"), /Markdown opened successfully/);
  } finally {
    await fixture.cleanup();
  }
});

test("preserves generated HTML when the browser fails to open", async () => {
  const fixture = await createFixture();

  try {
    const source = path.join(fixture.directory, "fail.md");
    await writeFile(source, "# Keep me");

    const { logger } = createLogger();
    await assert.rejects(
      run([source], {
        logger,
        tempRootDirectory: path.join(fixture.directory, "temp"),
        launchBrowser: async () => {
          throw new Error("no browser");
        },
      }),
      (error) => {
        assert.ok(error instanceof BrowserLaunchError);
        const marker = "The generated HTML is still available at: ";
        const outputPath = error.message.slice(
          error.message.indexOf(marker) + marker.length,
        );
        assert.ok(outputPath.length > 0);
        return true;
      },
    );

    const runDirectories = (
      await readdir(path.join(fixture.directory, "temp"))
    ).filter((name) => name.startsWith("run-"));
    assert.equal(runDirectories.length, 1);
    const htmlPath = path.join(
      fixture.directory,
      "temp",
      runDirectories[0],
      "index.html",
    );
    assert.ok((await stat(htmlPath)).isFile());
  } finally {
    await fixture.cleanup();
  }
});

test("supports language and title overrides", async () => {
  const fixture = await createFixture();

  try {
    const source = path.join(fixture.directory, "hindi.md");
    const output = path.join(fixture.directory, "hindi.html");
    await writeFile(source, "# नमस्ते\n\nयह सामग्री है।");

    const { logger } = createLogger();
    await run(
      [
        source,
        "--output",
        output,
        "--no-open",
        "--lang",
        "hi",
        "--title",
        "मेरा दस्तावेज़",
      ],
      {
        logger,
        tempRootDirectory: path.join(fixture.directory, "temp"),
      },
    );

    const html = await readFile(output, "utf8");
    assert.match(html, /<html lang="hi">/);
    assert.match(html, /<title>मेरा दस्तावेज़<\/title>/);
    assert.match(html, /नमस्ते/);
  } finally {
    await fixture.cleanup();
  }
});

test("sanitizes malicious Markdown end to end", async () => {
  const fixture = await createFixture();

  try {
    const source = path.join(fixture.directory, "evil.md");
    const output = path.join(fixture.directory, "evil.html");
    await writeFile(
      source,
      '# Safe\n\n<script>alert("x")</script>\n\n<img src="https://example.com/a.png" onerror="alert(1)">\n\n[bad](javascript:alert(1))\n',
    );

    const { logger } = createLogger();
    await run([source, "--output", output, "--no-open"], {
      logger,
      tempRootDirectory: path.join(fixture.directory, "temp"),
    });

    const html = await readFile(output, "utf8");
    assert.match(html, /<h1 id="safe">Safe<\/h1>/);
    assert.doesNotMatch(html, /<script|onerror|javascript:/i);
  } finally {
    await fixture.cleanup();
  }
});

test("blocks remote images with --no-remote-resources", async () => {
  const fixture = await createFixture();

  try {
    const source = path.join(fixture.directory, "remote.md");
    const output = path.join(fixture.directory, "remote.html");
    await writeFile(source, "![Landscape](https://example.com/photo.jpg)");

    const { logger } = createLogger();
    await run(
      [source, "--output", output, "--no-open", "--no-remote-resources"],
      {
        logger,
        tempRootDirectory: path.join(fixture.directory, "temp"),
      },
    );

    const html = await readFile(output, "utf8");
    assert.doesNotMatch(html, /example\.com/);
    assert.match(html, /alt="Landscape"/);
  } finally {
    await fixture.cleanup();
  }
});

test("refuses to overwrite the input Markdown through --output", async () => {
  const fixture = await createFixture();

  try {
    const source = path.join(fixture.directory, "same.md");
    await writeFile(source, "# Same");

    const { logger } = createLogger();
    await assert.rejects(
      run([source, "--output", source, "--no-open"], {
        logger,
        tempRootDirectory: path.join(fixture.directory, "temp"),
      }),
      /Refusing to overwrite the input Markdown file/,
    );

    assert.equal(await readFile(source, "utf8"), "# Same");
  } finally {
    await fixture.cleanup();
  }
});

test("--no-cleanup disables expired-run cleanup", async () => {
  const fixture = await createFixture();
  const tempRoot = path.join(fixture.directory, "temp");

  try {
    const source = path.join(fixture.directory, "clean.md");
    await writeFile(source, "# Clean");

    const oldRun = path.join(tempRoot, "run-old");
    await mkdir(oldRun, { recursive: true });
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await utimes(oldRun, oldTime, oldTime);

    const first = createLogger();
    await run([source, "--no-open", "--no-cleanup"], {
      logger: first.logger,
      tempRootDirectory: tempRoot,
    });
    assert.ok((await stat(oldRun)).isDirectory());

    const second = createLogger();
    await run([source, "--no-open"], {
      logger: second.logger,
      tempRootDirectory: tempRoot,
    });
    await assert.rejects(stat(oldRun), { code: "ENOENT" });
  } finally {
    await fixture.cleanup();
  }
});

test("returns usage errors for invalid command lines", async () => {
  const { logger } = createLogger();

  await assert.rejects(run(["--unknown"], { logger }), (error) => {
    assert.ok(error instanceof CliValidationError);
    assert.equal(error.exitCode, 2);
    return true;
  });
});

test("the built executable reports version and usage errors", async () => {
  const version = await runCli(["--version"], process.cwd());
  assert.equal(version.code, 0);
  assert.equal(version.stdout.trim(), APP_VERSION);

  const invalid = await runCli(["--unknown"], process.cwd());
  assert.equal(invalid.code, 2);
  assert.match(invalid.stderr, /Error: /);
  assert.match(invalid.stderr, /Unknown option/);
});

test("the built executable renders a custom output file", async () => {
  const fixture = await createFixture();

  try {
    const source = path.join(fixture.directory, "cli.md");
    const output = path.join(fixture.directory, "cli.html");
    await writeFile(source, "# From the CLI");

    const result = await runCli(
      [source, "--output", output, "--no-open", "--no-cleanup"],
      fixture.directory,
    );

    assert.equal(result.code, 0);
    assert.match(result.stdout, /HTML generated:/);
    assert.match(
      await readFile(output, "utf8"),
      /<h1 id="from-the-cli">From the CLI<\/h1>/,
    );
  } finally {
    await fixture.cleanup();
  }
});
