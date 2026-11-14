"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  FilePlus2,
  History,
  KeyRound,
  ListChecks,
  Plus,
  RefreshCw,
  Repeat2,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { Suggestion } from "@/lib/suggestions";
import { diffStats } from "@/lib/diff";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import type { AiTab, ChatMessage, HistoryEntry, RelayState, ServerStatus } from "./types";
import { Button, IconButton, inputClass } from "./ui";

export type ChangeActions = {
  previewingId: string | null;
  state: (s: Suggestion) => "open" | "accepted" | "stale";
  onPreview: (s: Suggestion) => void;
  onReview: (s: Suggestion) => void;
  onAccept: (s: Suggestion) => void;
};

function ChangeCard({ s, actions }: { s: Suggestion; actions: ChangeActions }) {
  const stats = diffStats(s.before, s.after);
  const previewing = actions.previewingId === s.id;
  const state = actions.state(s);
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3",
        previewing ? "border-accent-line bg-accent-wash" : "border-[#232838] bg-[#12151d]",
      )}
    >
      <div className="flex items-start gap-2">
        {s.isNew ? (
          <FilePlus2 size={15} className="mt-0.5 shrink-0 text-accent-soft" />
        ) : (
          <Sparkles size={15} className="mt-0.5 shrink-0 text-accent-soft" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">{s.title}</div>
          <div className="truncate font-mono text-[11px] text-muted">
            {s.isNew ? "new · " : ""}
            {s.path}
          </div>
        </div>
        {previewing && <span className="shrink-0 text-[11px] text-accent-soft">Previewing</span>}
      </div>
      <p className="text-xs leading-relaxed text-[#a9b0bf]">{s.description}</p>
      {state === "accepted" ? (
        <p className="flex items-center gap-1.5 text-xs text-ok-soft">
          <Check size={13} /> Applied. Undo from Checks → History.
        </p>
      ) : state === "stale" ? (
        <p className="text-xs text-warn">The file changed after this was suggested. Ask again for a fresh change.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => actions.onPreview(s)} className="bg-transparent">
            <Eye size={12} /> {previewing ? "Previewing" : "Preview"}
          </Button>
          <Button size="sm" onClick={() => actions.onReview(s)} className="bg-transparent">
            Review <span className="text-ok">+{stats.added}</span>
            <span className="text-danger">−{stats.removed}</span>
          </Button>
          <Button size="sm" variant="primary" onClick={() => actions.onAccept(s)}>
            <Check size={12} /> Accept
          </Button>
        </div>
      )}
    </div>
  );
}

function relaySummary(context: string) {
  const who = context.match(/Last updated by (.+?) on (\d{4}-\d{2}-\d{2})/);
  const open = (context.match(/^- \[ \]/gm) || []).length;
  return {
    who: who ? `${who[1]} updated this on ${who[2]}` : "Handoff loaded",
    open,
  };
}

