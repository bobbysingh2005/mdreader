/**
 * Input Markdown path resolution, validation, and UTF-8 reading.
 *
 * Symbolic-link policy: links are followed with stat(), but the extension is
 * checked on the path supplied by the user and the target must be a regular
 * file. Directories, devices, and other special files are rejected.
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_MAX_INPUT_BYTES, SUPPORTED_EXTENSIONS } from "./config.js";
import { FileAccessError, getNodeErrorCode } from "./errors.js";

export interface MarkdownFile {
  resolvedPath: string;
  directory: string;
  sourceUrl: URL;
  content: string;
  sizeBytes: number;
}

export interface ReadMarkdownFileOptions {
  maxBytes?: number;
}

function isSupportedExtension(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.some((supported) => supported === extension);
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function mapStatError(error: unknown, resolvedPath: string): FileAccessError {
  const code = getNodeErrorCode(error);

  switch (code) {
    case "ENOENT":
      return new FileAccessError(
        `Input file not found: ${resolvedPath}. Check the path and try again.`,
        { cause: error },
      );
    case "EACCES":
    case "EPERM":
      return new FileAccessError(
        `Permission denied while accessing: ${resolvedPath}.`,
        { cause: error },
      );
    case "ELOOP":
      return new FileAccessError(
        `Too many symbolic links while resolving: ${resolvedPath}.`,
        { cause: error },
      );
    case "ENAMETOOLONG":
      return new FileAccessError(`Input path is too long: ${resolvedPath}.`, {
        cause: error,
      });
    default:
      return new FileAccessError(
        `Could not access input file: ${resolvedPath}.`,
        { cause: error },
      );
  }
}

/**
 * Validate and read a Markdown file without modifying it.
 *
 * @throws {FileAccessError} for missing, unreadable, oversized, or non-Markdown input.
 */
export async function readMarkdownFile(
  inputPath: string,
  options: ReadMarkdownFileOptions = {},
): Promise<MarkdownFile> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const resolvedPath = path.resolve(inputPath);

  if (!isSupportedExtension(resolvedPath)) {
    const extension = path.extname(resolvedPath).toLowerCase() || "(none)";
    throw new FileAccessError(
      `Unsupported file type "${extension}" for ${resolvedPath}. Only .md and .markdown files are supported.`,
    );
  }

  let fileStats;
  try {
    fileStats = await stat(resolvedPath);
  } catch (error: unknown) {
    throw mapStatError(error, resolvedPath);
  }

  if (fileStats.isDirectory()) {
    throw new FileAccessError(
      `The input path is a directory, not a Markdown file: ${resolvedPath}.`,
    );
  }

  if (!fileStats.isFile()) {
    throw new FileAccessError(
      `The input path is not a regular file: ${resolvedPath}.`,
    );
  }

  if (fileStats.size > maxBytes) {
    throw new FileAccessError(
      `Input file is too large: ${resolvedPath} (${formatMegabytes(fileStats.size)}). Maximum allowed size is ${formatMegabytes(maxBytes)}.`,
    );
  }

  let content: string;
  try {
    content = await readFile(resolvedPath, "utf8");
  } catch (error: unknown) {
    const code = getNodeErrorCode(error);
    const reason =
      code === "EACCES" || code === "EPERM"
        ? "Permission denied"
        : "Could not read";

    throw new FileAccessError(`${reason} input file: ${resolvedPath}.`, {
      cause: error,
    });
  }

  return {
    resolvedPath,
    directory: path.dirname(resolvedPath),
    sourceUrl: pathToFileURL(resolvedPath),
    content,
    sizeBytes: fileStats.size,
  };
}
