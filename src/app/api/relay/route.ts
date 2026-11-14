import { RELAY_SLUG } from "@/lib/project";
import { callRelay, relayConfigured } from "@/lib/relay";
import { checkAccess, json, readJson } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 30;

function notConfigured() {
  return json(
    { error: "Agent Relay is not configured. Set RELAY_MCP_URL on the server." },
    503,
  );
}

/** GET /api/relay?project=slug → the project's handoff and recent activity. */
export async function GET(request: Request) {
  if (!relayConfigured()) return notConfigured();
  const denied = checkAccess(request);
  if (denied) return denied;
  const project = new URL(request.url).searchParams.get("project") || "";
  if (!RELAY_SLUG.test(project)) return json({ error: "Invalid Relay project name." }, 400);
  try {
    const context = await callRelay("get_project_context", { project });
    return json({ project, context, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Agent Relay failed" }, 502);
  }
}

/** POST /api/relay {project, summary} → logs a session as "Coding Studio". */
export async function POST(request: Request) {
  if (!relayConfigured()) return notConfigured();
  const denied = checkAccess(request);
  if (denied) return denied;
  let body: { project?: unknown; summary?: unknown };
  try {
    body = (await readJson(request, 10000)) as typeof body;
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (typeof body.project !== "string" || !RELAY_SLUG.test(body.project))
    return json({ error: "Invalid Relay project name." }, 400);
  if (
    typeof body.summary !== "string" ||
    body.summary.trim().length < 10 ||
    body.summary.length > 4000
  )
    return json({ error: "Write a summary between 10 and 4000 characters." }, 400);
  try {
    const result = await callRelay("save_session", {
      project: body.project,
      summary: body.summary.trim(),
    });
    return json({ ok: true, result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Agent Relay failed" }, 502);
  }
}
