/**
 * Generated-output storage.
 *
 * Temporary runs live under `<os.tmpdir()>/mdreader/run-XXXXXX/index.html`.
 * Cleanup only touches direct child directories whose names carry the mdreader
 * run prefix, never follows symbolic links, and ignores its own failures.
 * Custom output paths may overwrite an existing HTML file but never the source
 * Markdown file (collision checks cover path aliases, symlinks, and hard links).
 */
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEFAULT_RETENTION_MS,
  GENERATED_FILE_NAME,
  RUN_DIRECTORY_PREFIX,
  TEMP_DIRECTORY_NAME,
} from "./config.js";
import {
  OutputWriteError,
  TempStorageError,
  getNodeErrorCode,
} from "./errors.js";

export interface TempRun {
  runDirectory: string;
  htmlPath: string;
}

export interface CreateRunOptions {
  rootDirectory?: string;
}

export interface CleanupOptions {
  rootDirectory?: string;
  retentionMs?: number;
  now?: number;
}

export interface CleanupFailure {
  path: string;
  reason: string;
}

export interface CleanupResult {
  removed: string[];
  failures: CleanupFailure[];
}

export interface CustomOutputOptions {
  inputPath: string;
  outputPath: string;
  html: string;
}

/** Default application-owned directory inside the operating system temp dir. */
export function getDefaultTempRoot(): string {
  return path.join(tmpdir(), TEMP_DIRECTORY_NAME);
}

function normalizeForComparison(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function isSameFile(
  inputPath: string,
  outputPath: string,
): Promise<boolean> {
  if (
    normalizeForComparison(inputPath) === normalizeForComparison(outputPath)
  ) {
    return true;
  }

  try {
    const [inputStats, outputStats] = await Promise.all([
      stat(inputPath),
      stat(outputPath),
    ]);

    if (
      inputStats.dev === outputStats.dev &&
      inputStats.ino === outputStats.ino
    ) {
      return true;
    }
  } catch {
    // The output may not exist yet; fall through to realpath comparison.
  }

  try {
    const [inputRealPath, outputRealPath] = await Promise.all([
      realpath(inputPath),
      realpath(outputPath),
    ]);

    return (
      normalizeForComparison(inputRealPath) ===
      normalizeForComparison(outputRealPath)
    );
  } catch {
    return false;
  }
}

/** Create a unique application-owned run directory. */
export async function createRun(
  options: CreateRunOptions = {},
): Promise<TempRun> {
  const rootDirectory = options.rootDirectory ?? getDefaultTempRoot();

  try {
    await mkdir(rootDirectory, { recursive: true, mode: 0o700 });
    const runDirectory = await mkdtemp(
      path.join(rootDirectory, RUN_DIRECTORY_PREFIX),
    );

    return {
      runDirectory,
      htmlPath: path.join(runDirectory, GENERATED_FILE_NAME),
    };
  } catch (cause: unknown) {
    throw new TempStorageError(
      `Could not create a temporary output directory under ${rootDirectory}.`,
      { cause },
    );
  }
}

/** Write generated HTML as UTF-8 with owner-only permissions. */
export async function writeHtmlFile(
  filePath: string,
  html: string,
): Promise<void> {
  try {
    await writeFile(filePath, html, { encoding: "utf8", mode: 0o600 });
  } catch (cause: unknown) {
    throw new TempStorageError(
      `Could not write the generated HTML file: ${filePath}.`,
      { cause },
    );
  }
}

/**
 * Remove expired mdreader run directories. Never deletes the root directory,
 * unrelated entries, recent runs, or symbolic links.
 */
export async function cleanupExpiredRuns(
  options: CleanupOptions = {},
): Promise<CleanupResult> {
  const rootDirectory = options.rootDirectory ?? getDefaultTempRoot();
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
  const now = options.now ?? Date.now();
  const result: CleanupResult = { removed: [], failures: [] };

  let entries;
  try {
    entries = await readdir(rootDirectory, { withFileTypes: true });
  } catch (error: unknown) {
    if (getNodeErrorCode(error) !== "ENOENT") {
      result.failures.push({
        path: rootDirectory,
        reason:
          error instanceof Error ? error.message : "Unknown cleanup error",
      });
    }

    return result;
  }

  for (const entry of entries) {
    if (!entry.name.startsWith(RUN_DIRECTORY_PREFIX)) {
      continue;
    }

    const entryPath = path.join(rootDirectory, entry.name);

    try {
      const entryStats = await lstat(entryPath);

      if (!entryStats.isDirectory() || entryStats.isSymbolicLink()) {
        continue;
      }

      if (now - entryStats.mtimeMs < retentionMs) {
        continue;
      }

      await rm(entryPath, { recursive: true, force: true });
      result.removed.push(entryPath);
    } catch (error: unknown) {
      result.failures.push({
        path: entryPath,
        reason:
          error instanceof Error ? error.message : "Unknown cleanup error",
      });
    }
  }

  return result;
}

/** Resolve a custom output path and refuse to overwrite the input Markdown. */
export async function writeCustomOutput(
  options: CustomOutputOptions,
): Promise<string> {
  const resolvedOutput = path.resolve(options.outputPath);

  if (await isSameFile(options.inputPath, resolvedOutput)) {
    throw new OutputWriteError(
      `Refusing to overwrite the input Markdown file: ${resolvedOutput}. Choose a different --output path.`,
    );
  }

  try {
    const outputStats = await stat(resolvedOutput);
    if (outputStats.isDirectory()) {
      throw new OutputWriteError(
        `The output path is a directory, not a file: ${resolvedOutput}.`,
      );
    }
  } catch (error: unknown) {
    if (error instanceof OutputWriteError) {
      throw error;
    }

    if (getNodeErrorCode(error) !== "ENOENT") {
      throw new OutputWriteError(
        `Could not inspect output path: ${resolvedOutput}.`,
        { cause: error },
      );
    }
  }

  try {
    await mkdir(path.dirname(resolvedOutput), { recursive: true });
  } catch (cause: unknown) {
    throw new OutputWriteError(
      `Could not create the output directory for: ${resolvedOutput}.`,
      { cause },
    );
  }

  try {
    await writeFile(resolvedOutput, options.html, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch (cause: unknown) {
    throw new OutputWriteError(
      `Could not write HTML to: ${resolvedOutput}. Check permissions and disk space.`,
      { cause },
    );
  }

  return resolvedOutput;
}
