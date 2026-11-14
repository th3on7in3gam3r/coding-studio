/**
 * Server-only client for Agent Relay's MCP endpoint (stateless, JSON responses).
 * RELAY_MCP_URL is the full connector URL including its secret token.
 */
export const RELAY_AGENT = "Coding Studio";

export function relayConfigured() {
  const url = process.env.RELAY_MCP_URL;
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:" || url.startsWith("http://localhost");
  } catch {
    return false;
  }
}

type ToolResult = { content?: { type: string; text?: string }[]; isError?: boolean };

export async function callRelay(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const url = process.env.RELAY_MCP_URL;
  if (!url || !relayConfigured()) throw new Error("Agent Relay is not configured");
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: { agent: RELAY_AGENT, ...args } },
    }),
  });
  if (!r.ok) throw new Error(`Agent Relay returned HTTP ${r.status}`);
  const type = r.headers.get("content-type") || "";
  let payload: { result?: ToolResult; error?: { message?: string } };
  if (type.includes("text/event-stream")) {
    const body = await r.text();
    const data = body
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .pop();
    payload = JSON.parse(data || "{}");
  } else payload = await r.json();
  if (payload.error) throw new Error(payload.error.message || "Agent Relay error");
  const text = (payload.result?.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("\n")
    .slice(0, 40000);
  if (payload.result?.isError) throw new Error(text || "Agent Relay refused the request");
  return text;
}
