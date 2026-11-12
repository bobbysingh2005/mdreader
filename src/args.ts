/**
 * Pure command-line parsing and validation. This module never prints, reads
 * files, or exits; it either returns a validated configuration or throws a
 * CliValidationError.
 */
import { DEFAULT_LANGUAGE } from "./config.js";
import { CliValidationError } from "./errors.js";

export interface ParsedArguments {
  inputPath: string | null;
  outputPath: string | null;
  open: boolean;
  cleanup: boolean;
  allowRemoteResources: boolean;
  language: string;
  title: string | null;
  help: boolean;
  version: boolean;
  debug: boolean;
}

export const HELP_TEXT = `mdreader - open Markdown as accessible HTML

Usage:
  mdreader <file.md|file.markdown> [options]

Options:
  -o, --output <path>        Write the HTML document to a custom path
      --no-open              Generate HTML without opening the browser
  -l, --lang <language>      Document language, e.g. en, hi, en-IN (default: en)
  -t, --title <title>        Override the document title
      --no-cleanup           Skip cleanup of expired mdreader temporary files
      --no-remote-resources  Do not load remote images
      --debug                Show stack traces for unexpected errors
  -h, --help                 Show this help
  -v, --version              Show the application version

Examples:
  mdreader README.md
  mdreader README.md --no-open
  mdreader README.md --output ./output/readme.html --no-open

Exit codes:
  0  success
  1  runtime error
  2  invalid command-line usage
`;

const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

type ValueOptionName = "--output" | "--lang" | "--title";
type FlagOptionName =
  "--no-open" | "--no-cleanup" | "--no-remote-resources" | "--debug";

const SHORT_VALUE_OPTIONS: Readonly<Record<string, ValueOptionName>> = {
  "-o": "--output",
  "-l": "--lang",
  "-t": "--title",
};

const SHORT_FLAG_OPTIONS: Readonly<Record<string, "--help" | "--version">> = {
  "-h": "--help",
  "-v": "--version",
};

function usageError(message: string): CliValidationError {
  return new CliValidationError(`${message} Use --help for usage.`);
}

function assertSingleValue(value: string, option: string): string {
  if (value.length === 0 || value.trim().length === 0) {
    throw usageError(`Option ${option} requires a non-empty value.`);
  }

  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw usageError(`Option ${option} contains an invalid control character.`);
  }

  return value;
}

function assertLanguage(value: string): string {
  const language = assertSingleValue(value, "--lang");
  if (!LANGUAGE_PATTERN.test(language)) {
    throw usageError(
      `Invalid language tag "${language}". Use a BCP 47 tag such as en, hi, or en-IN.`,
    );
  }

  return language;
}

function assertTitle(value: string): string {
  return assertSingleValue(value, "--title");
}

function assertOutputPath(value: string): string {
  return assertSingleValue(value, "--output");
}

function splitLongOption(token: string): {
  name: string;
  inlineValue?: string;
} {
  const equalsIndex = token.indexOf("=");
  if (equalsIndex === -1) {
    return { name: token };
  }

  return {
    name: token.slice(0, equalsIndex),
    inlineValue: token.slice(equalsIndex + 1),
  };
}

function splitShortOption(token: string): {
  name: string;
  inlineValue?: string;
} {
  const equalsIndex = token.indexOf("=");
  if (equalsIndex === -1) {
    return { name: token };
  }

  return {
    name: token.slice(0, equalsIndex),
    inlineValue: token.slice(equalsIndex + 1),
  };
}

/**
 * Parse argv into a validated configuration object.
 *
 * Supports long options (`--output path`, `--output=path`), short aliases
 * (`-o path`, `-o=path`), `--` as an end-of-options marker, and rejects
 * unknown, duplicated, or conflicting options.
 */
