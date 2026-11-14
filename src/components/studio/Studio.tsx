"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FilePlus2,
  FolderPlus,
  LayoutGrid,
  Play,
  Settings2,
  Sparkles,
  Square,
  Upload,
} from "lucide-react";
import {
  blankProject,
  RELAY_SLUG,
  relaySlug as slugFor,
  replaceFile,
  safePath,
  template,
  validateProject,
  type Mode,
  type Project,
  type Workspace,
} from "@/lib/project";
import { loadWorkspace, saveWorkspace } from "@/lib/storage";
import { download, exportZip, importFolder, importProject } from "@/lib/archive";
import { previewWindowHTML, renderHTML } from "@/lib/preview";
import { applyHunks } from "@/lib/diff";
import { localSuggestions, visibleReply, type Suggestion } from "@/lib/suggestions";
import { languageOf } from "@/components/CodeEditor";
import { cn } from "@/lib/utils";
import { AssistantPanel, type ChangeActions } from "./AssistantPanel";
import { BottomPanel } from "./BottomPanel";
import { ActivityBar, MobileNav, StatusBar, Toasts, TopBar, modeLabels } from "./Chrome";
import { CommandPalette, type Command } from "./CommandPalette";
import {
  ConfirmDialog,
  PromptDialog,
  SettingsDialog,
  NewProjectDialog,
  type ConfirmRequest,
  type PromptRequest,
} from "./Dialogs";
import { EditorPane } from "./EditorPane";
import { Explorer } from "./Explorer";
import { PreviewPane, type PreviewState } from "./PreviewPane";
import { ReviewDialog } from "./ReviewDialog";
import type {
  AiTab,
  ChatMessage,
  Device,
  HistoryEntry,
  LogEntry,
  MobileTab,
  RelayState,
  ServerStatus,
  Toast,
} from "./types";
import { IconButton } from "./ui";

const TOKEN_KEY = "coding-studio-token";
const isNodeProject = (p: Project) => p.mode === "nextjs" || (p.mode === "js" && !!p.files["package.json"]);
const uid = () => crypto.randomUUID();
const languageName = (path: string) =>
  ({ typescript: "TypeScript", javascript: "JavaScript", html: "HTML", css: "CSS", php: "PHP", json: "JSON", markdown: "Markdown" } as Record<string, string>)[
    languageOf(path)
  ] || "Plain text";

