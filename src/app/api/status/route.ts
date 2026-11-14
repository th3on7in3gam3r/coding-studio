import { relayConfigured } from "@/lib/relay";
import { json } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which optional server features are configured. Never returns secrets. */
export function GET() {
  return json({
    ai: Boolean(
      process.env.ANTHROPIC_API_KEY &&
        process.env.ANTHROPIC_MODEL &&
        process.env.STUDIO_ACCESS_TOKEN,
    ),
    model: process.env.ANTHROPIC_MODEL ? process.env.ANTHROPIC_MODEL : null,
    relay: relayConfigured() && Boolean(process.env.STUDIO_ACCESS_TOKEN),
  });
}
