"use client";
import { forwardRef } from "react";
import { ExternalLink, Eye, Monitor, Play, RotateCw, Smartphone, Tablet } from "lucide-react";
import type { Mode, Project } from "@/lib/project";
import { cn } from "@/lib/utils";
import type { Device } from "./types";
import { Button, IconButton, Segmented } from "./ui";

export type PreviewState = { kind: "html" | "node"; value: string; runId: string } | null;

const widths: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  phone: "390px",
};
const labels: Record<Mode, string> = {
  html: "HTML + CSS",
  js: "JavaScript",
  nextjs: "Next.js",
  php: "PHP",
};

export const PreviewPane = forwardRef<
  HTMLIFrameElement,
  {
    project: Project;
    preview: PreviewState;
    busy: boolean;
    device: Device;
    previewingChange: boolean;
    autoRefresh: boolean;
    onDevice: (d: Device) => void;
    onRun: () => void;
    onOpen: () => void;
    onMode: (m: Mode) => void;
    onEntry: (p: string) => void;
    onAutoRefresh: (v: boolean) => void;
    className?: string;
    compactHeader?: boolean;
  }
>(function PreviewPane(
  {
    project,
    preview,
    busy,
    device,
    previewingChange,
    autoRefresh,
    onDevice,
    onRun,
    onOpen,
    onMode,
    onEntry,
    onAutoRefresh,
    className,
    compactHeader,
  },
  frame,
) {
  const node = project.mode === "nextjs" || (project.mode === "js" && !!project.files["package.json"]);
  const status = busy
    ? { text: "Starting…", dot: "bg-warn", color: "text-warn" }
    : preview
      ? { text: node ? "Live · hot reload" : "Live", dot: "bg-ok", color: "text-ok-soft" }
      : { text: "Stopped", dot: "bg-dim", color: "text-muted" };
  const address = preview?.kind === "node" ? preview.value.replace(/^https?:\/\//, "") : `sandbox / ${project.entry}`;
  return (
    <section aria-label="Live preview" className={cn("flex min-h-0 min-w-0 flex-col bg-panel", className)}>
      {!compactHeader && (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pr-3 pl-3.5">
          <span className="font-semibold text-[13px]">Live preview</span>
          <span role="status" className={cn("flex items-center gap-1.5 text-xs", status.color)}>
            <span className={cn("size-[7px] rounded-full", status.dot)} />
            {status.text}
          </span>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1.5 p-2.5">
        <Segmented<Device>
          label="Device size"
          value={device}
          onChange={onDevice}
          options={[
            { value: "desktop", label: <Monitor size={15} />, title: "Desktop" },
            { value: "tablet", label: <Tablet size={15} />, title: "Tablet" },
            { value: "phone", label: <Smartphone size={15} />, title: "Phone" },
          ]}
        />
        <div
          className="flex h-8 min-w-0 flex-1 items-center truncate rounded-lg border border-[#1f2433] bg-sunken px-2.5 text-xs text-soft"
          title={address}
        >
          {address}
        </div>
        <IconButton label={preview ? "Reload preview" : "Run preview"} onClick={onRun} disabled={busy} className="size-8 rounded-lg border border-[#1f2433] bg-sunken">
          <RotateCw size={15} />
        </IconButton>
        <IconButton label="Open preview in new tab" onClick={onOpen} disabled={!preview} className="size-8 rounded-lg border border-[#1f2433] bg-sunken">
          <ExternalLink size={15} />
        </IconButton>
      </div>

      <div className="relative mx-2.5 mb-2.5 flex min-h-0 flex-1 justify-center overflow-auto rounded-xl bg-[#161a23]">
        {preview ? (
          <iframe
            key={preview.runId}
            ref={frame}
            title="Project preview"
            sandbox={
              preview.kind === "node"
                ? "allow-scripts allow-same-origin allow-forms allow-modals allow-downloads"
                : "allow-scripts"
            }
            allow="cross-origin-isolated"
            src={preview.kind === "node" ? preview.value : undefined}
            srcDoc={preview.kind === "html" ? preview.value : undefined}
            style={{ width: widths[device], maxWidth: "100%" }}
            className={cn("h-full shrink-0 bg-white", device !== "desktop" && "my-3 rounded-lg border border-line-strong")}
          />
        ) : (
          <div className="grid w-full place-items-center p-6 text-center">
            <div className="flex max-w-60 flex-col items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-accent-wash text-accent-soft">
                <Play size={20} />
              </div>
              <h2 className="text-base font-semibold">Your code, running</h2>
              <p className="text-[13px] text-muted">Run the project to see it here. HTML projects refresh as you type.</p>
              <Button variant="primary" onClick={onRun} disabled={busy}>
                {busy ? "Starting runtime…" : "Run preview"}
              </Button>
            </div>
          </div>
        )}
        {previewingChange && preview && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-[#eeebff] px-2.5 py-2 text-[11px] font-medium text-[#3b2fa8] shadow">
            <Eye size={12} /> Showing the AI change before you accept it
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line px-3 py-2 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          Runtime
          <select
            value={project.mode}
            onChange={(e) => onMode(e.target.value as Mode)}
            className="h-7 rounded-md border border-line-strong bg-sunken px-1.5 text-xs text-fg"
          >
            {(Object.keys(labels) as Mode[]).map((m) => (
              <option key={m} value={m}>
                {labels[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 items-center gap-1.5">
          Entry
          <select
            value={project.entry}
            onChange={(e) => onEntry(e.target.value)}
            className="h-7 max-w-36 rounded-md border border-line-strong bg-sunken px-1.5 text-xs text-fg"
          >
            {Object.keys(project.files)
              .sort()
              .map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </select>
        </label>
        {project.mode === "html" || (project.mode === "js" && !node) ? (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => onAutoRefresh(e.target.checked)}
              className="size-3.5 accent-[#6d5df6]"
            />
            Refresh as I type
          </label>
        ) : (
          <span>
            {project.mode === "php"
              ? "PHP 8.3 · single request · 20 s limit"
              : "Browser Node.js · needs Chrome or Edge"}
          </span>
        )}
      </div>
    </section>
  );
});
