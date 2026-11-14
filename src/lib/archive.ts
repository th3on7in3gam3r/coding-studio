import JSZip from "jszip";
import {
  detectMode,
  LIMIT,
  safePath,
  validateProject,
  type Project,
} from "./project";
const META = ".coding-studio.json";
export async function importProject(file: File): Promise<Project> {
  if (file.size > LIMIT) throw new Error("Import limit is 12 MB");
  if (file.name.endsWith(".json"))
    return validateProject(JSON.parse(await file.text()));
  if (!file.name.endsWith(".zip"))
    throw new Error("Choose a Studio JSON backup or project ZIP");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files);
  if (entries.length > 1000) throw new Error("Archive has too many entries");
  // JSZip normalizes traversal names; reject their original values too.
  const originals = entries.map(
    (e) =>
      (e as unknown as { unsafeOriginalName?: string }).unsafeOriginalName ||
      e.name,
  );
  for (const path of originals) {
    if (
      path.startsWith("/") ||
      path.split(/[\\/]/).includes("..") ||
      path.includes("\\")
    )
      throw new Error("Unsafe archive path");
  }
  let paths = entries.filter((e) => !e.dir).map((e) => e.name);
  const root =
    paths.length &&
    paths.every(
      (p) => p.includes("/") && p.split("/")[0] === paths[0].split("/")[0],
    )
      ? paths[0].split("/")[0] + "/"
      : "";
  const files: Record<string, string> = Object.create(null),
    assets: Record<string, string> = Object.create(null),
    folders: string[] = [];
  let size = 0,
    metadata: Partial<Project> = {};
  for (const entry of entries) {
    const path = entry.name.slice(root.length).replace(/\/$/, "");
    if (!path) continue;
    if (
      path
        .split("/")
        .some(
          (p) =>
            ["node_modules", ".git", ".next", ".vercel", "__MACOSX"].includes(
              p,
            ) || /^\.env($|\.)/.test(p),
        )
    )
      continue;
    safePath(path);
    if (entry.dir) {
      folders.push(path);
      continue;
    }
    // Stop ZIP bombs before decompression, then check actual decoded bytes.
    const declared = (
      entry as unknown as { _data?: { uncompressedSize?: number } }
    )._data?.uncompressedSize;
    if (declared && declared + size > LIMIT)
      throw new Error("Expanded archive exceeds 12 MB");
    const bytes = await entry.async("uint8array");
    size += bytes.byteLength;
    if (size > LIMIT) throw new Error("Expanded archive exceeds 12 MB");
    if (path === META) {
      metadata = JSON.parse(new TextDecoder().decode(bytes));
      continue;
    }
    try {
      files[path] = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (bytes.includes(0)) {
        delete files[path];
        assets[path] = await entry.async("base64");
      }
    } catch {
      assets[path] = await entry.async("base64");
    }
  }
  paths = Object.keys(files);
  const mode = metadata.mode || detectMode(files);
  const entry =
    metadata.entry && metadata.entry in files
      ? metadata.entry
      : paths.find(
          (p) =>
            p ===
            (mode === "php"
              ? "index.php"
              : mode === "nextjs"
                ? "app/page.tsx"
                : "index.html"),
        ) ||
        paths.find((p) => p.endsWith(mode === "php" ? ".php" : ".html")) ||
        paths[0];
  return validateProject({
    id: crypto.randomUUID(),
    name: metadata.name || file.name.replace(/\.zip$/, ""),
    mode,
    entry,
    files,
    assets,
    folders,
  });
}
export async function exportZip(project: Project): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(project.files))
    zip.file(path, content);
  for (const [path, content] of Object.entries(project.assets))
    zip.file(path, content, { base64: true });
  for (const path of project.folders) zip.folder(path);
  zip.file(
    META,
    JSON.stringify(
      { name: project.name, mode: project.mode, entry: project.entry },
      null,
      2,
    ),
  );
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
