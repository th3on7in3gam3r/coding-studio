"use client";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type { Project, Workspace } from "@/lib/project";
import { cn } from "@/lib/utils";
import { FileBadge, IconButton } from "./ui";

type Node = {
  name: string;
  path: string;
  kind: "folder" | "file" | "asset";
  children: Node[];
};

function buildTree(project: Project): Node[] {
  const root: Node = { name: "", path: "", kind: "folder", children: [] };
  const ensure = (segments: string[]) => {
    let node = root;
    segments.forEach((seg, i) => {
      const path = segments.slice(0, i + 1).join("/");
      let next = node.children.find((c) => c.kind === "folder" && c.path === path);
      if (!next) {
        next = { name: seg, path, kind: "folder", children: [] };
        node.children.push(next);
      }
      node = next;
    });
    return node;
  };
  for (const folder of project.folders) ensure(folder.split("/"));
  const add = (path: string, kind: "file" | "asset") => {
    const parts = path.split("/");
    ensure(parts.slice(0, -1)).children.push({
      name: parts[parts.length - 1],
      path,
      kind,
      children: [],
    });
  };
  Object.keys(project.files).forEach((p) => add(p, "file"));
  Object.keys(project.assets).forEach((p) => add(p, "asset"));
  const sort = (nodes: Node[]) => {
    nodes.sort((a, b) =>
      a.kind === "folder" && b.kind !== "folder"
        ? -1
        : b.kind === "folder" && a.kind !== "folder"
          ? 1
          : a.name.localeCompare(b.name),
    );
    nodes.forEach((n) => sort(n.children));
  };
  sort(root.children);
  return root.children;
}

export function Explorer({
  project,
  workspace,
  active,
  pendingPaths,
  onOpen,
  onNewFile,
  onNewFolder,
  onImport,
  onRename,
  onDelete,
  onDeleteFolder,
  onSwitchProject,
  onNewProject,
  className,
}: {
  project: Project;
  workspace: Workspace;
  active: string;
  pendingPaths: Set<string>;
  onOpen: (path: string) => void;
  onNewFile: (folder?: string) => void;
  onNewFolder: (folder?: string) => void;
  onImport: () => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onSwitchProject: (id: string) => void;
  onNewProject: () => void;
  className?: string;
}) {
  const tree = useMemo(() => buildTree(project), [project]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (path: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  const labels: Record<string, string> = {
    html: "HTML",
    js: "JavaScript",
    nextjs: "Next.js",
    php: "PHP",
  };

  const render = (nodes: Node[], depth: number) =>
    nodes.map((node) => {
      const pad = { paddingLeft: 8 + depth * 14 };
      if (node.kind === "folder") {
        const open = !collapsed.has(node.path);
        return (
          <li key={"d:" + node.path} role="treeitem" aria-expanded={open} aria-selected={false}>
            <div className="group flex h-7 items-center rounded-md pr-1 hover:bg-hover">
              <button
                type="button"
                onClick={() => toggle(node.path)}
                className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] text-soft"
                style={pad}
              >
                {open ? (
                  <ChevronDown size={13} className="shrink-0 text-muted" />
                ) : (
                  <ChevronRight size={13} className="shrink-0 text-muted" />
                )}
                {open ? (
                  <FolderOpen size={15} className="shrink-0 text-[#f5b94a]" />
                ) : (
                  <Folder size={15} className="shrink-0 text-[#f5b94a]" />
                )}
                <span className="truncate">{node.name}</span>
              </button>
              <span className="hidden gap-0.5 group-focus-within:flex group-hover:flex">
                <IconButton label={`New file in ${node.path}`} onClick={() => onNewFile(node.path)} className="size-6">
                  <Plus size={13} />
                </IconButton>
                <IconButton label={`Delete folder ${node.path}`} onClick={() => onDeleteFolder(node.path)} className="size-6">
                  <Trash2 size={13} />
                </IconButton>
              </span>
            </div>
            {open && node.children.length > 0 && (
              <ul role="group">{render(node.children, depth + 1)}</ul>
            )}
          </li>
        );
      }
      if (node.kind === "asset")
        return (
          <li key={"a:" + node.path} role="treeitem" aria-selected={false}>
            <div
              className="flex h-7 items-center gap-1.5 text-[13px] text-muted"
              style={{ paddingLeft: 8 + depth * 14 + 19 }}
              title={`${node.path} (binary asset)`}
            >
              <ImageIcon size={14} className="shrink-0" />
              <span className="truncate">{node.name}</span>
            </div>
          </li>
        );
      const selected = node.path === active;
      return (
        <li key={"f:" + node.path} role="treeitem" aria-selected={selected}>
          <div
            className={cn(
              "group flex h-7 items-center rounded-md pr-1",
              selected ? "bg-selected text-white" : "text-soft hover:bg-hover",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(node.path)}
              title={node.path}
              className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left text-[13px]"
              style={{ paddingLeft: 8 + depth * 14 + 15 }}
            >
              <FileBadge path={node.path} />
              <span className="truncate">{node.name}</span>
              {node.path === project.entry && (
                <span className="ml-1 rounded bg-[#1f2433] px-1 text-[10px] text-muted">entry</span>
              )}
              {pendingPaths.has(node.path) && (
                <span className="ml-auto size-1.5 shrink-0 rounded-full bg-accent" title="AI change waiting" />
              )}
            </button>
            <span className="hidden gap-0.5 group-focus-within:flex group-hover:flex">
              <IconButton label={`Rename ${node.path}`} onClick={() => onRename(node.path)} className="size-6">
                <Pencil size={12} />
              </IconButton>
              <IconButton label={`Delete ${node.path}`} onClick={() => onDelete(node.path)} className="size-6">
                <Trash2 size={12} />
              </IconButton>
            </span>
          </div>
        </li>
      );
    });

  return (
    <aside aria-label="Explorer" className={cn("flex min-h-0 flex-col bg-panel", className)}>
      <div className="flex h-10 shrink-0 items-center justify-between pr-2 pl-3.5 text-[11px] font-semibold tracking-[0.06em] text-muted">
        EXPLORER
        <span className="flex gap-0.5">
          <IconButton label="New file" onClick={() => onNewFile()}>
            <FilePlus2 size={15} />
          </IconButton>
          <IconButton label="New folder" onClick={() => onNewFolder()}>
            <FolderPlus size={15} />
          </IconButton>
          <IconButton label="Import ZIP or JSON project" onClick={onImport}>
            <Upload size={15} />
          </IconButton>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className="flex h-7 items-center gap-1.5 px-2 text-[13px] font-semibold">
          <ChevronDown size={13} className="text-muted" />
          <span className="truncate">{project.name}</span>
        </div>
        <ul role="tree" aria-label="Project files">
          {render(tree, 0)}
        </ul>
      </div>
      <div className="shrink-0 border-t border-line px-3.5 py-3">
        <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted">PROJECTS</div>
        <ul className="max-h-40 overflow-y-auto">
          {workspace.projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSwitchProject(p.id)}
                aria-current={p.id === project.id ? "true" : undefined}
                className={cn(
                  "flex h-8 w-full items-center justify-between gap-2 rounded-md px-1.5 text-left text-[13px]",
                  p.id === project.id ? "text-fg" : "text-soft hover:bg-hover",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {p.id === project.id && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted">{labels[p.mode]}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onNewProject}
          className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#2e3546] text-[13px] text-soft hover:bg-hover"
        >
          <Plus size={14} /> New from template
        </button>
      </div>
    </aside>
  );
}
