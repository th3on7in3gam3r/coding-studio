import type { Project } from "./project";
let worker: Worker | undefined;
let cancel: ((reason: Error) => void) | undefined;
export function stopPHP() {
  worker?.terminate();
  worker = undefined;
  cancel?.(new Error("PHP execution stopped"));
  cancel = undefined;
}
export async function runPHP(
  project: Project,
): Promise<{ html: string; errors: string }> {
  stopPHP();
  return new Promise((resolve, reject) => {
    const w = new Worker("/runtime/php-worker.js", { type: "module" });
    worker = w;
    const timer = setTimeout(
      () => finish(new Error("PHP exceeded the 20 second execution limit")),
      20000,
    );
    const finish = (
      error?: Error,
      result?: { html: string; errors: string },
    ) => {
      clearTimeout(timer);
      w.terminate();
      if (worker === w) worker = undefined;
      cancel = undefined;
      if (error) reject(error);
      else resolve(result!);
    };
    cancel = (e) => finish(e);
    w.onerror = (e) =>
      finish(new Error(e.message || "PHP runtime failed to load"));
    w.onmessage = (e) =>
      e.data.error
        ? finish(new Error(e.data.error))
        : finish(undefined, e.data);
    w.postMessage({
      files: project.files,
      assets: project.assets,
      entry: project.entry,
    });
  });
}
