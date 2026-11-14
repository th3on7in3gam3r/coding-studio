import type { Suggestion } from "@/lib/suggestions";

export type LogEntry = {
  id: number;
  source: "terminal" | "console";
  level: "info" | "log" | "warn" | "error";
  text: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  changes?: Suggestion[];
  error?: string;
  pending?: boolean;
  docs?: { url: string; fetchedAt: string | null };
};

export type HistoryEntry = {
  id: string;
  projectId: string;
  path: string;
  before: string;
  after: string;
  title: string;
  isNew?: boolean;
  at: number;
};

export type ServerStatus = { ai: boolean; relay: boolean; model: string | null };

export type RelayState = {
  project: string;
  context: string;
  fetchedAt: string | null;
  loading: boolean;
  error: string;
};

export type Device = "desktop" | "tablet" | "phone";
export type AiTab = "chat" | "checks" | "relay";
export type MobileTab = "files" | "code" | "preview" | "ai";

export type Toast = {
  id: number;
  text: string;
  tone?: "info" | "error" | "success";
  action?: { label: string; run: () => void };
};
