"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Eye, FileCode2, Sparkles, Type, Undo2, X } from "lucide-react";
import type { EditorHandle } from "@/components/CodeEditor";
import type { Suggestion } from "@/lib/suggestions";
import { diffStats } from "@/lib/diff";
import { cn } from "@/lib/utils";
import { Button, FileBadge, IconButton, Kbd } from "./ui";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });
const InlineDiff = dynamic(
  () => import("@/components/CodeEditor").then((m) => m.InlineDiff),
  { ssr: false },
);

const KEYS: { label: string; text?: string; action?: "tab" | "undo" }[] = [
  { label: "Tab", action: "tab" },
  { label: "<", text: "<" },
  { label: ">", text: ">" },
  { label: "{ }", text: "{}" },
  { label: "( )", text: "()" },
  { label: '"', text: '"' },
  { label: "/", text: "/" },
  { label: "=", text: "=" },
  { label: ";", text: ";" },
];

export function EditorPane({
  tabs,
  active,
  projectName,
  content,
  plain,
  previewing,
  stale,
  onSelectTab,
  onCloseTab,
  onEdit,
  onTogglePlain,
  onAccept,
  onReject,
  onReview,
  onCursor,
  className,
}: {
  tabs: string[];
  active: string;
  projectName: string;
  content: string | undefined;
  plain: boolean;
  previewing: Suggestion | null;
  stale: boolean;
  onSelectTab: (p: string) => void;
  onCloseTab: (p: string) => void;
  onEdit: (v: string) => void;
  onTogglePlain: () => void;
  onAccept: () => void;
  onReject: () => void;
  onReview: () => void;
  onCursor: (line: number, col: number) => void;
  className?: string;
}) {
  const editor = useRef<EditorHandle | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);
  const area = useRef<HTMLTextAreaElement>(null);
  const showDiff = previewing && previewing.path === active;

  function press(key: (typeof KEYS)[number] | "undo") {
    const k = key === "undo" ? { label: "undo", action: "undo" as const } : key;
    const e = editor.current;
    if (!plain && e) {
      e.focus();
      if (k.action === "tab") e.trigger("keyboard", "tab", null);
      else if (k.action === "undo") e.trigger("keyboard", "undo", null);
      else if (k.text) {
        e.trigger("keyboard", "type", { text: k.text });
        if (k.text.length === 2) e.trigger("keyboard", "cursorLeft", null);
      }
      return;
    }
    const t = area.current;
    if (!t || k.action === "undo") {
      if (k.action === "undo") document.execCommand("undo");
      return;
    }
    const text = k.action === "tab" ? "  " : k.text || "";
    const start = t.selectionStart,
      end = t.selectionEnd;
    const next = t.value.slice(0, start) + text + t.value.slice(end);
    onEdit(next);
    const caret = start + (text.length === 2 && k.text ? 1 : text.length);
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(caret, caret);
    });
  }

  const parts = active ? active.split("/") : [];
  const stats = previewing ? diffStats(previewing.before, previewing.after) : null;

  return (
    <section aria-label="Editor" className={cn("flex min-h-0 min-w-0 flex-col bg-bg", className)}>
      <div role="tablist" aria-label="Open files" className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-line bg-panel">
        {tabs.map((tab) => {
          const selected = tab === active;
          return (
            <div
              key={tab}
              className={cn(
                "group flex shrink-0 items-center border-r border-line",
                selected ? "border-t-2 border-t-accent bg-bg text-white" : "border-t-2 border-t-transparent text-muted hover:text-fg",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelectTab(tab)}
                title={tab}
                className="flex h-full items-center gap-1.5 pr-1 pl-3 text-[13px]"
              >
                <FileBadge path={tab} />
                {tab.split("/").pop()}
                {previewing?.path === tab && <span className="size-1.5 rounded-full bg-accent" title="AI change previewing" />}
              </button>
              <IconButton
                label={`Close ${tab}`}
                onClick={() => onCloseTab(tab)}
                className={cn("mr-1 size-6", !selected && "opacity-0 group-hover:opacity-100 focus:opacity-100")}
              >
                <X size={13} />
              </IconButton>
            </div>
          );
        })}
      </div>
      <div className="flex h-[30px] shrink-0 items-center gap-1.5 border-b border-[#161a23] px-3.5 text-xs text-muted">
        <nav aria-label="File path" className="flex min-w-0 items-center gap-1.5 truncate">
          <span>{projectName}</span>
          {parts.map((p, i) => (
            <span key={i} className={cn("flex items-center gap-1.5", i === parts.length - 1 && "text-fg")}>
              <span aria-hidden="true">›</span>
              {p}
            </span>
          ))}
        </nav>
        <span className="flex-1" />
        {showDiff && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#1b1830] px-2 py-0.5 text-[11px] font-medium text-accent-soft">
            <Eye size={11} /> Previewing AI change
          </span>
        )}
        <IconButton
          label={plain ? "Use code editor" : "Use plain text editor"}
          onClick={onTogglePlain}
          className="size-6"
        >
          {plain ? <FileCode2 size={13} /> : <Type size={13} />}
        </IconButton>
      </div>

      <div className="relative min-h-0 flex-1">
        {!active || content === undefined ? (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
            <div>
              <p className="mb-1 text-fg">No file open</p>
              <p>Pick a file in the explorer, or press <Kbd>⌘K</Kbd> to search.</p>
            </div>
          </div>
        ) : showDiff ? (
          <InlineDiff path={active} before={previewing.before} after={previewing.after} />
        ) : plain ? (
          <textarea
            ref={area}
            aria-label="Source code"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={content}
            onChange={(e) => onEdit(e.target.value)}
            className="h-full w-full resize-none bg-bg p-4 font-mono text-[13px] leading-5 text-[#d7dbe3] outline-none"
          />
        ) : (
          <CodeEditor
            key={active}
            path={active}
            value={content}
            onChange={onEdit}
            onCursor={onCursor}
            wrap={narrow}
            onReady={(e) => {
              editor.current = e;
            }}
          />
        )}
      </div>

      {previewing && (
        <div className="animate-rise mx-3 mb-3 flex shrink-0 flex-col gap-2 rounded-xl border border-[#2e2a55] bg-accent-wash px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <Sparkles size={15} className="shrink-0 text-accent-soft" />
            <span className="truncate font-medium text-[#d9d4ff]">{previewing.title}</span>
            {stats && (
              <span className="shrink-0">
                <span className="text-ok">+{stats.added}</span> <span className="text-danger">−{stats.removed}</span>
              </span>
            )}
            <span className="truncate text-[#b9b2e8]">{stale ? "file changed since, ask again" : "not applied yet"}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={onReview} className="mr-auto text-soft">
              Review diff
            </Button>
            <Button size="sm" onClick={onReject} className="bg-transparent">
              Reject <span className="hidden text-muted sm:inline">Esc</span>
            </Button>
            <Button size="sm" variant="primary" onClick={onAccept} disabled={stale}>
              Accept <span className="hidden text-[#e4e0ff] sm:inline">⌘↵</span>
            </Button>
          </div>
        </div>
      )}

      <div role="toolbar" aria-label="Coding keys" className="flex shrink-0 gap-1.5 border-t border-line bg-sunken px-2.5 py-2 lg:hidden">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(k)}
            className="h-10 min-w-0 flex-1 rounded-lg bg-hover font-mono text-[13px] text-fg active:bg-selected"
          >
            {k.label}
          </button>
        ))}
        <button
          type="button"
          aria-label="Undo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press("undo")}
          className="grid h-10 min-w-0 flex-1 place-items-center rounded-lg bg-hover text-fg active:bg-selected"
        >
          <Undo2 size={16} />
        </button>
      </div>
    </section>
  );
}
