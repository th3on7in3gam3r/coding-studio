# Verification — 2026-11-14 (v0.3, Claude)

## Passed in this session

- `npm run lint`, `npm run typecheck`, `npm test` (unit/API tests), `npm run build`.
- Browser suite (`npm run test:browser`, Chrome headless) passed 4 runs in a row: save/reload, live HTML + JS execution, local check → review → accept → undo, ZIP download, PHP 8.3 WASM output ("PHP result: 42"), Monaco load, phone layout sections and coding keys.
- Manual browser checks with screenshots at 1440×900, 1600×900 and 390×844: workspace layout, inline diff preview with live preview of the change, review screen, phone Code / Preview / Studio AI screens.
- Studio AI chat flow checked in the browser with mocked `/api/status`, `/api/relay` and `/api/chat` responses: streaming text, change card, preview, ⌘↵ accept, Relay handoff sent as context, undo from History.
- API routes tested with a mocked provider: streaming NDJSON, change validation (rejects paths the AI was not shown, traversal, unchanged files, cut-off blocks), auth, size limits; Relay route against a mocked MCP endpoint.

## Not verified

- No live AI request (no provider key here). Configure the server variables and send one real message before relying on it.
- No live Agent Relay call. The client speaks MCP JSON-RPC `tools/call` to the stateless endpoint in th3on7in3gam3r/agent-relay; confirm with your real `RELAY_MCP_URL`.
- Next.js / WebContainers preview still needs a smoke test on the HTTPS deployment in Chrome or Edge (carried over from 0.2).
- No GitHub repository or Vercel deployment was created.