export function AssistantPanel({
  status,
  hasToken,
  tab,
  onTab,
  messages,
  busy,
  onSend,
  onStopAi,
  onClearChat,
  activePath,
  includeActive,
  onIncludeActive,
  extraFiles,
  allPaths,
  onAddFile,
  onRemoveFile,
  includeRelay,
  onIncludeRelay,
  consoleErrors,
  includeConsole,
  onIncludeConsole,
  actions,
  checks,
  onRunChecks,
  history,
  onUndo,
  relay,
  relaySlug,
  onRelaySlug,
  onRelayLoad,
  onRelaySave,
  onOpenSettings,
  className,
  hideHeader,
}: {
  status: ServerStatus;
  hasToken: boolean;
  tab: AiTab;
  onTab: (t: AiTab) => void;
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string) => void;
  onStopAi: () => void;
  onClearChat: () => void;
  activePath: string;
  includeActive: boolean;
  onIncludeActive: (v: boolean) => void;
  extraFiles: string[];
  allPaths: string[];
  onAddFile: (p: string) => void;
  onRemoveFile: (p: string) => void;
  includeRelay: boolean;
  onIncludeRelay: (v: boolean) => void;
  consoleErrors: number;
  includeConsole: boolean;
  onIncludeConsole: (v: boolean) => void;
  actions: ChangeActions;
  checks: Suggestion[];
  onRunChecks: () => void;
  history: HistoryEntry[];
  onUndo: (h: HistoryEntry) => void;
  relay: RelayState;
  relaySlug: string;
  onRelaySlug: (s: string) => void;
  onRelayLoad: () => void;
  onRelaySave: (summary: string) => Promise<boolean>;
  onOpenSettings: () => void;
  className?: string;
  hideHeader?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [messages.length, last?.content, last?.changes]);

  const needsToken = (status.ai || status.relay) && !hasToken;
  const relayInfo = relay.context ? relaySummary(relay.context) : null;

  function send() {
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  const chip = (on: boolean) =>
    cn(
      "inline-flex h-6 max-w-full items-center gap-1 rounded-md px-2 text-[11px] transition-colors",
      on ? "bg-hover text-soft" : "border border-dashed border-line-strong text-dim line-through",
    );

  const tokenNotice = needsToken && (
    <div className="flex gap-2.5 rounded-xl border border-line-strong bg-[#12151d] p-3">
      <KeyRound size={16} className="mt-0.5 shrink-0 text-accent-soft" />
      <div className="flex flex-col gap-2">
        <span className="text-[13px]">Enter your Studio access token to use AI and Agent Relay.</span>
        <Button size="sm" onClick={onOpenSettings} className="self-start">
          Open settings
        </Button>
      </div>
    </div>
  );

  return (
    <aside aria-label="Studio AI" className={cn("flex min-h-0 min-w-0 flex-col bg-panel", className)}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line pr-3 pl-3.5">
        {!hideHeader && (
          <>
            <Sparkles size={16} className="text-[#b4a9ff]" />
            <span className="flex-1 text-[13px] font-semibold">Studio AI</span>
          </>
        )}
        {hideHeader && <span className="flex-1" />}
        <div role="tablist" aria-label="Studio AI sections" className="flex gap-0.5 rounded-lg bg-[#161a23] p-0.5">
          {(
            [
              ["chat", "Chat"],
              ["checks", "Checks"],
              ...(status.relay ? [["relay", "Relay"]] : []),
            ] as [AiTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTab(id)}
              className={cn(
                "h-6 rounded-md px-2 text-xs",
                tab === id ? "bg-[#2a2f42] text-white" : "text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "chat" && (
        <>
          <div ref={thread} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
            {tokenNotice}
            {relayInfo && (
              <div className="flex gap-2.5 rounded-xl border border-ok-line bg-ok-wash px-3 py-2.5">
                <Repeat2 size={16} className="mt-0.5 shrink-0 text-ok-soft" />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-semibold text-[#d1fae5]">{relayInfo.who}</span>
                  <span className="text-xs leading-snug text-[#a7c9bb]">
                    {relayInfo.open ? `${relayInfo.open} open item${relayInfo.open === 1 ? "" : "s"} in the handoff.` : "No open items."}{" "}
                    {includeRelay ? "Studio AI can read it." : "Not shared with Studio AI."}
                  </span>
                  <button type="button" onClick={() => onTab("relay")} className="self-start text-xs font-medium text-ok-soft hover:underline">
                    View handoff
                  </button>
                </div>
              </div>
            )}
            {!messages.length && (
              <div className="flex flex-col gap-3 py-2">
                <h2 className="text-base font-semibold">What are we building?</h2>
                <p className="text-[13px] leading-relaxed text-muted">
                  Ask for a feature, a fix, or a design upgrade. Every change shows up as a preview first; nothing is applied until you accept it.
                </p>
                <div className="flex flex-col gap-1.5">
                  {[
                    "Make this page feel more premium, but keep it accessible",
                    "Add a subtle entrance animation",
                    "Find bugs in this file",
                  ].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDraft(p)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-xs text-soft hover:bg-hover"
                    >
                      {p} <ArrowRight size={12} className="shrink-0 text-muted" />
                    </button>
                  ))}
                </div>
                {!status.ai && (
                  <p className="text-xs text-dim">
                    AI is not set up on the server yet. Local checks in the Checks tab work without it.
                  </p>
                )}
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="max-w-[88%] self-end rounded-xl rounded-br-sm bg-selected px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>
              ) : (
                <div key={m.id} className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-[#d7dbe3]">
                  {m.content ? <Markdown text={m.content} /> : m.pending ? <span className="text-muted">Thinking…</span> : null}
                  {m.pending && m.content && <span className="inline-block h-4 w-1.5 animate-pulse bg-accent" aria-hidden="true" />}
                  {m.changes?.map((s) => <ChangeCard key={s.id} s={s} actions={actions} />)}
                  {m.error && <p className="rounded-lg border border-danger-line bg-[#1a1014] px-3 py-2 text-xs text-danger">{m.error}</p>}
                  {m.docs && !m.pending && (
                    <span className="text-[11px] text-dim">
                      Reference:{" "}
                      <a href={m.docs.url} target="_blank" rel="noreferrer" className="text-[#b4a9ff] hover:underline">
                        {new URL(m.docs.url).hostname}
                      </a>
                      {m.docs.fetchedAt
                        ? ` · retrieved ${new Date(m.docs.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                        : " · could not retrieve, answered from existing knowledge"}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-line p-3">
            <div className="flex flex-wrap gap-1.5">
              {activePath && (
                <button type="button" className={cn(chip(includeActive), "font-mono")} onClick={() => onIncludeActive(!includeActive)} aria-pressed={includeActive} title="Include the open file">
                  @{activePath.split("/").pop()}
                </button>
              )}
              {extraFiles.map((p) => (
                <span key={p} className={cn(chip(true), "font-mono")}>
                  @{p.split("/").pop()}
                  <button type="button" aria-label={`Remove ${p} from AI context`} onClick={() => onRemoveFile(p)} className="text-muted hover:text-fg">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {relay.context && (
                <button type="button" className={cn(chip(includeRelay), includeRelay && "bg-ok-wash text-[#a7f3d0]")} onClick={() => onIncludeRelay(!includeRelay)} aria-pressed={includeRelay}>
                  Relay handoff
                </button>
              )}
              {consoleErrors > 0 && (
                <button type="button" className={chip(includeConsole)} onClick={() => onIncludeConsole(!includeConsole)} aria-pressed={includeConsole}>
                  Console errors ({consoleErrors})
                </button>
              )}
              <div className="relative">
                <button type="button" onClick={() => setPicking(!picking)} aria-expanded={picking} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted hover:bg-hover hover:text-fg">
                  <Plus size={11} /> File
                </button>
                {picking && (
                  <div className="absolute bottom-8 left-0 z-20 max-h-56 w-56 overflow-y-auto rounded-lg border border-line-strong bg-raised p-1 shadow-xl">
                    {allPaths
                      .filter((p) => p !== activePath && !extraFiles.includes(p))
                      .map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            onAddFile(p);
                            setPicking(false);
                          }}
                          className="block w-full truncate rounded px-2 py-1.5 text-left font-mono text-xs text-soft hover:bg-hover"
                        >
                          {p}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-line-strong bg-sunken p-2.5 focus-within:border-accent">
              <textarea
                aria-label="Message Studio AI"
                placeholder={status.ai ? "Ask Studio AI… (Enter to send)" : "AI is not configured on the server"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                rows={2}
                maxLength={8000}
                className="max-h-40 min-h-10 resize-none bg-transparent text-[13px] text-fg placeholder:text-dim outline-none"
              />
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11px] text-dim">{status.model || "No model set"}</span>
                <span className="flex-1" />
                {messages.length > 0 && !busy && (
                  <IconButton label="Clear conversation" onClick={onClearChat}>
                    <Trash2 size={14} />
                  </IconButton>
                )}
                {busy ? (
                  <IconButton label="Stop generating" onClick={onStopAi} className="size-8 rounded-lg bg-raised text-fg">
                    <Square size={13} />
                  </IconButton>
                ) : (
                  <IconButton
                    label="Send"
                    onClick={send}
                    disabled={!draft.trim() || !status.ai || !hasToken}
                    className="size-8 rounded-lg bg-brand text-white hover:bg-brand-hover hover:text-white"
                  >
                    <ArrowRight size={15} />
                  </IconButton>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "checks" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-[#12151d] p-3">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className="text-accent-soft" />
              <span className="flex-1 text-[13px] font-semibold">Local checks</span>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Fast rules that run on your device: mobile viewport, page language, reduced motion and keyboard focus. No AI needed.
            </p>
            <Button size="sm" onClick={onRunChecks} disabled={!activePath} className="self-start">
              Check {activePath ? activePath.split("/").pop() : "file"}
            </Button>
          </div>
          {checks.map((s) => (
            <ChangeCard key={s.id} s={s} actions={actions} />
          ))}
          <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em] text-muted">
            <History size={13} /> HISTORY
          </div>
          {history.length ? (
            <ul className="flex flex-col gap-1">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-hover">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{h.title}</div>
                    <div className="truncate font-mono text-[11px] text-muted">
                      {h.path} · {new Date(h.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => onUndo(h)}>
                    <Undo2 size={12} /> Undo
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-dim">Accepted changes show here so you can undo them.</p>
          )}
        </div>
      )}

      {tab === "relay" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
          {tokenNotice}
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted">
              Relay project
              <input
                value={relaySlug}
                onChange={(e) => onRelaySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className={cn(inputClass, "h-9 font-mono")}
                spellCheck={false}
              />
            </label>
            <Button onClick={onRelayLoad} disabled={relay.loading || !hasToken} className="h-9">
              <RefreshCw size={13} className={relay.loading ? "animate-spin" : ""} />
              {relay.context ? "Refresh" : "Load"}
            </Button>
          </div>
          {relay.error && <p className="rounded-lg border border-danger-line bg-[#1a1014] px-3 py-2 text-xs text-danger">{relay.error}</p>}
          {relay.context ? (
            <>
              <label className="flex items-center gap-2 text-xs text-soft">
                <input type="checkbox" checked={includeRelay} onChange={(e) => onIncludeRelay(e.target.checked)} className="size-4 accent-[#6d5df6]" />
                Share this handoff with Studio AI
              </label>
              <div className="rounded-xl border border-ok-line bg-ok-wash p-3 text-xs leading-relaxed text-[#cfe9df]">
                <Markdown text={relay.context} />
              </div>
              {relay.fetchedAt && (
                <span className="text-[11px] text-dim">Loaded {new Date(relay.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              )}
            </>
          ) : (
            !relay.loading && (
              <p className="text-xs leading-relaxed text-muted">
                Load the handoff to see what Claude, ChatGPT and Grok did on this project, and let Studio AI pick up where they left off.
              </p>
            )
          )}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-[13px] font-semibold">Save a session</span>
            <span className="text-xs text-muted">Logged in Agent Relay as “Coding Studio” so the next assistant knows what changed.</span>
            <textarea
              aria-label="Session summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="What you did, what you skipped, what is next"
              className="resize-y rounded-lg border border-line-strong bg-sunken p-2.5 text-[13px] text-fg placeholder:text-dim outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              {history.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setSummary(
                      "Coding Studio changes:\n" +
                        history
                          .slice(0, 10)
                          .map((h) => `- ${h.title} (${h.path})`)
                          .join("\n") +
                        "\nNext: ",
                    )
                  }
                >
                  Fill from history
                </Button>
              )}
              <span className="flex-1" />
              <Button
                size="sm"
                variant="success"
                disabled={saving || summary.trim().length < 10 || !hasToken}
                onClick={async () => {
                  setSaving(true);
                  if (await onRelaySave(summary)) setSummary("");
                  setSaving(false);
                }}
              >
                {saving ? "Saving…" : "Save to Relay"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