export function parseArguments(argv: readonly string[]): ParsedArguments {
  const seenOptions = new Set<string>();
  const positionals: string[] = [];
  let help = false;
  let version = false;
  let debug = false;
  let open = true;
  let cleanup = true;
  let allowRemoteResources = true;
  let outputPath: string | null = null;
  let language = DEFAULT_LANGUAGE;
  let title: string | null = null;
  let endOfOptions = false;
  let index = 0;

  const markSeen = (name: string): void => {
    if (seenOptions.has(name)) {
      throw usageError(`Option ${name} was provided more than once.`);
    }

    seenOptions.add(name);
  };

  while (index < argv.length) {
    const token = argv[index];

    if (token === undefined) {
      break;
    }

    if (endOfOptions) {
      positionals.push(token);
      index += 1;
      continue;
    }

    if (token === "--") {
      endOfOptions = true;
      index += 1;
      continue;
    }

    if (!token.startsWith("-") || token === "-") {
      if (token === "-") {
        throw usageError(
          'Unknown option "-". Reading from standard input is not supported.',
        );
      }

      positionals.push(token);
      index += 1;
      continue;
    }

    const { name, inlineValue } = token.startsWith("--")
      ? splitLongOption(token)
      : splitShortOption(token);

    const normalizedName =
      SHORT_VALUE_OPTIONS[name] ?? SHORT_FLAG_OPTIONS[name] ?? name;

    if (normalizedName === "--help") {
      markSeen("--help");
      help = true;
      index += 1;
      continue;
    }

    if (normalizedName === "--version") {
      markSeen("--version");
      version = true;
      index += 1;
      continue;
    }

    if (normalizedName === "--no-open") {
      if (inlineValue !== undefined) {
        throw usageError("Option --no-open does not accept a value.");
      }

      markSeen("--no-open");
      open = false;
      index += 1;
      continue;
    }

    if (normalizedName === "--no-cleanup") {
      if (inlineValue !== undefined) {
        throw usageError("Option --no-cleanup does not accept a value.");
      }

      markSeen("--no-cleanup");
      cleanup = false;
      index += 1;
      continue;
    }

    if (normalizedName === "--no-remote-resources") {
      if (inlineValue !== undefined) {
        throw usageError(
          "Option --no-remote-resources does not accept a value.",
        );
      }

      markSeen("--no-remote-resources");
      allowRemoteResources = false;
      index += 1;
      continue;
    }

    if (normalizedName === "--debug") {
      if (inlineValue !== undefined) {
        throw usageError("Option --debug does not accept a value.");
      }

      markSeen("--debug");
      debug = true;
      index += 1;
      continue;
    }

    if (
      normalizedName === "--output" ||
      normalizedName === "--lang" ||
      normalizedName === "--title"
    ) {
      markSeen(normalizedName);

      let value = inlineValue;
      if (value === undefined) {
        const nextValue = argv[index + 1];
        if (nextValue === undefined || nextValue.startsWith("-")) {
          throw usageError(`Option ${normalizedName} requires a value.`);
        }

        value = nextValue;
        index += 1;
      }

      if (normalizedName === "--output") {
        outputPath = assertOutputPath(value);
      } else if (normalizedName === "--lang") {
        language = assertLanguage(value);
      } else {
        title = assertTitle(value);
      }

      index += 1;
      continue;
    }

    throw usageError(`Unknown option "${name}".`);
  }

  if (help && version) {
    throw new CliValidationError(
      "Options --help and --version cannot be combined. Use one at a time.",
    );
  }

  if ((help || version) && (positionals.length > 0 || seenOptions.size > 1)) {
    const action = help ? "--help" : "--version";
    throw new CliValidationError(
      `Option ${action} cannot be combined with a file or other options.`,
    );
  }

  if (positionals.length > 1) {
    throw usageError("Only one Markdown file can be provided at a time.");
  }

  const inputPath = positionals[0] ?? null;
  if (!help && !version && inputPath === null) {
    throw usageError("Please provide a Markdown file path.");
  }

  if (inputPath !== null) {
    if (inputPath.length === 0 || CONTROL_CHARACTER_PATTERN.test(inputPath)) {
      throw usageError("The Markdown file path is invalid.");
    }
  }

  return {
    inputPath,
    outputPath,
    open,
    cleanup,
    allowRemoteResources,
    language,
    title,
    help,
    version,
    debug,
  };
}
