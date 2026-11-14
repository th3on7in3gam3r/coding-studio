import { safePath, type Project } from "./project";

/** A proposed change to one file. `before` is the file as it was when proposed. */
export type Suggestion = {
  id: string;
  title: string;
  description: string;
  path: string;
  before: string;
  after: string;
  /** True when the change creates a file that did not exist. */
  isNew?: boolean;
  source: "local" | "ai";
};

let counter = 0;
const nextId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

export function localSuggestions(project: Project, path: string): Suggestion[] {
  const code = project.files[path];
  if (code === undefined) return [];
  const result: Suggestion[] = [];
  const add = (title: string, description: string, after: string) =>
    result.push({
      id: nextId(),
      title,
      description,
      path,
      before: code,
      after,
      source: "local",
    });
  if (
    /\.html?$/.test(path) &&
    !/<meta[^>]+name=["']viewport["']/i.test(code) &&
    /<head[\s>]/i.test(code)
  )
    add(
      "Make the page fit mobile screens",
      "Add the viewport meta tag inside the document head.",
      code.replace(
        /(<head[^>]*>)/i,
        '$1\n<meta name="viewport" content="width=device-width, initial-scale=1">',
      ),
    );
  if (/\.html?$/.test(path) && /<html(?![^>]*\blang=)[^>]*>/i.test(code))
    add(
      "Declare the page language",
      "Screen readers use the lang attribute to pick the right voice.",
      code.replace(/<html(?![^>]*\blang=)([^>]*)>/i, '<html lang="en"$1>'),
    );
  if (/\.css$/.test(path) && !code.includes("prefers-reduced-motion"))
    add(
      "Respect reduced motion",
      "Keep animation optional for visitors who prefer less motion.",
      code +
        "\n\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n    scroll-behavior: auto !important;\n  }\n}\n",
    );
  if (/\.css$/.test(path) && !code.includes(":focus-visible"))
    add(
      "Show keyboard focus",
      "Add a visible focus indicator to interactive controls.",
      code +
        "\n\n:focus-visible {\n  outline: 3px solid #a99aff;\n  outline-offset: 4px;\n}\n",
    );
  return result;
}

export const CHANGES_OPEN = "<studio-changes>";
export const CHANGES_CLOSE = "</studio-changes>";

/** Text shown to the user while a reply streams: everything before the changes block. */
export function visibleReply(text: string) {
  const i = text.indexOf(CHANGES_OPEN);
  return (i === -1 ? text : text.slice(0, i)).trimEnd();
}

/**
 * Validate the changes block of a model reply against the files that were
 * sent as context. Changes may edit a context file or create a new file.
 */
export function parseChanges(
  text: string,
  files: Record<string, string>,
  existing: Set<string>,
): Suggestion[] {
  const start = text.indexOf(CHANGES_OPEN);
  if (start === -1) return [];
  const end = text.indexOf(CHANGES_CLOSE, start);
  if (end === -1) throw new Error("AI reply was cut off before its changes finished");
  const raw = text
    .slice(start + CHANGES_OPEN.length, end)
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  const input: unknown = JSON.parse(raw);
  if (!Array.isArray(input) || input.length > 6)
    throw new Error("AI returned an invalid list of changes");
  return input.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid change");
    const c = item as Record<string, unknown>;
    if (
      typeof c.path !== "string" ||
      typeof c.title !== "string" ||
      c.title.length > 120 ||
      typeof c.description !== "string" ||
      c.description.length > 1000 ||
      typeof c.content !== "string" ||
      c.content.length > 200_000
    )
      throw new Error("AI returned an invalid file change");
    safePath(c.path);
    const known = Object.hasOwn(files, c.path);
    if (!known && existing.has(c.path))
      throw new Error(`AI tried to edit ${c.path}, which it was not shown`);
    const before = known ? files[c.path] : "";
    if (c.content === before) throw new Error("AI returned an unchanged file");
    return {
      id: nextId(),
      title: c.title,
      description: c.description,
      path: c.path,
      before,
      after: c.content,
      isNew: !known,
      source: "ai" as const,
    };
  });
}

/** Packages imported by a JS/TS file that package.json does not list. */
export function missingPackages(project: Project, path: string, code: string) {
  if (!/\.(m?[jt]sx?)$/.test(path)) return [];
  let deps: Record<string, unknown> = {};
  try {
    const pkg = JSON.parse(project.files["package.json"] || "{}");
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    /* treat as no dependencies */
  }
  const found = new Set<string>();
  for (const m of code.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"'./][^"']*)["']/g)) {
    const spec = m[1];
    if (spec.startsWith("node:") || spec.startsWith("@/")) continue;
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    if (!(name in deps)) found.add(name);
  }
  return [...found];
}

/** Rough motion check used in the review screen. */
export function motionCheck(before: string, after: string) {
  const anim = /(@keyframes|animation\s*:|transition\s*:|motion\.|animate=|\.animate\()/;
  const guard = /(prefers-reduced-motion|useReducedMotion|reducedMotion)/;
  const added = anim.test(after) && !anim.test(before);
  if (!added && !anim.test(after)) return "none" as const;
  return guard.test(after) ? ("ok" as const) : ("warn" as const);
}
