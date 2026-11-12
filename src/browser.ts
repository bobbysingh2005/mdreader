/**
 * Default-browser integration. The launcher is injectable so tests never open
 * a real browser.
 */
import { pathToFileURL } from "node:url";
import open from "open";
import { BrowserLaunchError } from "./errors.js";

export type BrowserLauncher = (url: string) => Promise<unknown>;

/** Convert an absolute filesystem path into a valid file URL. */
export function toFileUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

/**
 * Open a generated HTML file in the default browser.
 *
 * @throws {BrowserLaunchError} with the retained file path on failure.
 */
export async function openInBrowser(
  filePath: string,
  launcher: BrowserLauncher = open,
): Promise<void> {
  try {
    await launcher(toFileUrl(filePath));
  } catch (cause: unknown) {
    throw new BrowserLaunchError(
      `Could not open the default browser. The generated HTML is still available at: ${filePath}`,
      { cause },
    );
  }
}
