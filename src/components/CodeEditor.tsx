"use client";
import Editor, { DiffEditor, loader, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
loader.config({ paths: { vs: "/monaco/vs" } });

export type EditorHandle = editor.IStandaloneCodeEditor;

const languages: Record<string, string> = {
  tsx: "typescript",
  ts: "typescript",
  jsx: "javascript",
  js: "javascript",
  mjs: "javascript",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  php: "php",
  md: "markdown",
};
export const languageOf = (path: string) =>
  languages[path.split(".").pop()?.toLowerCase() || ""] || "plaintext";

let themed = false;
function defineTheme(monaco: Monaco) {
  if (themed) return;
  themed = true;
  monaco.editor.defineTheme("studio", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "C4B5FD" },
      { token: "string", foreground: "86EFAC" },
      { token: "number", foreground: "FCD34D" },
      { token: "comment", foreground: "8A92A2", fontStyle: "italic" },
      { token: "type", foreground: "93C5FD" },
      { token: "tag", foreground: "93C5FD" },
      { token: "attribute.name", foreground: "FCD34D" },
      { token: "attribute.value", foreground: "86EFAC" },
      { token: "delimiter", foreground: "C9CEDA" },
    ],
    colors: {
      "editor.background": "#0B0D12",
      "editor.foreground": "#D7DBE3",
      "editorLineNumber.foreground": "#5C6476",
      "editorLineNumber.activeForeground": "#C9CEDA",
      "editor.lineHighlightBackground": "#12151D",
      "editor.selectionBackground": "#3A347088",
      "editorCursor.foreground": "#B4A9FF",
      "editorIndentGuide.background1": "#1D2230",
      "editorWidget.background": "#10131A",
      "editorWidget.border": "#262C3B",
      "diffEditor.insertedLineBackground": "#14221C",
      "diffEditor.removedLineBackground": "#2A1519",
      "diffEditor.insertedTextBackground": "#34D39933",
      "diffEditor.removedTextBackground": "#FDA4AF33",
      "scrollbarSlider.background": "#2E354666",
    },
  });
}

const baseOptions: editor.IEditorOptions = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
  fontLigatures: true,
  minimap: { enabled: false },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  padding: { top: 12 },
  smoothScrolling: true,
  renderLineHighlight: "line",
  cursorBlinking: "smooth",
  bracketPairColorization: { enabled: true },
};

const loading = (
  <p className="p-4 text-sm text-muted">
    Loading editor… Switch to plain text if it does not appear.
  </p>
);

export default function CodeEditor({
  path,
  value,
  onChange,
  onReady,
  onCursor,
  wrap,
}: {
  path: string;
  value: string;
  onChange: (s: string) => void;
  onReady?: (e: EditorHandle | null) => void;
  onCursor?: (line: number, col: number) => void;
  wrap?: boolean;
}) {
  return (
    <Editor
      path={path}
      language={languageOf(path)}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme="studio"
      beforeMount={defineTheme}
      onMount={(e) => {
        onReady?.(e);
        e.onDidChangeCursorPosition((ev) =>
          onCursor?.(ev.position.lineNumber, ev.position.column),
        );
        e.onDidDispose(() => onReady?.(null));
      }}
      loading={loading}
      options={{
        ...baseOptions,
        wordWrap: wrap ? "on" : "off",
        tabSize: 2,
        ariaLabel: `Code editor: ${path}`,
      }}
    />
  );
}

export function InlineDiff({
  path,
  before,
  after,
}: {
  path: string;
  before: string;
  after: string;
}) {
  return (
    <DiffEditor
      original={before}
      modified={after}
      language={languageOf(path)}
      originalModelPath={`diff-before://${path}`}
      modifiedModelPath={`diff-after://${path}`}
      theme="studio"
      beforeMount={defineTheme}
      loading={loading}
      keepCurrentOriginalModel
      keepCurrentModifiedModel
      options={{
        ...baseOptions,
        readOnly: true,
        renderSideBySide: false,
        originalEditable: false,
        renderOverviewRuler: false,
        wordWrap: "on",
      }}
    />
  );
}
