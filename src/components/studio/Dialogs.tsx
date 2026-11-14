"use client";
import { useState } from "react";
import { Code2, FileArchive, FileCode, FolderUp, Globe, Server } from "lucide-react";
import type { Mode } from "@/lib/project";
import type { ServerStatus } from "./types";
import { Button, Field, Modal, inputClass } from "./ui";

export type PromptRequest = {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  validate?: (v: string) => string | null;
  resolve: (v: string | null) => void;
};
export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

export function PromptDialog({ req, onDone }: { req: PromptRequest; onDone: () => void }) {
  const [value, setValue] = useState(req.initial || "");
  const [error, setError] = useState<string | null>(null);
  const close = (v: string | null) => {
    req.resolve(v);
    onDone();
  };
  return (
    <Modal title={req.title} onClose={() => close(null)}>
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const v = value.trim();
          const problem = !v ? "Enter a value" : req.validate?.(v) ?? null;
          if (problem) setError(problem);
          else close(v);
        }}
      >
        <Field label={req.label} hint={error ? <span className="text-danger">{error}</span> : undefined}>
          <input
            data-autofocus
            value={value}
            placeholder={req.placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            spellCheck={false}
            autoCapitalize="off"
            className={inputClass + " font-mono"}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={() => close(null)} className="bg-transparent">
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {req.confirmLabel || "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmDialog({ req, onDone }: { req: ConfirmRequest; onDone: () => void }) {
  const close = (ok: boolean) => {
    req.resolve(ok);
    onDone();
  };
  return (
    <Modal title={req.title} onClose={() => close(false)}>
      <div className="flex flex-col gap-5 p-5">
        <p className="text-[13px] leading-relaxed text-soft">{req.message}</p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => close(false)} className="bg-transparent" data-autofocus>
            Cancel
          </Button>
          <Button variant={req.danger ? "danger" : "primary"} onClick={() => close(true)}>
            {req.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const templates: { mode: Mode; title: string; text: string; icon: typeof Globe }[] = [
  { mode: "html", title: "HTML + CSS", text: "A page with a stylesheet and script. Refreshes as you type.", icon: Globe },
  { mode: "js", title: "JavaScript", text: "Plain JavaScript in a sandboxed page.", icon: FileCode },
  { mode: "nextjs", title: "Next.js", text: "A real Next.js app running in browser Node.js.", icon: Code2 },
  { mode: "php", title: "PHP", text: "PHP 8.3 runs in your browser with includes.", icon: Server },
];

export function NewProjectDialog({
  onBlank,
  onTemplate,
  onFolder,
  onZip,
  onClose,
}: {
  onBlank: (m: Mode, name: string) => void;
  onTemplate: (m: Mode, name: string) => void;
  onFolder: (files: File[]) => void;
  onZip: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("html");
  const trimmed = name.trim();
  return (
    <Modal title="New project" onClose={onClose} wide>
      <div className="flex flex-col gap-5 p-5">
        <section className="flex flex-col gap-3" aria-label="Start your own project">
          <h3 className="text-[13px] font-semibold">Start your own</h3>
          <Field label="Project name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Church landing page"
              maxLength={80}
              className={inputClass}
              data-autofocus
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-soft">Language</span>
            <div role="radiogroup" aria-label="Language" className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.mode}
                  type="button"
                  role="radio"
                  aria-checked={mode === t.mode}
                  onClick={() => setMode(t.mode)}
                  className={
                    "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-[13px] " +
                    (mode === t.mode
                      ? "border-accent bg-accent-wash text-fg"
                      : "border-line-strong bg-raised text-soft hover:border-accent-line")
                  }
                >
                  <t.icon size={15} className="text-accent-soft" />
                  {t.title}
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" onClick={() => onBlank(mode, trimmed)} className="self-start">
            Create blank project
          </Button>
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4" aria-label="Bring your own code">
          <h3 className="text-[13px] font-semibold">Bring your own code</h3>
          <p className="text-xs text-muted">
            Upload a project folder from your computer, or a ZIP. node_modules, .git and .env files are skipped.
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-raised px-3.5 text-[13px] font-medium hover:border-accent-line focus-within:ring-2 focus-within:ring-accent">
              <FolderUp size={15} className="text-accent-soft" />
              Upload a folder
              <input
                type="file"
                className="sr-only"
                multiple
                // Non-standard but supported by Chrome, Edge, Safari and Firefox.
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                onChange={(e) => {
                  const list = Array.from(e.target.files || []);
                  e.target.value = "";
                  if (list.length) onFolder(list);
                }}
              />
            </label>
            <Button onClick={onZip} className="min-h-11">
              <FileArchive size={15} className="text-accent-soft" />
              Import a ZIP
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4" aria-label="Start from a template">
          <h3 className="text-[13px] font-semibold">Or start from a template</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.mode}
                type="button"
                onClick={() => onTemplate(t.mode, trimmed)}
                className="flex flex-col gap-1.5 rounded-xl border border-line-strong bg-raised p-3.5 text-left hover:border-accent-line hover:bg-hover"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <t.icon size={16} className="text-accent-soft" />
                  {t.title}
                </span>
                <span className="text-xs leading-relaxed text-muted">{t.text}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export function SettingsDialog({
  token,
  remember,
  status,
  onSave,
  onClose,
}: {
  token: string;
  remember: boolean;
  status: ServerStatus;
  onSave: (token: string, remember: boolean) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(token);
  const [keep, setKeep] = useState(remember);
  const row = (on: boolean, label: string, detail: string) => (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className={on ? "size-2 rounded-full bg-ok" : "size-2 rounded-full bg-dim"} />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted">{detail}</span>
    </div>
  );
  return (
    <Modal title="Settings" onClose={onClose}>
      <form
        className="flex flex-col gap-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value.trim(), keep);
        }}
      >
        <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-sunken p-3.5">
          {row(status.ai, "Studio AI", status.ai ? status.model || "configured" : "not configured")}
          {row(status.relay, "Agent Relay", status.relay ? "configured" : "not configured")}
        </div>
        <Field
          label="Studio access token"
          hint="The STUDIO_ACCESS_TOKEN from your server settings. Your AI provider key never leaves the server."
        >
          <input
            type="password"
            value={value}
            autoComplete="off"
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
        </Field>
        <label className="flex items-start gap-2.5 text-[13px]">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="mt-0.5 size-4 accent-[#6d5df6]" />
          <span>
            Remember on this device
            <span className="block text-xs text-dim">Handy on your phone. Leave off on shared computers; it is never put in exports.</span>
          </span>
        </label>
        <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
          <p>Projects save in this browser. Export a ZIP or JSON backup to move devices.</p>
          <p>Next.js projects need Chrome or Edge on HTTPS. PHP runs one request at a time in your browser.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} className="bg-transparent">
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
