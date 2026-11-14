/**
 * Turns an Anthropic API error into a message the user can act on.
 * Never includes the API key; the provider's own message is trimmed and shown as-is.
 */
export function providerErrorMessage(status: number, detail: string, model: string) {
  const d = detail.replace(/\s+/g, " ").trim().slice(0, 300);
  if (/credit balance|billing|purchase credits/i.test(d))
    return "Your Anthropic API account is out of credits. Add credits at console.anthropic.com → Billing. API credits are separate from a Claude Pro/Max subscription.";
  if (status === 401 || /x-api-key|authentication/i.test(d))
    return "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy.";
  if (status === 404 || /model/i.test(d))
    return `The model "${model}" isn't available to this API key${d ? ` (${d})` : ""}. Check ANTHROPIC_MODEL in Vercel, then redeploy.`;
  if (status === 429) return "Anthropic's rate limit was hit. Wait a minute and try again.";
  if (status === 529 || status >= 500) return "Anthropic is busy or having trouble right now. Try again shortly.";
  return `AI provider returned HTTP ${status}${d ? `: ${d}` : ""}.`;
}

export async function readProviderError(r: Response) {
  try {
    const data = (await r.json()) as { error?: { message?: unknown } };
    return typeof data?.error?.message === "string" ? data.error.message : "";
  } catch {
    return "";
  }
}
