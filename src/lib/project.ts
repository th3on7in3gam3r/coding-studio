export type Mode = "html" | "js" | "nextjs" | "php";
export type Project = {
  id: string;
  name: string;
  mode: Mode;
  files: Record<string, string>;
  assets: Record<string, string>;
  folders: string[];
  entry: string;
  updated: number;
  /** Optional Agent Relay project slug linked to this project. */
  relay?: string;
};
export type Workspace = { version: 1; activeId: string; projects: Project[] };
export const LIMIT = 12 * 1024 * 1024;
export function safePath(path: string): string {
  if (
    !path ||
    path.length > 240 ||
    path.startsWith("/") ||
    /[\\\x00-\x1f:]/.test(path) ||
    path.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new Error(`Invalid project path: ${path}`);
  if (
    path
      .split("/")
      .some(
        (p) =>
          [
            "node_modules",
            ".git",
            ".next",
            ".vercel",
            "__proto__",
            "constructor",
            "prototype",
          ].includes(p) || /^\.env($|\.)/.test(p),
      )
  )
    throw new Error(`Excluded generated or secret path: ${path}`);
  return path;
}
export function validateProject(input: unknown): Project {
  if (!input || typeof input !== "object") throw new Error("Invalid project");
  const p = input as Project;
  if (
    !["html", "js", "nextjs", "php"].includes(p.mode) ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 80 ||
    !p.files ||
    typeof p.files !== "object" ||
    Array.isArray(p.files)
  )
    throw new Error("Invalid project format");
  const files: Record<string, string> = Object.create(null),
    assets: Record<string, string> = Object.create(null);
  let size = 0;
  for (const [path, content] of Object.entries(p.files)) {
    safePath(path);
    if (typeof content !== "string")
      throw new Error("File contents must be text");
    files[path] = content;
    size += new TextEncoder().encode(content).length;
  }
  for (const [path, content] of Object.entries(p.assets || {})) {
    safePath(path);
    if (
      path in files ||
      typeof content !== "string" ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(content)
    )
      throw new Error("Invalid asset");
    assets[path] = content;
    size += content.length;
  }
  if (
    !Object.keys(files).length ||
    Object.keys(files).length + Object.keys(assets).length > 500 ||
    size > LIMIT
  )
    throw new Error("Project limit: 500 files, 12 MB");
  const folders = (p.folders || []).map(safePath);
  if (folders.length > 500) throw new Error("Too many folders");
  if (typeof p.entry !== "string" || !(p.entry in files))
    throw new Error("Select an entry file present in the project");
  return {
    id: typeof p.id === "string" ? p.id : crypto.randomUUID(),
    name: p.name.trim(),
    mode: p.mode,
    files,
    assets,
    folders,
    entry: p.entry,
    updated: Date.now(),
    ...(typeof p.relay === "string" && RELAY_SLUG.test(p.relay)
      ? { relay: p.relay }
      : {}),
  };
}
export const RELAY_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
export function relaySlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 63) || "project"
  );
}
const style = `:root{font-family:system-ui;color:#e8e9ff;background:#10121d}body{margin:0;padding:64px 8%;}h1{font-size:clamp(2.5rem,7vw,5rem);line-height:1.05;max-width:700px}span{color:#a99aff}p{color:#a9b1c8;font-size:1.1rem}button{background:#a99aff;color:#171329;border:0;border-radius:10px;padding:14px 22px;cursor:pointer}button:hover{background:#c9bfff}.card{margin-top:32px;border:1px solid #38394d;border-radius:16px;padding:24px}`;
export function template(mode: Mode): Project {
  let files: Record<string, string>, entry: string;
  if (mode === "nextjs") {
    entry = "app/page.tsx";
    files = {
      "package.json": JSON.stringify(
        {
          name: "studio-next-app",
          version: "1.0.0",
          private: true,
          scripts: { dev: "next dev --webpack -H 0.0.0.0" },
          dependencies: {
            next: "16.4.6",
            react: "19.3.0",
            "react-dom": "19.3.0",
          },
          devDependencies: {
            typescript: "^5",
            "@types/node": "^20",
            "@types/react": "^19",
            "@types/react-dom": "^19",
          },
        },
        null,
        2,
      ),
      "app/page.tsx": `'use client';\nimport { useState } from 'react';\nexport default function Home() {\n  const [count, setCount] = useState(0);\n  return <main><p>YOUR NEXT IDEA STARTS HERE</p><h1>Build something<br/><span>worth sharing.</span></h1><p>Edit this file. Run your actual Next.js application.</p><button onClick={() => setCount(count + 1)}>Clicked {count} times</button></main>;\n}\n`,
      "app/layout.tsx": `import './globals.css';\nexport default function Layout({children}: {children: React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}\n`,
      "app/globals.css": style,
      "next.config.mjs": "export default { devIndicators: false };\n",
    };
  } else if (mode === "php") {
    entry = "index.php";
    files = {
      "index.php": `<?php\n$title = 'Hello from PHP ' . PHP_VERSION;\n$items = ['Create', 'Experiment', 'Share'];\n?>\n<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PHP project</title><link rel="stylesheet" href="style.css"></head><body>\n<h1><?= htmlspecialchars($title) ?></h1>\n<p>This output is generated by real PHP running in your browser.</p>\n<?php foreach ($items as $item): ?>\n<div class="card"><?= htmlspecialchars($item) ?></div>\n<?php endforeach; ?>\n</body></html>`,
      "style.css": style,
    };
  } else {
    entry = "index.html";
    files = {
      "index.html": `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>My Studio project</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<p>YOUR NEXT IDEA STARTS HERE</p>\n<h1>Build something<br><span>worth sharing.</span></h1>\n<p>Edit your files, then press Run preview.</p>\n<button id="counter">Clicked 0 times</button>\n<script src="main.js"></script>\n</body>\n</html>`,
      "style.css": style,
      "main.js": `let count = 0;\ndocument.querySelector('#counter').addEventListener('click', (event) => {\n  event.target.textContent = 'Clicked ' + (++count) + ' times';\n  console.log('Count:', count);\n});\n`,
    };
  }
  return {
    id: crypto.randomUUID(),
    name:
      mode === "nextjs" ? "My Next.js app" : `My ${mode.toUpperCase()} project`,
    mode,
    files,
    assets: {},
    folders: [],
    entry,
    updated: Date.now(),
  };
}
export function detectMode(files: Record<string, string>): Mode {
  if (Object.keys(files).some((p) => p.endsWith(".php"))) return "php";
  if (
    Object.keys(files).some(
      (p) => /(^|\/)package.json$/.test(p) && /"next"/.test(files[p]),
    )
  )
    return "nextjs";
  return "index.html" in files ? "html" : "js";
}
export function replaceFile(
  project: Project,
  path: string,
  before: string,
  after: string,
): Project {
  if (project.files[path] !== before)
    throw new Error(
      "File changed since this suggestion. Generate a fresh suggestion.",
    );
  return validateProject({
    ...project,
    files: { ...project.files, [path]: after },
  });
}
