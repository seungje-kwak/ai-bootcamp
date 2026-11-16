// Server-only: machine translation for free-form AI text (reasons written by the LLM).
// Keys are read from server environment variables and never reach the browser.
//   TRANSLATE_PROVIDER = deepl | google
//   TRANSLATE_API_KEY  = the provider's key
//   TRANSLATE_API_URL  = optional endpoint override (proxy, or a local stub in tests)
// Leave them empty and /api/translate answers 501, and the UI shows the English original.
export type TranslateTarget = "zh" | "ja" | "ko";

const DEEPL_LANG: Record<TranslateTarget, string> = { zh: "ZH", ja: "JA", ko: "KO" };
const GOOGLE_LANG: Record<TranslateTarget, string> = { zh: "zh-CN", ja: "ja", ko: "ko" };

type Provider = {
  name: string;
  translate(texts: string[], target: TranslateTarget, signal: AbortSignal): Promise<string[]>;
};

function deepl(key: string, url?: string): Provider {
  // Free-plan keys end in ":fx" and use a different host.
  const endpoint = url || (key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate");
  return {
    name: "DeepL",
    async translate(texts, target, signal) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: texts, source_lang: "EN", target_lang: DEEPL_LANG[target] }),
        signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`DeepL responded ${res.status}`);
      const data = (await res.json()) as { translations?: { text?: unknown }[] };
      return (data.translations ?? []).map((t) => (typeof t.text === "string" ? t.text : ""));
    },
  };
}

function google(key: string, url?: string): Provider {
  const endpoint = url || "https://translation.googleapis.com/language/translate/v2";
  return {
    name: "Google Cloud Translation",
    async translate(texts, target, signal) {
      const res = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: texts, source: "en", target: GOOGLE_LANG[target], format: "text" }),
        signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Google Translation responded ${res.status}`);
      const data = (await res.json()) as { data?: { translations?: { translatedText?: unknown }[] } };
      return (data.data?.translations ?? []).map((t) => (typeof t.translatedText === "string" ? t.translatedText : ""));
    },
  };
}

export function translationProvider(): Provider | null {
  const name = (process.env.TRANSLATE_PROVIDER ?? "").trim().toLowerCase();
  const key = (process.env.TRANSLATE_API_KEY ?? "").trim();
  const url = (process.env.TRANSLATE_API_URL ?? "").trim() || undefined;
  if (!key) return null;
  if (name === "deepl") return deepl(key, url);
  if (name === "google") return google(key, url);
  return null;
}

const TIMEOUT_MS = 8000;
const CACHE_MAX = 1000;
const cache = new Map<string, string>(); // per server instance; saves quota on repeated sentences

/** Translates English texts. Throws if the provider fails or returns an incomplete answer. */
export async function translateTexts(provider: Provider, texts: string[], target: TranslateTarget): Promise<string[]> {
  const keyOf = (t: string) => `${target}\u0000${t}`;
  const missing = Array.from(new Set(texts.filter((t) => !cache.has(keyOf(t)))));
  if (missing.length) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const out = await provider.translate(missing, target, ctrl.signal);
      if (out.length !== missing.length || out.some((t) => !t.trim())) throw new Error("incomplete translation");
      missing.forEach((t, i) => {
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
        cache.set(keyOf(t), out[i]);
      });
    } finally {
      clearTimeout(timer);
    }
  }
  return texts.map((t) => cache.get(keyOf(t)) as string);
}
