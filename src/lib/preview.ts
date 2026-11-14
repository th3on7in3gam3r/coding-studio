import type { Project } from "./project";
export function resolveLocal(from: string, ref: string): string | null {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) return null;
  const parts = ref.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const part of ref.split(/[?#]/)[0].split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}
const mimes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  woff2: "font/woff2",
  ico: "image/x-icon",
};
export function dataUrl(project: Project, path: string) {
  const mime = mimes[path.split(".").pop() || ""] || "application/octet-stream";
  if (project.assets[path])
    return `data:${mime};base64,${project.assets[path]}`;
  if (project.files[path] !== undefined)
    return `data:${mime};charset=utf-8,${encodeURIComponent(project.files[path])}`;
  return null;
}
export function renderHTML(
  project: Project,
  html?: string,
  runId = "preview",
): string {
  const entry = project.entry;
  const source =
    html ??
    (/\.html?$/.test(entry)
      ? project.files[entry]
      : `<!doctype html><html><head><title>JavaScript preview</title></head><body><div id="app"></div><script src="/${entry.replaceAll('"', "&quot;")}"></script></body></html>`);
  const doc = new DOMParser().parseFromString(source, "text/html");
  // Isolate user code; previews have no access to Studio cookies or storage.
  doc.querySelectorAll("base,meta[http-equiv]").forEach((e) => e.remove());
  const policy = doc.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' data: blob: https:; style-src 'unsafe-inline' data: https:; img-src data: blob: https:; font-src data: https:; connect-src https:; media-src data: blob: https:; form-action 'none'; base-uri 'none'";
  doc.head.prepend(policy);
  const css = (path: string, seen = new Set<string>()): string => {
    if (seen.has(path)) return "";
    seen.add(path);
    return (project.files[path] || "")
      .replace(/@import\s+["']([^"']+)["']\s*;/g, (all, ref) => {
        const local = resolveLocal(path, ref);
        return local && project.files[local] !== undefined
          ? css(local, seen)
          : all;
      })
      .replace(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g, (all, ref) => {
        const local = resolveLocal(path, ref);
        const url = local && dataUrl(project, local);
        return url ? `url("${url}")` : all;
      });
  };
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((e) => {
    const ref = e.getAttribute("href") || "",
      path = resolveLocal(entry, ref);
    if (path && project.files[path] !== undefined) {
      const style = doc.createElement("style");
      style.textContent = css(path);
      e.replaceWith(style);
    } else if (path) throw new Error(`Missing stylesheet: ${path}`);
  });
  doc.querySelectorAll("script[src]").forEach((e) => {
    const path = resolveLocal(entry, e.getAttribute("src") || "");
    if (path && project.files[path] !== undefined) {
      e.removeAttribute("src");
      e.textContent = project.files[path].replace(/<\/script/gi, "<\\/script");
    } else if (path) throw new Error(`Missing script: ${path}`);
  });
  doc.querySelectorAll('[src], [poster], link[rel="icon"]').forEach((e) => {
    for (const attr of ["src", "poster", "href"]) {
      const ref = e.getAttribute(attr);
      if (!ref) continue;
      const path = resolveLocal(entry, ref),
        url = path && dataUrl(project, path);
      if (url) e.setAttribute(attr, url);
    }
  });
  const bridge = doc.createElement("script");
  bridge.textContent = `(()=>{const send=(level,args)=>{try{parent.postMessage({studioRun:${JSON.stringify(runId)},level,text:args.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')},'*')}catch{}};for(const level of ['log','warn','error']){const old=console[level];console[level]=(...args)=>{old(...args);send(level,args)}}addEventListener('error',e=>send('error',[e.message]));addEventListener('unhandledrejection',e=>send('error',[String(e.reason)]));})();`;
  policy.after(bridge);
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}
export function previewWindowHTML(html: string) {
  return `<!doctype html><html><head><title>Studio preview</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block}</style></head><body><iframe title="Project preview" sandbox="allow-scripts" srcdoc="${html.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"></iframe></body></html>`;
}
