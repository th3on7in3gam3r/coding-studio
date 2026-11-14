# Coding Studio 0.3

Personal Next.js coding workspace with browser-local project storage, ZIP/JSON backups, executable previews, a streaming AI assistant whose changes you preview before accepting, and optional Agent Relay handoffs. Works on desktop and phone.

## What's new in 0.3

- Redesigned workspace (dark, violet accent) matching the approved mockup: activity bar, folder tree, multiple editor tabs, breadcrumbs, Terminal / Console / Problems panel, device-size preview, status bar.
- Studio AI chat (`/api/chat`): streams replies, can read several files, console errors and the Agent Relay handoff, and proposes whole-file changes (edits or new files) validated on the server.
- Preview before accepting: an AI change shows as an inline diff in the editor and runs in the live preview (HTML, PHP and Node projects) before anything is written.
- Review screen with per-hunk Keep/Skip, checks (file unchanged, reduced motion, new npm package) and the AI's reasoning.
- History of the last 20 accepted changes, each undoable when the file has not been edited since.
- Agent Relay (`/api/relay`): load a project's handoff into Studio AI and save sessions as "Coding Studio".
- Command palette (⌘K), keyboard shortcuts (⌘↵ run/accept, Esc reject preview, ⌘B explorer), proper dialogs instead of browser prompts, toasts with Undo.
- Phone layout: bottom tabs (Files, Code, Preview, Studio AI), coding-key row above the keyboard, wrapped code lines.
- HTML projects refresh as you type. Self-hosted Inter and JetBrains Mono fonts, lucide icons, Tailwind styling.

## Start

Requires Node.js 22.22.2+ (22.x) or Node.js 24.15+ and npm 10+. On a fresh checkout:

```sh
npm ci
npm run dev
```

Open the URL printed by Next.js. Production:

```sh
npm run build
npm start
```

The preparation script self-hosts Monaco editor assets and PHP 8.3 WASM from the locked npm dependencies. Internet is needed for the first install. The ZIP contains source, tests, and package-lock.json; it intentionally excludes node_modules and generated runtime/build files.

## What works

- Multiple named projects, template creation, project switching and deletion.
- Monaco editor with syntax highlighting; Plain text fallback works if editor loading fails.
- Create, rename, delete text files; empty folders and binary assets survive backup round trips.
- Debounced IndexedDB autosave with a visible status and export fallback if storage fails. Empty files stay empty. Data remains in this browser profile on this origin; it is not cloud-synced. Use one editing tab at a time. Clearing site data removes projects.
- Import ZIP projects, wrapped root folders, and Studio JSON project backups. Existing projects stay intact. Export the active project as ZIP or JSON. ZIP metadata preserves entry file and runtime. Limits: 30 projects, 500 files/project, 12 MB expanded/project. Generated folders and .env files are skipped; traversal paths are refused. Other source files may still contain secrets: inspect your files before AI review.
- HTML/CSS/classic JavaScript execute from the current saved-in-memory source in a sandboxed iframe. Local script, stylesheet and image paths are resolved. Console errors and logs appear in Studio. Press Run after editing. External resources need internet and compatible response headers. Local browser ES module graphs, local HTML page navigation, forms and HTTP routing require a Node dev-server project instead of the direct preview.
- Browser JavaScript projects with package.json run their scripts.dev server through WebContainers; use this for module bundlers such as Vite. A package.json without scripts.dev produces a clear error.
- Next.js projects run npm install (lifecycle scripts disabled) and npm run dev in browser Node.js using WebContainers. Files sync after startup for framework hot reload; package.json dependency changes require Stop and Run. The included template uses Next's webpack mode to avoid depending on native Turbopack binaries in WebContainers. Native addons and host-level services are unavailable. Network/browser compatibility errors are shown, with a three-minute startup limit and Stop.
- PHP 8.3 executes an entry script in a self-hosted, terminable WebAssembly worker. Local includes and project files are mounted in /project. Output is displayed in the sandboxed preview. Each run creates a fresh filesystem. The 20-second limit includes initial WASM load. This is single-request PHP execution, not a full PHP web server; database services, PHP routing, persistent sessions and Composer installation are not provided.
- Preview opens in-panel and optionally in a new tab. Mobile width toggle available. Direct HTML new-tab previews remain inside a sandbox wrapper.
- Offline local checks provide real file changes (viewport, page language, reduced motion, keyboard focus). Studio AI uses a server-side Anthropic Messages API connection and only sends what is shown as context chips when you press Send. Every change can be previewed, reviewed per hunk, accepted, and undone from History; stale-file protection refuses to apply or undo over later edits.

