"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, CircleAlert, Eye } from "lucide-react";
import type { Project } from "@/lib/project";
import { hunks as makeHunks } from "@/lib/diff";
import { missingPackages, motionCheck, type Suggestion } from "@/lib/suggestions";
import { cn } from "@/lib/utils";
import { Button, Modal } from "./ui";

export function ReviewDialog({
  suggestion,
  project,
  onClose,
  onAccept,
  onPreview,
}: {
  suggestion: Suggestion;
  project: Project;
  onClose: () => void;
  onAccept: (keep: number[]) => void;
  onPreview: () => void;
}) {
  const hunks = useMemo(() => makeHunks(suggestion.before, suggestion.after), [suggestion]);
  const [keep, setKeep] = useState<Set<number>>(() => new Set(hunks.map((h) => h.id)));
  const current = project.files[suggestion.path];
  const unchanged = suggestion.isNew ? current === undefined : current === suggestion.before;
  const packages = missingPackages(project, suggestion.path, suggestion.after).filter(
    (p) => !missingPackages(project, suggestion.path, suggestion.before).includes(p),
  );
  const motion = motionCheck(suggestion.before, suggestion.after);
  const added = hunks.filter((h) => keep.has(h.id)).reduce((n, h) => n + h.added, 0);
  const removed = hunks.filter((h) => keep.has(h.id)).reduce((n, h) => n + h.removed, 0);

  const toggle = (id: number) =>
    setKeep((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const checks: { ok: boolean | "warn"; label: string; detail: string }[] = [
    {
      ok: unchanged,
      label: unchanged ? "File unchanged since request" : "File changed since request",
      detail: unchanged ? "safe to apply" : "ask for a fresh change",
    },
  ];
  if (motion !== "none")
    checks.push({
      ok: motion === "ok" ? true : "warn",
      label: motion === "ok" ? "Respects reduced motion" : "Animation without a reduced-motion fallback",
      detail: motion === "ok" ? "guard found" : "consider adding one",
    });
  if (packages.length)
    checks.push({ ok: "warn", label: "Needs new package", detail: packages.join(", ") });

  return (
    <Modal title="Review change" onClose={onClose} wide className="sm:h-[86dvh]">
      <div className="flex min-h-full flex-col lg:flex-row">
        <section aria-label="Changes" className="flex min-w-0 flex-[3] flex-col gap-4 p-5">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.06em] text-[#b4a9ff]">
              {suggestion.source === "ai" ? "AI CHANGE" : "LOCAL CHECK"}
            </div>
            <h3 className="mt-0.5 text-lg font-semibold">{suggestion.title}</h3>
            <p className="mt-1 font-mono text-xs text-muted">
              {suggestion.isNew ? "new file · " : ""}
              {suggestion.path} · <span className="text-ok">+{added}</span> <span className="text-danger">−{removed}</span>
            </p>
          </div>
          {hunks.map((h) => {
            const kept = keep.has(h.id);
            return (
              <div key={h.id} className={cn("overflow-hidden rounded-xl border border-line", !kept && "opacity-55")}>
                <div className="flex items-center gap-2.5 border-b border-line bg-sunken px-3 py-2">
                  <span className="font-mono text-[11px] text-muted">
                    {h.oldStart ? `lines ${h.oldStart}–${h.oldEnd}` : "new content"}
                  </span>
                  <span className="flex-1" />
                  <span className="text-xs">
                    <span className="text-ok">+{h.added}</span> <span className="text-danger">−{h.removed}</span>
                  </span>
                  {hunks.length > 1 && (
                    <Button
                      size="sm"
                      onClick={() => toggle(h.id)}
                      aria-pressed={kept}
                      className={kept ? "border-transparent bg-[#183a2e] text-[#a7f3d0]" : "bg-transparent"}
                    >
                      {kept ? (
                        <>
                          <Check size={12} /> Keep
                        </>
                      ) : (
                        "Skipped"
                      )}
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto py-1.5 font-mono text-xs">
                  {h.lines.map((l, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex min-h-[22px] items-center whitespace-pre",
                        l.type === "add" && "bg-[#14221c]",
                        l.type === "del" && "bg-[#2a1519]",
                      )}
                    >
                      <span
                        className={cn(
                          "w-10 shrink-0 pr-3 text-right select-none",
                          l.type === "add" ? "text-ok" : l.type === "del" ? "text-danger" : "text-[#6e7687]",
                        )}
                      >
                        {l.type === "add" ? "+" : l.type === "del" ? "−" : l.oldNo}
                      </span>
                      <span className={l.type === "del" ? "text-[#f3c4cb]" : "text-[#d7dbe3]"}>{l.text || " "}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!hunks.length && <p className="text-sm text-muted">No line changes.</p>}
        </section>

        <aside aria-label="Checks" className="flex flex-[2] flex-col gap-4 border-t border-line bg-sunken p-5 lg:border-t-0 lg:border-l">
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-[#12151d] p-3.5">
            <span className="text-[13px] font-semibold">Why this change</span>
            <span className="text-xs leading-relaxed text-[#a9b0bf]">{suggestion.description}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="bg-panel px-3.5 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-muted">CHECKS ON THIS CHANGE</div>
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2.5 border-t border-line px-3.5 py-2.5 text-[13px]">
                {c.ok === true ? (
                  <Check size={15} className="shrink-0 text-ok" />
                ) : c.ok === "warn" ? (
                  <CircleAlert size={15} className="shrink-0 text-warn" />
                ) : (
                  <AlertTriangle size={15} className="shrink-0 text-danger" />
                )}
                <span className="flex-1">{c.label}</span>
                <span className="text-xs text-muted">{c.detail}</span>
              </div>
            ))}
          </div>
          {packages.length > 0 && (
            <p className="rounded-xl border border-[#3d3317] bg-warn-wash p-3 text-xs leading-relaxed text-[#d6c9a0]">
              Add <span className="font-mono">{packages.join(", ")}</span> to package.json before running, or ask Studio AI to include it.
            </p>
          )}
          <p className="text-xs text-dim">After accepting, you can undo from Checks → History.</p>
          <span className="flex-1" />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                onPreview();
                onClose();
              }}
              disabled={!unchanged}
            >
              <Eye size={14} /> Preview in workspace
            </Button>
            <span className="flex-1" />
            <Button onClick={onClose} className="bg-transparent">
              Cancel
            </Button>
            <Button variant="primary" disabled={!unchanged || keep.size === 0} onClick={() => onAccept([...keep])}>
              <Check size={14} /> {keep.size === hunks.length ? "Accept change" : `Accept ${keep.size} of ${hunks.length}`}
            </Button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
