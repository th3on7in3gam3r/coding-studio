"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogEntry } from "./types";
import { Button, IconButton } from "./ui";

type Tab = "terminal" | "console" | "problems";

export function BottomPanel({
  logs,
  running,
  onClear,
  onStop,
  className,
  defaultOpen = true,
}: {
  defaultOpen?: boolean;
  logs: LogEntry[];
  running: boolean;
  onClear: () => void;
  onStop: () => void;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>("terminal");
  const [open, setOpen] = useState(defaultOpen);
  const end = useRef<HTMLDivElement>(null);
  const consoleCount = logs.filter((l) => l.source === "console").length;
  const problems = logs.filter((l) => l.level === "error" || l.level === "warn");
  const shown =
    tab === "terminal"
      ? logs.filter((l) => l.source === "terminal")
      : tab === "console"
        ? logs.filter((l) => l.source === "console")
        : problems;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [shown.length, tab]);
  const color: Record<LogEntry["level"], string> = {
    info: "text-soft",
    log: "text-soft",
    warn: "text-warn",
    error: "text-danger",
  };
  const tabs: [Tab, string, number?][] = [
    ["terminal", "Terminal"],
    ["console", "Console", consoleCount],
    ["problems", "Problems", problems.length],
  ];
  return (
    <div className={cn("flex shrink-0 flex-col border-t border-line bg-panel", open ? "h-[196px]" : "h-9", className)}>
      <div className="flex h-9 shrink-0 items-center gap-1 px-2.5">
        <div role="tablist" aria-label="Output" className="flex gap-1">
          {tabs.map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setOpen(true);
              }}
              className={cn(
                "flex h-[26px] items-center gap-1.5 rounded-md px-2.5 text-xs",
                tab === id && open ? "bg-selected font-medium text-white" : "text-muted hover:text-fg",
              )}
            >
              {label}
              {count ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px]",
                    id === "problems" ? "bg-[#2a1519] text-danger" : "bg-[#1f2433] text-soft",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <Button size="sm" onClick={onClear} className="bg-transparent">
          Clear
        </Button>
        <Button size="sm" variant="danger" onClick={onStop} disabled={!running}>
          Stop
        </Button>
        <IconButton label={open ? "Collapse output" : "Expand output"} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </IconButton>
      </div>
      {open && (
        <div
          role="log"
          aria-label={`${tab} output`}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 font-mono text-xs leading-5 whitespace-pre-wrap"
        >
          {shown.length ? (
            shown.map((l) => (
              <div key={l.id} className={color[l.level]}>
                {l.level === "error" ? "✕ " : l.level === "warn" ? "! " : ""}
                {l.text}
              </div>
            ))
          ) : (
            <div className="text-dim">
              {tab === "terminal"
                ? "Run the project to see runtime output here."
                : tab === "console"
                  ? "console.log output from your page shows here."
                  : "No problems found."}
            </div>
          )}
          <div ref={end} />
        </div>
      )}
    </div>
  );
}
