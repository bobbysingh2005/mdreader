#!/usr/bin/env node

/**
 * Executable entry point. Owns the only process-level error boundary and the
 * only place that sets process.exitCode.
 */
import process from "node:process";
import { run } from "./cli.js";
import { DEBUG_ENVIRONMENT_VARIABLE } from "./config.js";
import { formatError } from "./errors.js";

async function main(argv: readonly string[]): Promise<void> {
  const debug =
    process.env[DEBUG_ENVIRONMENT_VARIABLE] === "1" || argv.includes("--debug");

  try {
    await run(argv);
  } catch (error: unknown) {
    const formatted = formatError(error, debug);
    process.stderr.write(`Error: ${formatted.message}\n`);

    if (formatted.stack !== undefined) {
      process.stderr.write(`${formatted.stack}\n`);
    }

    process.exitCode = formatted.exitCode;
  }
}

await main(process.argv.slice(2));