## AI setup (optional)

Copy .env.example to .env.local and configure:

```dotenv
ANTHROPIC_API_KEY=your-provider-api-key
ANTHROPIC_MODEL=a-model-available-to-your-account
STUDIO_ACCESS_TOKEN=a-random-token-at-least-24-characters
```

Restart the server. Enter only STUDIO_ACCESS_TOKEN in the app's Settings. By default it is kept in memory for this tab; tick "Remember on this device" to keep it in this browser's local storage (handy on a phone, avoid on shared computers). It is never included in exports. Do not put the provider key in browser settings or prefix it with NEXT_PUBLIC_. A configured provider account is required for live AI requests; without it, local checks and all other supported features remain available.

AI receives only the files shown as context chips (up to 8), the runtime, the list of project file paths, your conversation, and, if enabled, console errors and the Agent Relay handoff. A fixed official documentation page is retrieved on demand with timeout/size bounds; the UI shows its URL and retrieval time or discloses a failure. This is contextual reference retrieval, not automatic dependency upgrading or a guarantee that generated code is current/correct. AI output is validated and never automatically executed/applied. Review and run it yourself.

The API requires a long bearer access token and refuses browser cross-origin requests. For hosted private use, also enable the host's private access protection. This app has no multi-user accounts, collaboration, cloud project sync or general-purpose user login. Projects live on each user's browser; the server's configured AI endpoint is shared with anyone holding its Studio token. Do not expose this token publicly.

## Agent Relay (optional)

Set `RELAY_MCP_URL` to your Agent Relay connector URL (the same `https://…/api/mcp/<token>` URL you gave Claude, ChatGPT and Grok). Studio calls its `get_project_context` and `save_session` tools from the server; the URL never reaches the browser. Each Studio project links to a Relay project slug (defaults to the project name; change it in Studio AI → Relay). The Relay tab and handoff card appear only when this is configured.

## Deploy to Vercel

Push source to a private GitHub repository and import it in Vercel as a Next.js project. Use npm ci / npm run build and the repository root. Add optional AI environment variables in server settings; do not commit .env.local. The application must retain its supplied COOP/COEP headers for WebContainers. Use HTTPS and recent Chrome/Edge; browser privacy settings or network policy can block WebContainers. Do not embed the IDE itself in an unrelated iframe. Hosting this interface does not run PHP or project Node processes on Vercel; those execute in the browser.

The ZIP is prepared for deployment, but no GitHub repository or hosted deployment was created in this session. In-app Deploy was removed because hosting integration was not implemented; use GitHub/Vercel externally.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Browser regression suite:

```sh
npx playwright install chromium
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:browser
```

Set PLAYWRIGHT_CHROMIUM_EXECUTABLE only if using an existing browser binary; otherwise Playwright's bundled browser is used. Browser tests check save/reload, executable HTML+JS, review/accept/undo, ZIP export, PHP output, Monaco loading and the phone layout. They do not assert live AI without credentials or guarantee that third-party WebContainers services are reachable.

## Runtime sources / licenses

- WebContainers: https://webcontainers.io/guides/quickstart and https://webcontainers.io/guides/configuring-headers (check provider licensing before commercial redistribution).
- PHP WASM / WordPress Playground: https://developer.wordpress.org/playground/developers/architecture/php-wasm-packages/ (GPL-2.0-or-later package; PHP runtime license is copied to public/runtime/PHP-LICENSE during preparation).
- Monaco: https://github.com/microsoft/monaco-editor (MIT). Preserve third-party notices distributed with dependencies.
- Anthropic Messages API: https://platform.claude.com/docs/en/api/messages/create.