export default function Studio() {
  // Workspace + saving
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Loading…");
  // Editor
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState("");
  const [plain, setPlain] = useState(false);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  // Layout
  const [sidebar, setSidebar] = useState(true);
  const [dockTab, setDockTab] = useState<"preview" | "ai">("preview");
  const [mobileTab, setMobileTab] = useState<MobileTab>("code");
  const [aiTab, setAiTab] = useState<AiTab>("chat");
  // Runtime
  const [preview, setPreview] = useState<PreviewState>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // Changes
  const [previewing, setPreviewing] = useState<Suggestion | null>(null);
  const [review, setReview] = useState<Suggestion | null>(null);
  const [checks, setChecks] = useState<Suggestion[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // AI + Relay
  const [status, setStatus] = useState<ServerStatus>({ ai: false, relay: false, model: null });
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [includeActive, setIncludeActive] = useState(true);
  const [extraFiles, setExtraFiles] = useState<string[]>([]);
  const [includeRelay, setIncludeRelay] = useState(true);
  const [includeConsole, setIncludeConsole] = useState(true);
  const [relay, setRelay] = useState<RelayState>({ project: "", context: "", fetchedAt: null, loading: false, error: "" });
  const [relayProjects, setRelayProjects] = useState<{ slug: string; name: string }[]>([]);
  const [slugDraft, setSlugDraft] = useState("");
  // Overlays
  const [palette, setPalette] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [promptReq, setPromptReq] = useState<PromptRequest | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const fileInput = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const runVersion = useRef(0);
  const saveVersion = useRef(0);
  const logId = useRef(0);
  const toastId = useRef(0);
  const aiAbort = useRef<AbortController | null>(null);

  const project = workspace?.projects.find((p) => p.id === workspace.activeId);
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // ---------- helpers ----------
  const toast = useCallback((text: string, tone: Toast["tone"] = "info", action?: Toast["action"]) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 9000 : 5000);
  }, []);
  const addLog = useCallback((source: LogEntry["source"], level: LogEntry["level"], text: string) => {
    setLogs((old) => [...old, { id: ++logId.current, source, level, text: text.slice(-5000) }].slice(-300));
  }, []);
  const runtimeLog = useCallback((s: string) => addLog("terminal", /error|failed/i.test(s) ? "error" : "info", s), [addLog]);
  const ask = (req: Omit<PromptRequest, "resolve">) =>
    new Promise<string | null>((resolve) => setPromptReq({ ...req, resolve }));
  const confirmAction = (req: Omit<ConfirmRequest, "resolve">) =>
    new Promise<boolean>((resolve) => setConfirmReq({ ...req, resolve }));

  const isStale = useCallback(
    (s: Suggestion) => {
      const p = projectRef.current;
      if (!p) return true;
      return s.isNew ? p.files[s.path] !== undefined : p.files[s.path] !== s.before;
    },
    [],
  );

  const effective = useMemo(() => {
    if (!project || !previewing) return project;
    const ok = previewing.isNew ? project.files[previewing.path] === undefined : project.files[previewing.path] === previewing.before;
    return ok ? { ...project, files: { ...project.files, [previewing.path]: previewing.after } } : project;
  }, [project, previewing]);
  const effectiveRef = useRef(effective);
  useEffect(() => {
    effectiveRef.current = effective;
  }, [effective]);

  // ---------- load / save ----------
  useEffect(() => {
    let mounted = true;
    try {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (saved) {
        setToken(saved);
        setRemember(true);
      }
    } catch {
      /* storage unavailable */
    }
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && mounted && setStatus(s))
      .catch(() => {});
    loadWorkspace()
      .then((saved) => {
        if (!mounted) return;
        const p = template("html");
        const w = saved || { version: 1 as const, activeId: p.id, projects: [p] };
        const current = w.projects.find((x) => x.id === w.activeId)!;
        setWorkspace(w);
        setTabs([current.entry]);
        setActive(current.entry);
        setSaveStatus("Saved");
      })
      .catch((e) => mounted && setLoadError(String(e instanceof Error ? e.message : e)));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!workspace) return;
    const version = ++saveVersion.current;
    const t = setTimeout(() => {
      setSaveStatus("Saving…");
      saveWorkspace(workspace)
        .then(() => version === saveVersion.current && setSaveStatus("Saved"))
        .catch(() => version === saveVersion.current && setSaveStatus("Save failed — export a backup"));
    }, 350);
    return () => clearTimeout(t);
  }, [workspace]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus !== "Saved" && saveStatus !== "Loading…") e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  // ---------- runtime ----------
  const stop = useCallback(() => {
    runVersion.current++;
    setBusy(false);
    setPreview(null);
    void import("@/lib/node-runtime").then((m) => m.stopNode());
    void import("@/lib/php-runtime").then((m) => m.stopPHP());
  }, []);

  useEffect(
    () => () => {
      void import("@/lib/node-runtime").then((m) => m.stopNode());
      void import("@/lib/php-runtime").then((m) => m.stopPHP());
    },
    [],
  );

  const run = useCallback(
    async (target?: Project) => {
      const p = target ?? effectiveRef.current;
      if (!p) return;
      const keep = preview?.kind === "html" && !isNodeProject(p) && p.mode !== "php";
      if (!keep) stop();
      const version = ++runVersion.current;
      setLogs((l) => l.filter((x) => x.source !== "console"));
      setBusy(true);
      const runId = uid();
      try {
        if (isNodeProject(p)) {
          setLogs([]);
          const runtime = await import("@/lib/node-runtime");
          if (version !== runVersion.current) return;
          const timeout = setTimeout(() => {
            if (version === runVersion.current) {
              runtime.stopNode();
              setBusy(false);
              toast("Startup took longer than 3 minutes. Check the terminal and your network, then try again.", "error");
            }
          }, 180000);
          try {
            await runtime.runNode(p, runtimeLog, (url) => {
              if (version !== runVersion.current) return;
              clearTimeout(timeout);
              setBusy(false);
              if (url) {
                setPreview({ kind: "node", value: url, runId });
                addLog("terminal", "info", "✓ Dev server ready. Edits now hot-reload in the preview.");
              } else setPreview(null);
            });
          } catch (e) {
            clearTimeout(timeout);
            throw e;
          }
        } else if (p.mode === "php") {
          addLog("terminal", "info", "Loading PHP 8.3 (WebAssembly)…");
          const { runPHP } = await import("@/lib/php-runtime");
          if (version !== runVersion.current) return;
          const result = await runPHP(p);
          if (version !== runVersion.current) return;
          setPreview({ kind: "html", value: renderHTML(p, result.html, runId), runId });
          if (result.errors) addLog("terminal", "warn", result.errors);
          addLog("terminal", "info", "✓ PHP executed.");
          setBusy(false);
        } else {
          setPreview({ kind: "html", value: renderHTML(p, undefined, runId), runId });
          setBusy(false);
        }
      } catch (e) {
        if (version === runVersion.current) {
          const message = e instanceof Error ? e.message : String(e);
          addLog("terminal", "error", message);
          setBusy(false);
          toast(message, "error");
        }
      }
    },
    [preview?.kind, stop, toast, runtimeLog, addLog],
  );

  // Live sync for Node projects (includes a previewed AI change).
  useEffect(() => {
    if (!effective || preview?.kind !== "node") return;
    const t = setTimeout(() => {
      void import("@/lib/node-runtime").then((m) => m.syncNode(effective, (e) => addLog("terminal", "error", String(e))));
    }, 500);
    return () => clearTimeout(t);
  }, [effective, preview?.kind, addLog]);

  // HTML: refresh as you type.
  useEffect(() => {
    if (!effective || !autoRefresh || preview?.kind !== "html" || effective.mode === "php" || isNodeProject(effective)) return;
    const t = setTimeout(() => {
      try {
        const runId = uid();
        setLogs((l) => l.filter((x) => x.source !== "console"));
        setPreview({ kind: "html", value: renderHTML(effective, undefined, runId), runId });
      } catch (e) {
        addLog("terminal", "error", e instanceof Error ? e.message : String(e));
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, autoRefresh]);

  // PHP / HTML without auto-refresh: re-render when a previewed change starts or ends.
  const previewingId = previewing?.id ?? null;
  useEffect(() => {
    const p = effectiveRef.current;
    if (!p || !preview || preview.kind === "node") return;
    if (p.mode === "php" || !autoRefresh) void run(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewingId]);

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.studioRun === preview?.runId) {
        const level = ["log", "warn", "error"].includes(e.data.level) ? e.data.level : "log";
        addLog("console", level, String(e.data.text).slice(0, 4000));
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [preview?.runId, addLog]);

  // ---------- project mutations ----------
  const update = useCallback((next: Project) => {
    setWorkspace((w) => (w ? { ...w, projects: w.projects.map((p) => (p.id === next.id ? { ...next, updated: Date.now() } : p)) } : w));
    setSaveStatus("Unsaved changes");
  }, []);
  const edit = (value: string) => {
    if (project && active && project.files[active] !== undefined) update({ ...project, files: { ...project.files, [active]: value } });
  };

  function resetForProject(p: Project) {
    setTabs([p.entry]);
    setActive(p.entry);
    setChecks([]);
    setPreviewing(null);
    setReview(null);
    setExtraFiles([]);
    setChat([]);
    aiAbort.current?.abort();
    setAiBusy(false);
    setRelay({ project: "", context: "", fetchedAt: null, loading: false, error: "" });
  }
  function switchProject(id: string) {
    const p = workspace?.projects.find((x) => x.id === id);
    if (!p || p.id === project?.id) return;
    resetForProject(p);
    stop();
    setWorkspace((w) => (w ? { ...w, activeId: id } : w));
    setSaveStatus("Unsaved changes");
  }
  function addProject(p: Project) {
    if (!workspace) return;
    if (workspace.projects.length >= 30) {
      toast("You can keep up to 30 projects. Export and delete an older one first.", "error");
      return;
    }
    resetForProject(p);
    stop();
    setWorkspace((w) => (w ? { ...w, activeId: p.id, projects: [...w.projects, p] } : w));
    setSaveStatus("Unsaved changes");
    setMobileTab("code");
  }
  async function renameProject() {
    if (!project) return;
    const name = await ask({ title: "Rename project", label: "Project name", initial: project.name });
    if (!name) return;
    try {
      update(validateProject({ ...project, name }));
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }
  async function deleteProject() {
    if (!workspace || !project) return;
    if (workspace.projects.length === 1) {
      toast("Create another project before deleting this one.", "error");
      return;
    }
    const ok = await confirmAction({
      title: "Delete project?",
      message: `“${project.name}” will be removed from this browser. Export a backup first if you might need it.`,
      confirmLabel: "Delete project",
      danger: true,
    });
    if (!ok) return;
    const next = workspace.projects.find((p) => p.id !== project.id)!;
    resetForProject(next);
    stop();
    setWorkspace({ ...workspace, activeId: next.id, projects: workspace.projects.filter((p) => p.id !== project.id) });
    setSaveStatus("Unsaved changes");
  }

  function openFile(path: string) {
    setTabs((t) => (t.includes(path) ? t : [...t, path]));
    setActive(path);
    setMobileTab("code");
    setCursor(null);
  }
  function closeTab(path: string) {
    setTabs((t) => {
      const next = t.filter((x) => x !== path);
      if (path === active) setActive(next[Math.max(0, t.indexOf(path) - 1)] || "");
      return next;
    });
  }
  const pathTaken = (p: Project, name: string) =>
    name in p.files ||
    name in p.assets ||
    p.folders.includes(name) ||
    Object.keys({ ...p.files, ...p.assets }).some((x) => name.startsWith(x + "/"));

  async function newPath(folder: boolean, base?: string) {
    if (!project) return;
    const name = await ask({
      title: folder ? "New folder" : "New file",
      label: folder ? "Folder path" : "File path",
      initial: base ? base + "/" : "",
      placeholder: folder ? "components/ui" : "components/Button.tsx",
      confirmLabel: "Create",
      validate: (v) => {
        try {
          safePath(v);
        } catch (e) {
          return e instanceof Error ? e.message : "Invalid path";
        }
        return pathTaken(project, v) ? "That path is already used" : null;
      },
    });
    if (!name) return;
    try {
      update(
        validateProject({
          ...project,
          files: folder ? project.files : { ...project.files, [name]: "" },
          folders: folder ? [...project.folders, name] : project.folders,
        }),
      );
      if (!folder) openFile(name);
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }
  async function renameFile(path: string) {
    if (!project) return;
    const next = await ask({
      title: "Rename file",
      label: "New path",
      initial: path,
      confirmLabel: "Rename",
      validate: (v) => {
        if (v === path) return "Choose a different name";
        try {
          safePath(v);
        } catch (e) {
          return e instanceof Error ? e.message : "Invalid path";
        }
        return v in project.files || v in project.assets ? "That file exists" : null;
      },
    });
    if (!next) return;
    try {
      const files = { ...project.files, [next]: project.files[path] };
      delete files[path];
      update(validateProject({ ...project, files, entry: project.entry === path ? next : project.entry }));
      setTabs((t) => t.map((x) => (x === path ? next : x)));
      if (active === path) setActive(next);
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }
  async function deleteFile(path: string) {
    if (!project) return;
    if (Object.keys(project.files).length === 1) {
      toast("Keep at least one text file.", "error");
      return;
    }
    const ok = await confirmAction({ title: "Delete file?", message: `Delete ${path}?`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const files = { ...project.files };
    const content = files[path];
    delete files[path];
    const entry = project.entry === path ? Object.keys(files)[0] : project.entry;
    update({ ...project, files, entry });
    closeTab(path);
    toast(`Deleted ${path}`, "info", {
      label: "Undo",
      run: () => {
        const p = projectRef.current;
        if (p && p.id === project.id && !(path in p.files)) update({ ...p, files: { ...p.files, [path]: content } });
      },
    });
  }
  async function deleteFolder(folder: string) {
    if (!project) return;
    const inside = (p: string) => p === folder || p.startsWith(folder + "/");
    const files = Object.fromEntries(Object.entries(project.files).filter(([p]) => !inside(p)));
    const assets = Object.fromEntries(Object.entries(project.assets).filter(([p]) => !inside(p)));
    const count = Object.keys(project.files).length - Object.keys(files).length + Object.keys(project.assets).length - Object.keys(assets).length;
    if (!Object.keys(files).length) {
      toast("Keep at least one text file outside this folder.", "error");
      return;
    }
    if (count) {
      const ok = await confirmAction({
        title: "Delete folder?",
        message: `Delete ${folder}/ and the ${count} file${count === 1 ? "" : "s"} in it?`,
        confirmLabel: "Delete folder",
        danger: true,
      });
      if (!ok) return;
    }
    update({
      ...project,
      files,
      assets,
      folders: project.folders.filter((f) => !inside(f)),
      entry: project.entry in files ? project.entry : Object.keys(files)[0],
    });
    setTabs((t) => t.filter((x) => !inside(x)));
    if (inside(active)) setActive(Object.keys(files)[0]);
  }

  async function handleImport(file: File) {
    try {
      const p = await importProject(file);
      addProject({ ...p, id: uid() });
      toast(`Imported ${p.name}. Your other projects were kept.`, "success");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }
  async function handleFolder(list: File[]) {
    try {
      const p = await importFolder(list);
      addProject({ ...p, id: uid() });
      toast(`Uploaded ${p.name} (${Object.keys(p.files).length} files). Your other projects were kept.`, "success");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }
  async function exportProject(format: "zip" | "json") {
    if (!project) return;
    try {
      download(
        format === "zip" ? await exportZip(project) : new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
        project.name.replace(/[^a-z0-9_-]/gi, "-") + (format === "zip" ? ".zip" : ".studio.json"),
      );
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }
  function openPreview() {
    if (!preview) return;
    const url =
      preview.kind === "node" ? preview.value : URL.createObjectURL(new Blob([previewWindowHTML(preview.value)], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    if (preview.kind === "html") setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---------- changes ----------
  function previewChange(s: Suggestion) {
    if (isStale(s)) {
      toast("That file changed after the suggestion. Ask again for a fresh change.", "error");
      return;
    }
    if (previewing?.id === s.id) {
      setPreviewing(null);
      return;
    }
    setPreviewing(s);
    if (!s.isNew) openFile(s.path);
    else setMobileTab("preview");
    if (!preview && !busy && !isNodeProject(project!)) {
      const p = projectRef.current!;
      void run({ ...p, files: { ...p.files, [s.path]: s.after } });
    }
  }
  function acceptChange(s: Suggestion, keep?: number[]) {
    const p = projectRef.current;
    if (!p) return;
    if (isStale(s)) {
      toast("That file changed after the suggestion, so it was not applied.", "error");
      return;
    }
    const content = keep ? applyHunks(s.before, s.after, keep) : s.after;
    try {
      const next = s.isNew
        ? validateProject({ ...p, files: { ...p.files, [s.path]: content } })
        : replaceFile(p, s.path, s.before, content);
      update(next);
      const entry: HistoryEntry = {
        id: uid(),
        projectId: p.id,
        path: s.path,
        before: s.before,
        after: content,
        title: s.title,
        isNew: s.isNew,
        at: Date.now(),
      };
      setHistory((h) => [entry, ...h].slice(0, 20));
      setAccepted((a) => new Set(a).add(s.id));
      setChecks((c) => c.filter((x) => x.id !== s.id));
      if (previewing?.id === s.id) setPreviewing(null);
      setReview(null);
      if (s.isNew) openFile(s.path);
      toast(`Applied “${s.title}”.`, "success", { label: "Undo", run: () => undoChange(entry) });
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }
  function undoChange(h: HistoryEntry) {
    const p = projectRef.current;
    if (!p || p.id !== h.projectId) {
      toast("Switch to that project to undo this change.", "error");
      return;
    }
    if (p.files[h.path] !== h.after) {
      toast("That file was edited after the change, so undo was refused to protect your edits.", "error");
      return;
    }
    if (h.isNew) {
      if (Object.keys(p.files).length === 1) return;
      const files = { ...p.files };
      delete files[h.path];
      update({ ...p, files, entry: p.entry === h.path ? Object.keys(files)[0] : p.entry });
      closeTab(h.path);
    } else update(replaceFile(p, h.path, h.after, h.before));
    setHistory((list) => list.filter((x) => x.id !== h.id));
    toast(`Undid “${h.title}”.`);
  }
  const actions: ChangeActions = {
    previewingId,
    state: (s) => (accepted.has(s.id) ? "accepted" : isStale(s) ? "stale" : "open"),
    onPreview: previewChange,
    onReview: (s) => setReview(s),
    onAccept: (s) => acceptChange(s),
  };

  // ---------- AI ----------
  async function sendToAI(text: string) {
    const p = projectRef.current;
    if (!p) return;
    const files: Record<string, string> = {};
    if (includeActive && active && p.files[active] !== undefined) files[active] = p.files[active];
    for (const f of extraFiles) if (p.files[f] !== undefined) files[f] = p.files[f];
    const history = [...chat.filter((m) => m.content.trim()), { role: "user" as const, content: text }]
      .map(({ role, content }) => ({ role, content: content.slice(0, 12000) }))
      .slice(-23);
    while (history.length && history[0].role !== "user") history.shift();
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const reply: ChatMessage = { id: uid(), role: "assistant", content: "", pending: true };
    setChat((c) => [...c, userMsg, reply]);
    setAiBusy(true);
    const controller = new AbortController();
    aiAbort.current = controller;
    const patch = (fn: (m: ChatMessage) => ChatMessage) =>
      setChat((c) => c.map((m) => (m.id === reply.id ? fn(m) : m)));
    const consoleErrors = logs.filter((l) => l.level === "error").slice(-20).map((l) => l.text).join("\n");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          messages: history,
          files,
          paths: Object.keys(p.files),
          mode: p.mode,
          relay: includeRelay && relay.context ? relay.context.slice(0, 20000) : undefined,
          console: includeConsole && consoleErrors ? consoleErrors.slice(-8000) : undefined,
        }),
      });
      if (!r.ok || !r.body) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `AI request failed (HTTP ${r.status})`);
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "",
        raw = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "meta") patch((m) => ({ ...m, docs: event.docs }));
          else if (event.type === "text") {
            raw += event.text;
            const shown = visibleReply(raw);
            patch((m) => ({ ...m, content: shown }));
          } else if (event.type === "done") {
            const current = projectRef.current;
            const changes = (event.changes as Suggestion[]).filter((s) => current?.id === p.id && s);
            patch((m) => ({
              ...m,
              pending: false,
              content: visibleReply(raw) || (changes.length ? "Here is what I would change:" : m.content),
              changes,
              error: event.changeError,
            }));
            if (changes.length) setMobileTab((t) => (t === "ai" ? t : t));
          } else if (event.type === "error") throw new Error(event.error);
        }
      }
      patch((m) => ({ ...m, pending: false }));
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      patch((m) => ({
        ...m,
        pending: false,
        error: aborted ? "Stopped." : e instanceof Error ? e.message : String(e),
      }));
    } finally {
      if (aiAbort.current === controller) {
        aiAbort.current = null;
        setAiBusy(false);
      }
    }
  }

  // ---------- Relay ----------
  const slug = project ? project.relay ?? slugFor(project.name) : "";
  useEffect(() => {
    setSlugDraft(slug);
  }, [slug]);
  const loadRelay = useCallback(
    async (name: string) => {
      if (!token || !RELAY_SLUG.test(name)) return;
      setRelay((r) => ({ ...r, loading: true, error: "" }));
      try {
        const r = await fetch("/api/relay?project=" + encodeURIComponent(name), {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load Agent Relay");
        setRelay({ project: name, context: data.context, fetchedAt: data.fetchedAt, loading: false, error: "" });
      } catch (e) {
        setRelay((r) => ({ ...r, loading: false, context: "", error: e instanceof Error ? e.message : String(e) }));
      }
    },
    [token],
  );
  useEffect(() => {
    if (status.relay && token && slug && relay.project !== slug && !relay.loading && !relay.error) void loadRelay(slug);
  }, [status.relay, token, slug, relay.project, relay.loading, relay.error, loadRelay]);
  const loadRelayProjects = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/relay?list=1", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      if (r.ok && Array.isArray(data.projects)) setRelayProjects(data.projects);
    } catch {
      /* the picker is optional; typing a name still works */
    }
  }, [token]);
  useEffect(() => {
    if (status.relay && token) void loadRelayProjects();
  }, [status.relay, token, loadRelayProjects]);
  async function createRelay(name: string) {
    if (!RELAY_SLUG.test(slugDraft)) return;
    setRelay((r) => ({ ...r, loading: true, error: "" }));
    try {
      const r = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ action: "create", project: slugDraft, name }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not create the Relay project");
      toast(`Created “${slugDraft}” in Agent Relay.`, "success");
      void loadRelayProjects();
      await loadRelay(slugDraft);
    } catch (e) {
      setRelay((r) => ({ ...r, loading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }
  async function saveRelay(summary: string) {
    try {
      const r = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ project: slug, summary }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save to Agent Relay");
      toast("Session saved to Agent Relay.", "success");
      void loadRelay(slug);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
      return false;
    }
  }

  // ---------- keyboard ----------
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette("");
      } else if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPalette("");
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        if (previewing) acceptChange(previewing);
        else void runRef.current();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        toast("Saved. Coding Studio saves automatically as you type.");
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebar((s) => !s);
      } else if (e.key === "Escape" && previewing && !review && !palette && !promptReq && !confirmReq) {
        setPreviewing(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- render ----------
  if (loadError)
    return (
      <main className="grid h-dvh place-items-center p-6 text-center">
        <div className="flex max-w-md flex-col items-center gap-3">
          <h1 className="text-lg font-semibold">Your saved workspace could not be opened</h1>
          <p className="text-sm text-muted">{loadError}</p>
          <p className="text-sm text-muted">Nothing was overwritten. Allow site storage or reopen in your regular browser profile.</p>
          <button type="button" onClick={() => location.reload()} className="h-9 rounded-lg bg-brand px-4 text-sm font-semibold text-white">
            Retry
          </button>
        </div>
      </main>
    );
  if (!workspace || !project)
    return <main className="grid h-dvh place-items-center text-sm text-muted">Opening Coding Studio…</main>;

  const paths = Object.keys(project.files).sort();
  const problems = logs.filter((l) => l.level === "error").length;
  const pendingChanges = chat.flatMap((m) => m.changes || []).filter((s) => !accepted.has(s.id) && !isStale(s));
  const pendingPaths = new Set(pendingChanges.map((s) => s.path));
  const running = !!preview || busy;
  const previewStale = previewing ? isStale(previewing) : false;

  const commands: Command[] = [
    { id: "run", label: preview ? "Rerun preview" : "Run preview", group: "Actions", hint: "⌘↵", icon: <Play size={14} />, run: () => void run() },
    ...(running ? [{ id: "stop", label: "Stop runtime", group: "Actions" as const, icon: <Square size={14} />, run: stop }] : []),
    { id: "newfile", label: "New file…", group: "Actions", icon: <FilePlus2 size={14} />, run: () => void newPath(false) },
    { id: "newfolder", label: "New folder…", group: "Actions", icon: <FolderPlus size={14} />, run: () => void newPath(true) },
    { id: "newproject", label: "New project…", group: "Actions", icon: <LayoutGrid size={14} />, run: () => setTemplates(true) },
    { id: "zip", label: "Export ZIP", group: "Actions", icon: <Download size={14} />, run: () => void exportProject("zip") },
    { id: "json", label: "Export JSON backup", group: "Actions", icon: <Download size={14} />, run: () => void exportProject("json") },
    { id: "import", label: "Import ZIP or JSON…", group: "Actions", icon: <Upload size={14} />, run: () => fileInput.current?.click() },
    { id: "checks", label: "Run local checks on this file", group: "Actions", icon: <Sparkles size={14} />, run: () => runChecks() },
    { id: "open", label: "Open preview in new tab", group: "Actions", icon: <Eye size={14} />, run: openPreview },
    { id: "plain", label: plain ? "Use code editor" : "Use plain text editor", group: "Actions", run: () => setPlain(!plain) },
    { id: "settings", label: "Settings", group: "Actions", icon: <Settings2 size={14} />, run: () => setSettings(true) },
    ...paths.map((p) => ({ id: "f:" + p, label: p.split("/").pop()!, path: p, group: "Files" as const, run: () => openFile(p) })),
    ...workspace.projects
      .filter((p) => p.id !== project.id)
      .map((p) => ({ id: "p:" + p.id, label: `Switch to ${p.name}`, hint: modeLabels[p.mode], group: "Projects" as const, run: () => switchProject(p.id) })),
  ];

  function runChecks() {
    if (!project || !active) return;
    const found = localSuggestions(project, active);
    setChecks(found);
    setAiTab("checks");
    setDockTab("ai");
    toast(found.length ? `${found.length} suggestion${found.length === 1 ? "" : "s"} for ${active}.` : `No issues found in ${active}.`);
  }
  const openAI = (tab?: AiTab) => {
    if (tab) setAiTab(tab);
    setDockTab("ai");
    setMobileTab("ai");
  };

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        project={project}
        workspace={workspace}
        saveStatus={saveStatus}
        status={status}
        relayLoaded={!!relay.context}
        busy={busy}
        running={!!preview}
        onSwitchProject={switchProject}
        onNewProject={() => setTemplates(true)}
        onRenameProject={() => void renameProject()}
        onDeleteProject={() => void deleteProject()}
        onPalette={() => setPalette("")}
        onExportZip={() => void exportProject("zip")}
        onExportJson={() => void exportProject("json")}
        onImport={() => fileInput.current?.click()}
        onRun={() => {
          void run();
          if (mobileTab !== "preview") setMobileTab("preview");
        }}
        onSettings={() => setSettings(true)}
        onRelay={() => openAI("relay")}
      />
      <input
        ref={fileInput}
        hidden
        type="file"
        accept=".zip,.json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImport(f);
          e.target.value = "";
        }}
      />
      <div className="flex min-h-0 flex-1">
        <ActivityBar
          sidebar={sidebar}
          onToggleSidebar={() => setSidebar(!sidebar)}
          onSearch={() => setPalette("")}
          onTemplates={() => setTemplates(true)}
          onRelay={() => openAI("relay")}
          onShortcuts={() =>
            toast("⌘K search · ⌘↵ run or accept · Esc reject preview · ⌘B toggle explorer · Enter sends a chat message")
          }
          relay={status.relay}
        />
        <Explorer
          project={project}
          workspace={workspace}
          active={active}
          pendingPaths={pendingPaths}
          onOpen={openFile}
          onNewFile={(f) => void newPath(false, f)}
          onNewFolder={(f) => void newPath(true, f)}
          onImport={() => fileInput.current?.click()}
          onRename={(p) => void renameFile(p)}
          onDelete={(p) => void deleteFile(p)}
          onDeleteFolder={(p) => void deleteFolder(p)}
          onSwitchProject={switchProject}
          onNewProject={() => setTemplates(true)}
          className={cn(
            "w-full border-line lg:w-[220px] lg:shrink-0 lg:border-r",
            mobileTab === "files" ? "flex" : "hidden",
            sidebar ? "lg:flex" : "lg:hidden",
          )}
        />
        <div className={cn("min-w-0 flex-1 flex-col border-line lg:flex lg:border-r", mobileTab === "code" ? "flex" : "hidden")}>
          <EditorPane
            tabs={tabs}
            active={active}
            projectName={project.name}
            content={active ? project.files[active] : undefined}
            plain={plain}
            previewing={previewing}
            stale={previewStale}
            onSelectTab={(p) => {
              setActive(p);
              setCursor(null);
            }}
            onCloseTab={closeTab}
            onEdit={edit}
            onTogglePlain={() => setPlain(!plain)}
            onAccept={() => previewing && acceptChange(previewing)}
            onReject={() => setPreviewing(null)}
            onReview={() => previewing && setReview(previewing)}
            onCursor={(l, c) => setCursor([l, c])}
            className="flex-1"
          />
          <BottomPanel logs={logs} running={running} onClear={() => setLogs([])} onStop={stop} className="hidden lg:flex" />
        </div>
        <div
          className={cn(
            "w-full min-w-0 flex-col border-line lg:w-[400px] wide:w-[380px] lg:shrink-0 lg:border-r",
            mobileTab === "preview" ? "flex" : "hidden",
            dockTab === "preview" ? "lg:flex" : "lg:hidden",
            "wide:flex",
          )}
        >
          <PreviewPane
            ref={frame}
            project={project}
            preview={preview}
            busy={busy}
            device={device}
            previewingChange={!!previewing && !previewStale}
            autoRefresh={autoRefresh}
            onDevice={setDevice}
            onRun={() => void run()}
            onOpen={openPreview}
            onMode={(m: Mode) => {
              stop();
              update({ ...project, mode: m });
            }}
            onEntry={(e) => update({ ...project, entry: e })}
            onAutoRefresh={setAutoRefresh}
            className="flex-1"
          />
          <BottomPanel logs={logs} running={running} onClear={() => setLogs([])} onStop={stop} className="lg:hidden" defaultOpen={false} />
        </div>
        <AssistantPanel
          status={status}
          hasToken={!!token}
          tab={aiTab}
          onTab={setAiTab}
          messages={chat}
          busy={aiBusy}
          onSend={(t) => void sendToAI(t)}
          onStopAi={() => aiAbort.current?.abort()}
          onClearChat={() => setChat([])}
          activePath={active}
          includeActive={includeActive}
          onIncludeActive={setIncludeActive}
          extraFiles={extraFiles}
          allPaths={paths}
          onAddFile={(p) => setExtraFiles((f) => (f.length >= 7 ? f : [...f, p]))}
          onRemoveFile={(p) => setExtraFiles((f) => f.filter((x) => x !== p))}
          includeRelay={includeRelay}
          onIncludeRelay={setIncludeRelay}
          consoleErrors={problems}
          includeConsole={includeConsole}
          onIncludeConsole={setIncludeConsole}
          actions={actions}
          checks={checks}
          onRunChecks={runChecks}
          history={history.filter((h) => h.projectId === project.id)}
          onUndo={undoChange}
          relay={relay}
          relaySlug={slugDraft}
          onRelaySlug={(s) => {
            setSlugDraft(s);
            if (RELAY_SLUG.test(s)) {
              update({ ...project, relay: s });
              setRelay({ project: "", context: "", fetchedAt: null, loading: false, error: "" });
            }
          }}
          onRelayLoad={() => {
            setRelay((r) => ({ ...r, error: "" }));
            void loadRelay(slugDraft);
          }}
          onRelaySave={saveRelay}
          relayProjects={relayProjects}
          onRelayCreate={() => void createRelay(project.name)}
          onOpenSettings={() => setSettings(true)}
          className={cn(
            "w-full lg:w-[360px] wide:w-[340px] lg:shrink-0",
            mobileTab === "ai" ? "flex" : "hidden",
            dockTab === "ai" ? "lg:flex" : "lg:hidden",
            "wide:flex",
          )}
        />
        {/* Dock switch for mid-size screens */}
        <div className="hidden w-11 shrink-0 flex-col items-center gap-1.5 border-l border-line bg-panel py-2.5 lg:flex wide:hidden">
          <IconButton label="Show preview" active={dockTab === "preview"} onClick={() => setDockTab("preview")} className="size-9 rounded-lg">
            <Eye size={18} />
          </IconButton>
          <IconButton label="Show Studio AI" active={dockTab === "ai"} onClick={() => setDockTab("ai")} className="size-9 rounded-lg">
            <Sparkles size={18} />
          </IconButton>
        </div>
      </div>
      <StatusBar
        saveStatus={saveStatus}
        relayText={status.relay ? (relay.context ? `Relay · ${relay.project}` : "Relay · not loaded") : null}
        problems={problems}
        cursor={plain ? null : cursor}
        language={active ? languageName(active) : ""}
        runtime={`${modeLabels[project.mode]} · ${preview ? "running" : "stopped"}`}
      />
      <MobileNav tab={mobileTab} onTab={setMobileTab} pending={pendingChanges.length} />

      {palette !== null && <CommandPalette commands={commands} initial={palette} onClose={() => setPalette(null)} />}
      {settings && (
        <SettingsDialog
          token={token}
          remember={remember}
          status={status}
          onClose={() => setSettings(false)}
          onSave={(t, keep) => {
            setToken(t);
            setRemember(keep);
            try {
              if (keep && t) localStorage.setItem(TOKEN_KEY, t);
              else localStorage.removeItem(TOKEN_KEY);
            } catch {
              /* storage unavailable */
            }
            setRelay({ project: "", context: "", fetchedAt: null, loading: false, error: "" });
            setSettings(false);
            toast("Settings saved.", "success");
          }}
        />
      )}
      {templates && (
        <NewProjectDialog
          onClose={() => setTemplates(false)}
          onBlank={(m, name) => {
            setTemplates(false);
            addProject(blankProject(m, name));
            toast(`Created ${name || "Untitled project"}. Start typing!`, "success");
          }}
          onTemplate={(m, name) => {
            setTemplates(false);
            const t = template(m);
            addProject(name ? { ...t, name } : t);
          }}
          onFolder={(list) => {
            setTemplates(false);
            void handleFolder(list);
          }}
          onZip={() => {
            setTemplates(false);
            fileInput.current?.click();
          }}
        />
      )}
      {review && (
        <ReviewDialog
          suggestion={review}
          project={project}
          onClose={() => setReview(null)}
          onAccept={(keep) => acceptChange(review, keep)}
          onPreview={() => previewing?.id !== review.id && previewChange(review)}
        />
      )}
      {promptReq && <PromptDialog req={promptReq} onDone={() => setPromptReq(null)} />}
      {confirmReq && <ConfirmDialog req={confirmReq} onDone={() => setConfirmReq(null)} />}
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
