"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Code2,
  Download,
  Eye,
  Folder,
  Keyboard,
  LayoutGrid,
  Play,
  Repeat2,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import type { Mode, Project, Workspace } from "@/lib/project";
import { cn } from "@/lib/utils";
import type { MobileTab, ServerStatus, Toast } from "./types";
import { Button, IconButton, Kbd } from "./ui";

export const modeLabels: Record<Mode, string> = {
  html: "HTML",
  js: "JavaScript",
  nextjs: "Next.js",
  php: "PHP",
};

type MenuItem = { label: string; onSelect: () => void; danger?: boolean; hint?: string } | "divider";

export function Menu({
  trigger,
  items,
  label,
  align = "left",
}: {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  items: MenuItem[];
  label: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    box.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      {trigger({ onClick: () => setOpen(!open), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            const items = [...(box.current?.querySelectorAll<HTMLElement>("[role=menuitem]") || [])];
            const i = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              items[(i + 1) % items.length]?.focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              items[(i - 1 + items.length) % items.length]?.focus();
            }
          }}
          className={cn(
            "animate-rise absolute top-10 z-40 min-w-56 rounded-xl border border-line-strong bg-raised p-1 shadow-2xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex h-8 w-full items-center justify-between gap-4 rounded-lg px-2.5 text-left text-[13px] outline-none hover:bg-hover focus:bg-hover",
                  item.danger ? "text-danger" : "text-soft",
                )}
              >
                {item.label}
                {item.hint && <span className="text-[11px] text-dim">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar({
  project,
  workspace,
  saveStatus,
  status,
  relayLoaded,
  busy,
  running,
  onSwitchProject,
  onNewProject,
  onRenameProject,
  onDeleteProject,
  onPalette,
  onExportZip,
  onExportJson,
  onImport,
  onRun,
  onSettings,
  onRelay,
}: {
  project: Project;
  workspace: Workspace;
  saveStatus: string;
  status: ServerStatus;
  relayLoaded: boolean;
  busy: boolean;
  running: boolean;
  onSwitchProject: (id: string) => void;
  onNewProject: () => void;
  onRenameProject: () => void;
  onDeleteProject: () => void;
  onPalette: () => void;
  onExportZip: () => void;
  onExportJson: () => void;
  onImport: () => void;
  onRun: () => void;
  onSettings: () => void;
  onRelay: () => void;
}) {
  const saved = saveStatus === "Saved";
  const failed = saveStatus.startsWith("Save failed");
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:gap-3 sm:px-3.5">
      <span className="hidden items-center gap-2.5 text-[15px] font-semibold sm:flex">
        <Code2 size={22} strokeWidth={2.4} className="text-accent" aria-hidden="true" />
        <span className="hidden md:inline">Coding Studio</span>
      </span>
      <div className="hidden h-[22px] w-px bg-line sm:block" />
      <Menu
        label="Project"
        trigger={(p) => (
          <button
            type="button"
            {...p}
            className="flex h-8 min-w-0 items-center gap-2 rounded-lg border border-line-strong bg-raised px-2.5 text-[13px] hover:bg-hover"
          >
            <span className="max-w-[7.5rem] truncate font-medium sm:max-w-48">{project.name}</span>
            <span className="hidden rounded-[5px] bg-[#1f2433] px-1.5 py-0.5 text-[11px] text-[#b4a9ff] sm:inline">{modeLabels[project.mode]}</span>
            <ChevronDown size={14} className="shrink-0" />
          </button>
        )}
        items={[
          ...workspace.projects.map((p) => ({
            label: (p.id === project.id ? "● " : "") + p.name,
            hint: modeLabels[p.mode],
            onSelect: () => onSwitchProject(p.id),
          })),
          "divider" as const,
          { label: "New project…", onSelect: onNewProject },
          { label: "Rename project…", onSelect: onRenameProject },
          { label: "Delete project…", onSelect: onDeleteProject, danger: true },
        ]}
      />
      <span role="status" className={cn("hidden items-center gap-1.5 text-xs lg:flex", failed ? "text-danger" : "text-muted")}>
        <span className={cn("size-[7px] rounded-full", saved ? "bg-ok" : failed ? "bg-danger" : "bg-warn")} />
        {saved ? "Saved" : saveStatus}
      </span>
      <button
        type="button"
        onClick={onPalette}
        className="mx-auto hidden h-8 max-w-[420px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#1f2433] bg-sunken px-2.5 text-[13px] text-muted hover:border-line-strong md:flex"
      >
        <Search size={15} />
        <span className="flex-1 truncate text-left">Search files or run a command</span>
        <Kbd>⌘K</Kbd>
      </button>
      <span className="flex-1 md:hidden" />
      {status.relay && (
        <button
          type="button"
          onClick={onRelay}
          className={cn(
            "hidden h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium xl:flex",
            relayLoaded ? "bg-[#0f2a22] text-ok-soft" : "bg-raised text-muted",
          )}
        >
          <Repeat2 size={13} /> {relayLoaded ? "Relay synced" : "Relay"}
        </button>
      )}
      <IconButton label="Search files or run a command" onClick={onPalette} className="size-[34px] rounded-lg border border-line-strong bg-raised md:hidden">
        <Search size={16} />
      </IconButton>
      <Menu
        label="Export and import"
        align="right"
        trigger={(p) => (
          <Button {...p} className="hidden h-[34px] sm:inline-flex">
            <Download size={15} /> Export
          </Button>
        )}
        items={[
          { label: "Download ZIP", onSelect: onExportZip },
          { label: "Download JSON backup", onSelect: onExportJson },
          "divider",
          { label: "Import ZIP or JSON…", onSelect: onImport },
        ]}
      />
      <Button variant="primary" onClick={onRun} disabled={busy} className="h-[34px] px-3.5">
        <Play size={13} fill="currentColor" />
        {busy ? "Starting…" : running ? "Rerun" : "Run"}
        <Kbd className="hidden border-transparent bg-[#5646d9] text-[#edebff] lg:inline">⌘↵</Kbd>
      </Button>
      <IconButton label="Settings" onClick={onSettings} className="size-[34px] rounded-lg border border-line-strong bg-raised">
        <Settings2 size={16} />
      </IconButton>
    </header>
  );
}

export function ActivityBar({
  sidebar,
  onToggleSidebar,
  onSearch,
  onTemplates,
  onRelay,
  onShortcuts,
  relay,
}: {
  sidebar: boolean;
  onToggleSidebar: () => void;
  onSearch: () => void;
  onTemplates: () => void;
  onRelay: () => void;
  onShortcuts: () => void;
  relay: boolean;
}) {
  const cls = "size-9 rounded-lg";
  return (
    <nav aria-label="Primary" className="hidden w-12 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-panel py-2.5 lg:flex">
      <IconButton label={sidebar ? "Hide explorer" : "Show explorer"} active={sidebar} onClick={onToggleSidebar} className={cls}>
        <Folder size={18} />
      </IconButton>
      <IconButton label="Search files" onClick={onSearch} className={cls}>
        <Search size={18} />
      </IconButton>
      <IconButton label="New project" onClick={onTemplates} className={cls}>
        <LayoutGrid size={18} />
      </IconButton>
      {relay && (
        <IconButton label="Agent Relay" onClick={onRelay} className={cls}>
          <Repeat2 size={18} />
        </IconButton>
      )}
      <span className="flex-1" />
      <IconButton label="Keyboard shortcuts" onClick={onShortcuts} className={cls}>
        <Keyboard size={18} />
      </IconButton>
    </nav>
  );
}

export function StatusBar({
  saveStatus,
  relayText,
  problems,
  cursor,
  language,
  runtime,
}: {
  saveStatus: string;
  relayText: string | null;
  problems: number;
  cursor: [number, number] | null;
  language: string;
  runtime: string;
}) {
  return (
    <footer className="hidden h-[26px] shrink-0 items-center gap-4 border-t border-line bg-panel px-3.5 text-[11px] text-muted lg:flex">
      <span className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", saveStatus === "Saved" ? "bg-ok" : "bg-warn")} />
        {saveStatus === "Saved" ? "Saved in this browser" : saveStatus}
      </span>
      {relayText && <span>{relayText}</span>}
      <span className={problems ? "text-danger" : ""}>{problems ? `${problems} problem${problems === 1 ? "" : "s"}` : "0 problems"}</span>
      <span className="flex-1" />
      {cursor && (
        <span>
          Ln {cursor[0]}, Col {cursor[1]}
        </span>
      )}
      <span>{language}</span>
      <span>{runtime}</span>
    </footer>
  );
}

export function MobileNav({
  tab,
  onTab,
  pending,
}: {
  tab: MobileTab;
  onTab: (t: MobileTab) => void;
  pending: number;
}) {
  const items: [MobileTab, string, ReactNode][] = [
    ["files", "Files", <Folder key="f" size={20} />],
    ["code", "Code", <Code2 key="c" size={20} />],
    ["preview", "Preview", <Eye key="p" size={20} />],
    ["ai", "Studio AI", <Sparkles key="a" size={20} />],
  ];
  return (
    <nav aria-label="Sections" className="flex shrink-0 border-t border-line bg-panel px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] lg:hidden">
      {items.map(([id, label, icon]) => (
        <button
          key={id}
          type="button"
          aria-current={tab === id ? "page" : undefined}
          onClick={() => onTab(id)}
          className={cn(
            "relative flex h-[52px] flex-1 flex-col items-center justify-center gap-1 text-[11px]",
            tab === id ? "font-semibold text-accent-soft" : "text-muted",
          )}
        >
          {icon}
          {label}
          {id === "ai" && pending > 0 && (
            <span className="absolute top-1 right-[calc(50%-22px)] grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              {pending}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-3 bottom-24 z-[60] flex w-[min(92vw,380px)] flex-col gap-2 lg:right-auto lg:bottom-10 lg:left-16">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "animate-rise pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-3 text-[13px] shadow-2xl",
            t.tone === "error"
              ? "border-danger-line bg-[#1a1014] text-[#fecdd3]"
              : t.tone === "success"
                ? "border-ok-line bg-ok-wash text-[#d1fae5]"
                : "border-line-strong bg-raised text-fg",
          )}
        >
          <span className="min-w-0 flex-1 leading-relaxed">{t.text}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.run();
                onDismiss(t.id);
              }}
              className="shrink-0 font-semibold text-accent-soft hover:underline"
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => onDismiss(t.id)} className="shrink-0 text-muted hover:text-fg">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
