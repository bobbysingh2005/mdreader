import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments } from "../bin/args.js";
import { CliValidationError } from "../bin/errors.js";

test("parses a Markdown file with defaults", () => {
  const args = parseArguments(["README.md"]);

  assert.equal(args.inputPath, "README.md");
  assert.equal(args.outputPath, null);
  assert.equal(args.open, true);
  assert.equal(args.cleanup, true);
  assert.equal(args.allowRemoteResources, true);
  assert.equal(args.language, "en");
  assert.equal(args.title, null);
  assert.equal(args.help, false);
  assert.equal(args.version, false);
  assert.equal(args.debug, false);
});

test("supports help and version options", () => {
  assert.equal(parseArguments(["--help"]).help, true);
  assert.equal(parseArguments(["-h"]).help, true);
  assert.equal(parseArguments(["--version"]).version, true);
  assert.equal(parseArguments(["-v"]).version, true);
});

test("requires an input file", () => {
  assert.throws(() => parseArguments([]), CliValidationError);
  assert.throws(
    () => parseArguments([]),
    /Please provide a Markdown file path/,
  );
});

test("rejects unknown options", () => {
  assert.throws(() => parseArguments(["--unknown", "a.md"]), /Unknown option/);
  assert.throws(() => parseArguments(["-z", "a.md"]), /Unknown option/);
  assert.throws(() => parseArguments(["-"]), /standard input is not supported/);
});

test("rejects missing option values", () => {
  assert.throws(
    () => parseArguments(["--output"]),
    /--output requires a value/,
  );
  assert.throws(
    () => parseArguments(["--output", "--no-open", "a.md"]),
    /requires a value/,
  );
  assert.throws(() => parseArguments(["--lang"]), /--lang requires a value/);
  assert.throws(() => parseArguments(["--title"]), /--title requires a value/);
  assert.throws(() => parseArguments(["-o"]), /--output requires a value/);
});

test("rejects duplicate options", () => {
  assert.throws(
    () => parseArguments(["--output", "a.html", "--output", "b.html", "a.md"]),
    /more than once/,
  );
  assert.throws(
    () => parseArguments(["--no-open", "--no-open", "a.md"]),
    /more than once/,
  );
  assert.throws(() => parseArguments(["--help", "--help"]), /more than once/);
});

test("rejects multiple input files", () => {
  assert.throws(
    () => parseArguments(["one.md", "two.md"]),
    /Only one Markdown file/,
  );
});

test("supports output in separate-value and equals forms", () => {
  assert.equal(
    parseArguments(["--output", "out/readme.html", "a.md"]).outputPath,
    "out/readme.html",
  );
  assert.equal(
    parseArguments(["a.md", "--output=out/readme.html"]).outputPath,
    "out/readme.html",
  );
  assert.equal(
    parseArguments(["-o", "out/readme.html", "a.md"]).outputPath,
    "out/readme.html",
  );
  assert.equal(
    parseArguments(["-o=out/readme.html", "a.md"]).outputPath,
    "out/readme.html",
  );
});

test("supports boolean flags", () => {
  const args = parseArguments([
    "a.md",
    "--no-open",
    "--no-cleanup",
    "--no-remote-resources",
    "--debug",
  ]);

  assert.equal(args.open, false);
  assert.equal(args.cleanup, false);
  assert.equal(args.allowRemoteResources, false);
  assert.equal(args.debug, true);
});

test("validates language tags", () => {
  assert.equal(parseArguments(["a.md", "--lang", "hi"]).language, "hi");
  assert.equal(parseArguments(["a.md", "--lang", "en-IN"]).language, "en-IN");
  assert.equal(parseArguments(["a.md", "-l", "fr"]).language, "fr");
  assert.throws(
    () => parseArguments(["a.md", "--lang", "en_US"]),
    /Invalid language tag/,
  );
  assert.throws(
    () => parseArguments(["a.md", "--lang", "e"]),
    /Invalid language tag/,
  );
  assert.throws(
    () => parseArguments(["a.md", "--lang", 'en"><script>']),
    /Invalid language tag/,
  );
});

test("supports a title override", () => {
  assert.equal(
    parseArguments(["a.md", "--title", "My document"]).title,
    "My document",
  );
  assert.equal(parseArguments(["a.md", "-t", "Short"]).title, "Short");
  assert.throws(
    () => parseArguments(["a.md", "--title", ""]),
    /non-empty value/,
  );
});

test("rejects conflicting help/version combinations", () => {
  assert.throws(
    () => parseArguments(["--help", "--version"]),
    /cannot be combined/,
  );
  assert.throws(() => parseArguments(["--help", "a.md"]), /cannot be combined/);
  assert.throws(
    () => parseArguments(["--version", "--no-open"]),
    /cannot be combined/,
  );
});

test("supports the end-of-options marker", () => {
  const args = parseArguments(["--", "--strange-name.md"]);
  assert.equal(args.inputPath, "--strange-name.md");
});

test("validation errors use the usage exit code", () => {
  try {
    parseArguments([]);
    assert.fail("Expected a validation error");
  } catch (error) {
    assert.ok(error instanceof CliValidationError);
    assert.equal(error.exitCode, 2);
  }
});
