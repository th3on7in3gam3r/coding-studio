import { timingSafeEqual } from "node:crypto";

export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Checks the Studio bearer token and same-origin. Returns an error response or null. */
export function checkAccess(request: Request): Response | null {
  const token = process.env.STUDIO_ACCESS_TOKEN;
  if (!token)
    return json(
      { error: "Set STUDIO_ACCESS_TOKEN on the server to use this feature." },
      503,
    );
  if (token.length < 24)
    return json(
      { error: "Server access token must be at least 24 characters." },
      503,
    );
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const a = Buffer.from(supplied),
    b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return json({ error: "Enter the Studio access token in Settings." }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "Cross-origin request refused" }, 403);
  return null;
}

export async function readJson(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new RangeError("Request too large");
  const raw = await request.text();
  if (raw.length > limit) throw new RangeError("Request too large");
  return JSON.parse(raw) as unknown;
}

export const DOCS = {
  html: "https://developer.mozilla.org/en-US/docs/Web/HTML",
  js: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  css: "https://developer.mozilla.org/en-US/docs/Web/CSS",
  php: "https://www.php.net/manual/en/language.basic-syntax.php",
  nextjs: "https://nextjs.org/docs/app/getting-started",
} as const;

/** Fetch a fixed documentation page as bounded plain text. Never throws. */
export async function fetchDocs(url: string) {
  try {
    const doc = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
      redirect: "error",
    });
    if (!doc.ok || !doc.body) return { text: "", fetchedAt: null };
    const reader = doc.body.getReader();
    const decoder = new TextDecoder();
    let collected = "";
    while (collected.length < 60000) {
      const chunk = await reader.read();
      if (chunk.done) break;
      collected += decoder.decode(chunk.value, { stream: true });
    }
    await reader.cancel();
    const text = collected
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 12000);
    return { text, fetchedAt: new Date().toISOString() };
  } catch {
    return { text: "", fetchedAt: null };
  }
}
