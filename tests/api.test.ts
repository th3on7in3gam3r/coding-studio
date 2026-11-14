import test from "node:test";
import assert from "node:assert/strict";
import { POST as chat } from "../src/app/api/chat/route";
import { GET as relayGet, POST as relayPost } from "../src/app/api/relay/route";
import { GET as status } from "../src/app/api/status/route";

const token = "test-studio-token-at-least-24-characters";
const body = {
  messages: [{ role: "user", content: "Improve accessibility" }],
  files: { "index.html": "<h1>Hello</h1>" },
  paths: ["index.html", "style.css"],
  mode: "html",
};
function request(url: string, auth = token, value: unknown = body, method = "POST") {
  return new Request("http://localhost" + url, {
    method,
    headers: {
      Authorization: "Bearer " + auth,
      "Content-Type": "application/json",
      Origin: "http://localhost",
    },
    body: method === "POST" ? JSON.stringify(value) : undefined,
  });
}
function sse(events: unknown[]) {
  const text = events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(text, { headers: { "content-type": "text/event-stream" } });
}
async function lines(r: Response) {
  return (await r.text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
}
async function withEnv(
  env: Record<string, string | undefined>,
  fetcher: typeof fetch | undefined,
  run: () => Promise<void>,
) {
  const old: Record<string, string | undefined> = {};
  const oldFetch = globalThis.fetch;
  for (const k of Object.keys(env)) {
    old[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  if (fetcher) globalThis.fetch = fetcher;
  try {
    await run();
  } finally {
    globalThis.fetch = oldFetch;
    for (const k of Object.keys(old)) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
}
const aiEnv = {
  ANTHROPIC_API_KEY: "fake-test-key",
  ANTHROPIC_MODEL: "test-model",
  STUDIO_ACCESS_TOKEN: token,
};

test("status reports configured features without secrets", async () => {
  await withEnv({ ...aiEnv, RELAY_MCP_URL: undefined }, undefined, async () => {
    const data = await status().json();
    assert.deepEqual(data, { ai: true, model: "test-model", relay: false });
    assert.doesNotMatch(JSON.stringify(data), /fake-test-key|test-studio/);
  });
});

test("chat requires configuration and a valid token", async () => {
  await withEnv({ ANTHROPIC_API_KEY: undefined }, undefined, async () => {
    const r = await chat(request("/api/chat"));
    assert.equal(r.status, 503);
    assert.match(await r.text(), /not configured/);
  });
  await withEnv(aiEnv, undefined, async () => {
    assert.equal((await chat(request("/api/chat", "wrong"))).status, 401);
    assert.equal(
      (await chat(request("/api/chat", token, { ...body, files: { "../x": "a" } }))).status,
      400,
    );
    assert.equal(
      (await chat(request("/api/chat", token, { ...body, messages: [] }))).status,
      400,
    );
  });
});

test("chat streams text and returns validated changes", async () => {
  let sent: { model: string; stream: boolean; messages: { content: string }[] } | undefined;
  const reply =
    "Add a page language.\n<studio-changes>" +
    JSON.stringify([
      { path: "index.html", title: "Lang", description: "Helps readers", content: '<html lang="en"><h1>Hello</h1></html>' },
    ]) +
    "</studio-changes>";
  const fetcher = (async (url: URL | RequestInfo, options?: RequestInit) => {
    if (String(url).includes("api.anthropic.com")) {
      sent = JSON.parse(String(options?.body));
      return sse([
        { type: "message_start" },
        { type: "content_block_delta", delta: { type: "text_delta", text: reply.slice(0, 20) } },
        { type: "content_block_delta", delta: { type: "text_delta", text: reply.slice(20) } },
        { type: "message_delta", delta: { stop_reason: "end_turn" } },
      ]);
    }
    return new Response("<p>Docs</p>");
  }) as typeof fetch;
  await withEnv(aiEnv, fetcher, async () => {
    const r = await chat(request("/api/chat"));
    assert.equal(r.status, 200);
    const out = await lines(r);
    assert.equal(out[0].type, "meta");
    assert.ok(out[0].docs.fetchedAt);
    assert.equal(
      out.filter((l) => l.type === "text").map((l) => l.text).join(""),
      reply,
    );
    const done = out.at(-1);
    assert.equal(done.type, "done");
    assert.equal(done.changes[0].before, "<h1>Hello</h1>");
    assert.equal(done.changes[0].source, "ai");
  });
  assert.equal(sent?.model, "test-model");
  assert.equal(sent?.stream, true);
  assert.match(sent!.messages[0].content, /<h1>Hello/);
});

test("chat rejects changes to files the AI was not shown", async () => {
  const reply =
    "<studio-changes>" +
    JSON.stringify([{ path: "style.css", title: "x", description: "y", content: "body{}" }]) +
    "</studio-changes>";
  const fetcher = (async (url: URL | RequestInfo) =>
    String(url).includes("anthropic")
      ? sse([{ type: "content_block_delta", delta: { type: "text_delta", text: reply } }])
      : new Response("", { status: 500 })) as typeof fetch;
  await withEnv(aiEnv, fetcher, async () => {
    const done = (await lines(await chat(request("/api/chat")))).at(-1);
    assert.deepEqual(done.changes, []);
    assert.match(done.changeError, /not shown/);
  });
});

test("relay loads context and saves sessions through the MCP endpoint", async () => {
  const calls: { name: string; arguments: Record<string, string> }[] = [];
  const fetcher = (async (url: URL | RequestInfo, options?: RequestInit) => {
    assert.match(String(url), /^https:\/\/relay\.example\/api\/mcp\//);
    const rpc = JSON.parse(String(options?.body));
    assert.equal(rpc.method, "tools/call");
    calls.push(rpc.params);
    return Response.json({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: `ok ${rpc.params.name}` }] },
    });
  }) as typeof fetch;
  await withEnv(
    { STUDIO_ACCESS_TOKEN: token, RELAY_MCP_URL: "https://relay.example/api/mcp/secret-token" },
    fetcher,
    async () => {
      assert.equal(
        (await relayGet(request("/api/relay?project=coding-studio", "bad", null, "GET"))).status,
        401,
      );
      assert.equal(
        (await relayGet(request("/api/relay?project=Bad Name", token, null, "GET"))).status,
        400,
      );
      const got = await (
        await relayGet(request("/api/relay?project=coding-studio", token, null, "GET"))
      ).json();
      assert.equal(got.context, "ok get_project_context");
      const saved = await relayPost(
        request("/api/relay", token, { project: "coding-studio", summary: "Built the hero animation." }),
      );
      assert.equal(saved.status, 200);
      assert.equal((await relayPost(request("/api/relay", token, { project: "coding-studio", summary: "x" }))).status, 400);
    },
  );
  assert.equal(calls[0].name, "get_project_context");
  assert.equal(calls[0].arguments.agent, "Coding Studio");
  assert.equal(calls[1].name, "save_session");
  assert.equal(calls[1].arguments.project, "coding-studio");
});

test("relay reports when it is not configured", async () => {
  await withEnv({ STUDIO_ACCESS_TOKEN: token, RELAY_MCP_URL: undefined }, undefined, async () => {
    const r = await relayGet(request("/api/relay?project=x", token, null, "GET"));
    assert.equal(r.status, 503);
  });
});

test("chat explains provider errors in plain words", async () => {
  const fail = (status: number, message: string) =>
    (async () => Response.json({ type: "error", error: { type: "x", message } }, { status })) as typeof fetch;
  await withEnv(aiEnv, fail(400, "Your credit balance is too low to access the Anthropic API."), async () => {
    const r = await chat(request("/api/chat"));
    assert.equal(r.status, 502);
    assert.match((await r.json()).error, /out of credits.*console\.anthropic\.com/);
  });
  await withEnv(aiEnv, fail(404, "model: claude-nope"), async () => {
    assert.match((await (await chat(request("/api/chat"))).json()).error, /model "test-model" isn't available/);
  });
  await withEnv(aiEnv, fail(401, "invalid x-api-key"), async () => {
    assert.match((await (await chat(request("/api/chat"))).json()).error, /rejected the API key/);
  });
  await withEnv(aiEnv, fail(400, "messages: something odd"), async () => {
    assert.match((await (await chat(request("/api/chat"))).json()).error, /HTTP 400: messages: something odd/);
  });
});

test("relay lists projects and creates a missing one", async () => {
  const calls: { name: string; arguments: Record<string, string> }[] = [];
  const fetcher = (async (_url: URL | RequestInfo, options?: RequestInit) => {
    const rpc = JSON.parse(String(options?.body));
    calls.push(rpc.params);
    const text =
      rpc.params.name === "list_projects"
        ? "- coding-studio: Coding Studio — Personal IDE (last: Claude, 2026-11-14)\n- awc-chat: AWC Chat (last: Claude, 2026-11-12)"
        : `Created project ${rpc.params.arguments.slug}.`;
    return Response.json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text }] } });
  }) as typeof fetch;
  await withEnv(
    { STUDIO_ACCESS_TOKEN: token, RELAY_MCP_URL: "https://relay.example/api/mcp/secret-token" },
    fetcher,
    async () => {
      const list = await (await relayGet(request("/api/relay?list=1", token, null, "GET"))).json();
      assert.deepEqual(list.projects, [
        { slug: "coding-studio", name: "Coding Studio" },
        { slug: "awc-chat", name: "AWC Chat" },
      ]);
      const created = await relayPost(
        request("/api/relay", token, { action: "create", project: "my-html-project", name: "My HTML project" }),
      );
      assert.equal(created.status, 200);
      assert.equal(
        (await relayPost(request("/api/relay", token, { action: "create", project: "Bad Name", name: "x" }))).status,
        400,
      );
    },
  );
  assert.equal(calls[1].name, "create_project");
  assert.deepEqual(calls[1].arguments, { agent: "Coding Studio", slug: "my-html-project", name: "My HTML project" });
});
