// Translation proxy for free-form AI text. The provider key stays on the server.
// GET  -> { configured, provider }                      (the client asks once before sending text)
// POST -> { translations: string[], provider }          body: { target: "zh" | "ja" | "ko", texts: string[] }
import { NextResponse } from "next/server";
import { translateTexts, translationProvider, type TranslateTarget } from "@/lib/server/translate";

export const dynamic = "force-dynamic";

const MAX_TEXTS = 20;
const MAX_CHARS = 600; // reason_en is at most 300 characters; descriptions run to about 600

const noStore = { "Cache-Control": "no-store" };
const error = (status: number, code: string, message: string) =>
  NextResponse.json({ code, message }, { status, headers: noStore });

export async function GET() {
  const provider = translationProvider();
  return NextResponse.json({ configured: provider !== null, provider: provider?.name ?? null }, { headers: noStore });
}

export async function POST(req: Request) {
  // Only this app's own pages may spend the translation quota.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return error(403, "FORBIDDEN", "Cross-site requests are not allowed.");

  const provider = translationProvider();
  if (!provider) return error(501, "TRANSLATION_NOT_CONFIGURED", "No translation service is connected.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, "BAD_REQUEST", "Body must be JSON.");
  }
  const { target, texts } = (body ?? {}) as { target?: unknown; texts?: unknown };
  if (target !== "zh" && target !== "ja" && target !== "ko") return error(400, "BAD_REQUEST", "target must be zh, ja or ko.");
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS ||
    texts.some((t) => typeof t !== "string" || !t.trim() || t.length > MAX_CHARS)
  ) {
    return error(400, "BAD_REQUEST", `texts must be 1-${MAX_TEXTS} non-empty strings of at most ${MAX_CHARS} characters.`);
  }

  try {
    const translations = await translateTexts(provider, texts as string[], target as TranslateTarget);
    return NextResponse.json({ translations, provider: provider.name }, { headers: noStore });
  } catch (e) {
    console.warn("translation failed:", e instanceof Error ? e.message : e);
    return error(502, "TRANSLATION_FAILED", "The translation service did not answer.");
  }
}
