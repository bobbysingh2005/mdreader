/**
 * Typed error hierarchy for expected failure modes. Each error carries the exit
 * code the executable entry point should expose to the shell.
 */
import { EXIT_CODES } from "./config.js";

export interface MdreaderErrorOptions {
  cause?: unknown;
  exitCode?: number;
}

export class MdreaderError extends Error {
  readonly exitCode: number;

  constructor(message: string, options: MdreaderErrorOptions = {}) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = new.target.name;
    this.exitCode = options.exitCode ?? EXIT_CODES.runtimeError;
  }
}

export class CliValidationError extends MdreaderError {
  constructor(
    message: string,
    options: Omit<MdreaderErrorOptions, "exitCode"> = {},
  ) {
    super(message, { ...options, exitCode: EXIT_CODES.usageError });
  }
}

export class FileAccessError extends MdreaderError {}

export class MarkdownError extends MdreaderError {}

export class SanitizationError extends MdreaderError {}

export class HtmlGenerationError extends MdreaderError {}

export class BrowserLaunchError extends MdreaderError {}

export class TempStorageError extends MdreaderError {}

export class OutputWriteError extends TempStorageError {}

export interface FormattedError {
  message: string;
  exitCode: number;
  stack?: string;
}

/** Convert any thrown value into a user-facing message and exit code. */
export function formatError(error: unknown, debug = false): FormattedError {
  if (error instanceof MdreaderError) {
    return {
      message: error.message,
      exitCode: error.exitCode,
      ...(debug && error.stack !== undefined ? { stack: error.stack } : {}),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || "An unexpected error occurred.",
      exitCode: EXIT_CODES.runtimeError,
      ...(debug && error.stack !== undefined ? { stack: error.stack } : {}),
    };
  }

  return {
    message:
      typeof error === "string" && error.length > 0
        ? error
        : "An unexpected error occurred.",
    exitCode: EXIT_CODES.runtimeError,
  };
}

/** Extract a Node.js filesystem error code without leaking unrelated values. */
export function getNodeErrorCode(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return undefined;
}
