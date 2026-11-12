import open from "open";
import { openMarkdownFile } from "./reader.js";

const helpText = `mdreader - open a Markdown document in your browser

Usage:
  mdreader <file.md|file.markdown>
  mdreader --help
`;

type BrowserLauncher = (url: string) => Promise<void>;

async function launchInBrowser(url: string): Promise<void> {
  await open(url);
}

export async function run(
  args: string[],
  launchBrowser: BrowserLauncher = launchInBrowser,
): Promise<void> {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    process.stdout.write(helpText);
    return;
  }

  if (args.length === 0) {
    throw new Error(
      "Please provide a Markdown file path. Use --help for usage.",
    );
  }

  if (args.length > 1) {
    throw new Error("Only one Markdown file can be provided at a time.");
  }

  const filePath = args[0];
  if (filePath === undefined) {
    throw new Error(
      "Please provide a Markdown file path. Use --help for usage.",
    );
  }

  await openMarkdownFile(filePath, launchBrowser);
}
