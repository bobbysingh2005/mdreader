#!/usr/bin/env node

import { run } from "./cli.js";

try {
  await run(process.argv.slice(2));
} catch (error: unknown) {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}
