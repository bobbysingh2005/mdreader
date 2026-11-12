import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHtmlDocument } from "./html.js";
import { parseMarkdown } from "./markdown.js";

type BrowserLauncher = (url: string) => Promise<void>;

function getNodeErrorCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error) {
    return typeof error.code === "string" ? error.code : undefined;
  }

  return undefined;
}

async function validateMarkdownFile(filePath: string): Promise<string> {
  const resolvedPath = path.resolve(filePath);

  let fileStats;
  try {
    fileStats = await stat(resolvedPath);
  } catch (error: unknown) {
    switch (getNodeErrorCode(error)) {
      case "ENOENT":
        throw new Error(`File not found: ${resolvedPath}`);
      case "EACCES":
      case "EPERM":
        throw new Error(`Permission denied: ${resolvedPath}`);
      default:
        throw error;
    }
  }

  if (!fileStats.isFile()) {
    throw new Error(`Not a file: ${resolvedPath}`);
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  if (extension !== ".md" && extension !== ".markdown") {
    throw new Error(
      `Invalid file type: ${extension || "(none)"}. Only Markdown files are allowed.`,
    );
  }

  return resolvedPath;
}

export async function openMarkdownFile(
  filePath: string,
  launchBrowser: BrowserLauncher,
): Promise<void> {
  const resolvedPath = await validateMarkdownFile(filePath);
  const markdownContent = await readFile(resolvedPath, "utf8");
  const htmlContent = await parseMarkdown(markdownContent);
  const title = path.basename(resolvedPath, path.extname(resolvedPath));
  const baseUrl = new URL("./", pathToFileURL(resolvedPath)).href;
  const document = createHtmlDocument(title, baseUrl, htmlContent);
  // Keep each render isolated because the browser may read it after the CLI exits.
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "mdreader-"));
  const outputPath = path.join(outputDirectory, "document.html");

  try {
    await writeFile(outputPath, document, { encoding: "utf8", mode: 0o600 });
    await launchBrowser(pathToFileURL(outputPath).href);
  } catch (error: unknown) {
    await rm(outputDirectory, { recursive: true, force: true });
    throw error;
  }
}
