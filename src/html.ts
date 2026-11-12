function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] ?? character;
  });
}

export function createHtmlDocument(
  title: string,
  baseUrl: string,
  content: string,
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base href="${escapeHtml(baseUrl)}">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { margin: 0 auto; max-width: 52rem; padding: 2rem 1.25rem 4rem; line-height: 1.7; }
      img { height: auto; max-width: 100%; }
      pre { overflow-x: auto; padding: 1rem; background: color-mix(in srgb, CanvasText 8%, Canvas); }
      code { font-family: ui-monospace, monospace; }
      table { border-collapse: collapse; display: block; overflow-x: auto; }
      th, td { border: 1px solid currentColor; padding: 0.4rem 0.7rem; }
      a { text-underline-offset: 0.15em; }
      :focus-visible { outline: 3px solid Highlight; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
      <article>
${content}
      </article>
    </main>
  </body>
</html>
`;
}
