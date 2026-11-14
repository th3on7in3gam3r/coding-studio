import { RELAY_SLUG } from "@/lib/project";
import { callRelay, parseProjectList, relayConfigured } from "@/lib/relay";
import { checkAccess, json, readJson } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 30;

function notConfigured() {
  return json(
    { error: "Agent Relay is not configured. Set RELAY_MCP_URL on the server." },
    503,
  );
}

/**
 * GET /api/relay?project=slug → the project's handoff and recent activity.
 * GET /api/relay?list=1 → every Relay project, for the picker.
 */
export async function GET(request: Request) {
  if (!relayConfigured()) return notConfigured();
  const denied = checkAccess(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  if (params.get("list")) {
    try {
      return json({ projects: parseProjectList(await callRelay("list_projects", {})) });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Agent Relay failed" }, 502);
    }
  }
  const project = params.get("project") || "";
  if (!RELAY_SLUG.test(project)) return json({ error: "Invalid Relay project name." }, 400);
  try {
    const context = await callRelay("get_project_context", { project });
    return json({ project, context, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Agent Relay failed" }, 502);
  }
}

/**
 * POST /api/relay {project, summary} → logs a session as "Coding Studio".
 * POST /api/relay {action: "create", project, name} → creates the project in Relay.
 */
export async function POST(request: Request) {
  if (!relayConfigured()) return notConfigured();
  const denied = checkAccess(request);
  if (denied) return denied;
  let body: { project?: unknown; summary?: unknown; action?: unknown; name?: unknown };
  try {
    body = (await readJson(request, 10000)) as typeof body;
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (typeof body.project !== "string" || !RELAY_SLUG.test(body.project))
    return json({ error: "Invalid Relay project name." }, 400);
  if (body.action === "create") {
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : body.project;
    try {
      const result = await callRelay("create_project", { slug: body.project, name });
      return json({ ok: true, result });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Agent Relay failed" }, 502);
    }
  }
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
