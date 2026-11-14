"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileBadge, Kbd } from "./ui";

export type Command = {
  id: string;
  label: string;
  group: "Actions" | "Files" | "Projects";
  hint?: string;
  icon?: ReactNode;
  path?: string;
  run: () => void;
};

function score(text: string, query: string) {
  if (!query) return 1;
  const t = text.toLowerCase(),
    q = query.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 10 : 0;
}

export function CommandPalette({
  commands,
  initial = "",
  onClose,
}: {
  commands: Command[];
  initial?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initial);
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const results = useMemo(
    () =>
      commands
        .map((c) => ({ c, s: score(c.label + " " + (c.path || ""), query) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map((r) => r.c),
    [commands, query],
  );
  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);
  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="animate-rise w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="text-muted" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(results[index]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Search files, projects and commands"
            aria-label="Search files, projects and commands"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-dim outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="palette-list" role="listbox" ref={list} className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={i === index}
              data-index={i}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(c)}
              className={cn(
                "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px]",
                i === index ? "bg-selected text-white" : "text-soft",
              )}
            >
              <span className="grid w-5 place-items-center text-muted">{c.path ? <FileBadge path={c.path} /> : c.icon}</span>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              {c.path && c.path !== c.label && <span className="truncate font-mono text-[11px] text-dim">{c.path}</span>}
              {c.hint && <Kbd>{c.hint}</Kbd>}
              <span className="text-[11px] text-dim">{c.group}</span>
            </li>
          ))}
          {!results.length && <li className="p-4 text-center text-[13px] text-muted">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
