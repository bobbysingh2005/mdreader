/**
 * Workflow orchestration. This module composes the pure modules and accepts
 * injected dependencies (browser launcher, clock, temp root, logger) so the
 * complete workflow is testable without side effects.
 */
import path from "node:path";
import { HELP_TEXT, parseArguments } from "./args.js";
import { openInBrowser, type BrowserLauncher } from "./browser.js";
import {
  APP_VERSION,
  DEFAULT_MAX_INPUT_BYTES,
  DEFAULT_RETENTION_MS,
} from "./config.js";
import { readMarkdownFile } from "./file.js";
import { createHtmlDocument } from "./html.js";
import { renderMarkdown } from "./markdown.js";
import {
  cleanupExpiredRuns,
  createRun,
  getDefaultTempRoot,
  writeCustomOutput,
  writeHtmlFile,
} from "./temp.js";

export interface CliLogger {
  info(message: string): void;
}

export interface CliDependencies {
  launchBrowser?: BrowserLauncher;
  logger?: CliLogger;
  now?: () => number;
  tempRootDirectory?: string;
  maxInputBytes?: number;
  retentionMs?: number;
}

export type CliResult =
  | { action: "help" }
  | { action: "version" }
  | { action: "rendered"; outputPath: string; opened: boolean };

const defaultLogger: CliLogger = {
  info: (message) => {
    process.stdout.write(`${message}\n`);
  },
};

function defaultDocumentTitle(
  title: string | null,
  markdownTitle: string | null,
  filePath: string,
): string {
  if (title !== null) {
    return title;
  }

  if (markdownTitle !== null) {
    return markdownTitle;
  }

  return path.basename(filePath, path.extname(filePath));
}

/**
 * Execute the CLI workflow.
 *
 * @throws {MdreaderError} for expected validation, file, rendering, storage, or
 * browser failures. The entry point converts errors into stderr and exit codes.
 */
export async function run(
  argv: readonly string[],
  dependencies: CliDependencies = {},
): Promise<CliResult> {
  const args = parseArguments(argv);
  const logger = dependencies.logger ?? defaultLogger;

  if (args.help) {
    logger.info(HELP_TEXT);
    return { action: "help" };
  }

  if (args.version) {
    logger.info(APP_VERSION);
    return { action: "version" };
  }

  const tempRootDirectory =
    dependencies.tempRootDirectory ?? getDefaultTempRoot();
  const retentionMs = dependencies.retentionMs ?? DEFAULT_RETENTION_MS;

  if (args.cleanup) {
    await cleanupExpiredRuns({
      rootDirectory: tempRootDirectory,
      retentionMs,
      now: dependencies.now?.() ?? Date.now(),
    });
  }

  const inputPath = args.inputPath;
  if (inputPath === null) {
    // parseArguments guarantees this cannot happen without --help/--version.
    throw new Error("No input Markdown file was provided.");
  }

  logger.info("Reading Markdown file...");
  const file = await readMarkdownFile(
    inputPath,
    dependencies.maxInputBytes === undefined
      ? {}
      : { maxBytes: dependencies.maxInputBytes },
  );

  logger.info("Converting Markdown...");
  const rendered = await renderMarkdown(file.content, {
    sourceUrl: file.sourceUrl,
    allowRemoteResources: args.allowRemoteResources,
  });

  const title = defaultDocumentTitle(
    args.title,
    rendered.title,
    file.resolvedPath,
  );

  logger.info("Generating HTML...");
  const document = createHtmlDocument({
    title,
    language: args.language,
    content: rendered.html,
  });

  let outputPath: string;

  if (args.outputPath !== null) {
    outputPath = await writeCustomOutput({
      inputPath: file.resolvedPath,
      outputPath: args.outputPath,
      html: document,
    });
  } else {
    const tempRun = await createRun({ rootDirectory: tempRootDirectory });
    outputPath = tempRun.htmlPath;
    await writeHtmlFile(outputPath, document);
  }

  logger.info(`HTML generated: ${outputPath}`);

  if (!args.open) {
    logger.info("Browser not opened (--no-open).");
    return { action: "rendered", outputPath, opened: false };
  }

  logger.info("Opening default browser...");
  await openInBrowser(outputPath, dependencies.launchBrowser);
  logger.info("Markdown opened successfully.");

  return { action: "rendered", outputPath, opened: true };
}
