/**
 * Central application configuration, defaults, and package metadata.
 *
 * Keeping these values in one place makes limits, retention policies, and exit
 * codes easy to audit and test without touching workflow code.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageMetadata = require("../package.json") as { version?: unknown };

export const APP_NAME = "mdreader";
export const APP_DESCRIPTION =
  "Open a Markdown document as sanitized, accessible HTML in your default browser.";
export const APP_VERSION =
  typeof packageMetadata.version === "string"
    ? packageMetadata.version
    : "0.0.0";

/** Directory created inside the operating system temp directory. */
export const TEMP_DIRECTORY_NAME = "mdreader";

/** Prefix for each unique execution directory created with mkdtemp(). */
export const RUN_DIRECTORY_PREFIX = "run-";

/** Name of the generated HTML document inside a run directory. */
export const GENERATED_FILE_NAME = "index.html";

/** Temporary output is retained for this long so browser refreshes keep working. */
export const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Upper bound for input Markdown files (5 MiB). */
export const DEFAULT_MAX_INPUT_BYTES = 5 * 1024 * 1024;

/** Markdown extensions accepted by the CLI. */
export const SUPPORTED_EXTENSIONS = [".md", ".markdown"] as const;

/** Default document language when --lang is not supplied. */
export const DEFAULT_LANGUAGE = "en";

/** Exit codes used by the executable entry point. */
export const EXIT_CODES = {
  success: 0,
  runtimeError: 1,
  usageError: 2,
} as const;

/** Environment variable that enables verbose stack traces. */
export const DEBUG_ENVIRONMENT_VARIABLE = "MDREADER_DEBUG";
