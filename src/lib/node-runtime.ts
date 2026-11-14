import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import type { Project } from "./project";
let boot: Promise<WebContainer> | undefined;
let server: WebContainerProcess | undefined;
let install: WebContainerProcess | undefined;
let current: { id: string; cwd: string; files: Set<string> } | undefined;
let detach: (() => void) | undefined;
let generation = 0;
export function stopNode() {
  generation++;
  install?.kill();
  server?.kill();
  install = undefined;
  server = undefined;
  detach?.();
  detach = undefined;
  current = undefined;
}
export async function runNode(
  project: Project,
  log: (s: string) => void,
  onReady: (url: string) => void,
) {
  if (!crossOriginIsolated)
    throw new Error(
      "Next.js needs cross-origin isolation. Restart the app after applying the supplied headers, and use Chrome or Edge.",
    );
  stopNode();
  const ticket = generation;
  log("Starting browser Node.js runtime…");
  boot ??= WebContainer.boot({ coep: "credentialless" }).catch((e) => {
    boot = undefined;
    throw e;
  });
  const wc = await boot;
  if (ticket !== generation) return;
  const cwd = "/studio/" + crypto.randomUUID();
  await wc.fs.mkdir(cwd, { recursive: true });
  for (const [path, text] of Object.entries(project.files)) {
    await wc.fs.mkdir(cwd + "/" + path.split("/").slice(0, -1).join("/"), {
      recursive: true,
    });
    await wc.fs.writeFile(cwd + "/" + path, text);
  }
  for (const [path, data] of Object.entries(project.assets)) {
    await wc.fs.mkdir(cwd + "/" + path.split("/").slice(0, -1).join("/"), {
      recursive: true,
    });
    await wc.fs.writeFile(
      cwd + "/" + path,
      Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
    );
  }
  if (ticket !== generation) return;
  log("Installing project dependencies (lifecycle scripts disabled)…");
  install = await wc.spawn(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd },
  );
  void install.output
    .pipeTo(new WritableStream({ write: log }))
    .catch(() => {});
  const code = await install.exit;
  if (ticket !== generation) return;
  if (code !== 0)
    throw new Error("Dependency installation failed. See console output.");
  const pkg = JSON.parse(project.files["package.json"] || "{}");
  if (!pkg.scripts?.dev)
    throw new Error("Your package.json needs a scripts.dev command.");
  detach = wc.on("server-ready", (_port, url) => {
    if (ticket === generation) onReady(url);
  });
  log("Starting npm run dev…");
  server = await wc.spawn("npm", ["run", "dev"], { cwd });
  current = {
    id: project.id,
    cwd,
    files: new Set([
      ...Object.keys(project.files),
      ...Object.keys(project.assets),
    ]),
  };
  void server.output.pipeTo(new WritableStream({ write: log })).catch(() => {});
  void server.exit.then((code) => {
    if (ticket === generation) {
      log(`Dev server exited (${code}).`);
      onReady("");
    }
  });
}
let syncQueue = Promise.resolve();
export function syncNode(project: Project, onError: (e: unknown) => void) {
  const ticket = generation;
  syncQueue = syncQueue
    .catch(() => {})
    .then(async () => {
      if (
        !current ||
        current.id !== project.id ||
        ticket !== generation ||
        !boot
      )
        return;
      const wc = await boot,
        state = current;
      const paths = new Set([
        ...Object.keys(project.files),
        ...Object.keys(project.assets),
      ]);
      for (const old of state.files)
        if (!paths.has(old))
          await wc.fs.rm(state.cwd + "/" + old, { force: true });
      for (const path of paths) {
        if (ticket !== generation) return;
        await wc.fs.mkdir(
          state.cwd + "/" + path.split("/").slice(0, -1).join("/"),
          { recursive: true },
        );
        await wc.fs.writeFile(
          state.cwd + "/" + path,
          project.files[path] ??
            Uint8Array.from(atob(project.assets[path]), (c) => c.charCodeAt(0)),
        );
      }
      state.files = paths;
    })
    .catch(onError);
}
