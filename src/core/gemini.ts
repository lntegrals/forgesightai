/**
 * gemini.ts — Minimal Gemini REST client for ForgeSight AI.
 * Server-side only. Never import from client components.
 *
 * Env vars:
 *   GEMINI_API_KEY     — required; if absent all calls return ok:false
 *   GEMINI_MODEL       — default "gemini-2.5-flash"
 *   GEMINI_TIMEOUT_MS  — default 12000
 */

export type GeminiJSONResult<T> =
  | { ok: true; json: T; rawText: string; model: string; usage?: unknown }
  | { ok: false; error: string; model: string; rawResponse?: unknown };

export async function geminiGenerateJSON<T>(args: {
  model: string;
  system: string;
  user: string;
  responseJsonSchema: object;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  retries?: number;
}): Promise<GeminiJSONResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY not set", model: args.model };
  }

  const model = args.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const timeoutMs = args.timeoutMs ?? (Number(process.env.GEMINI_TIMEOUT_MS) || 12000);
  const retries = args.retries ?? 1;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body = {
    system_instruction: { parts: [{ text: args.system }] },
    contents: [{ role: "user", parts: [{ text: args.user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: args.responseJsonSchema,
      ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
      ...(args.maxOutputTokens !== undefined ? { maxOutputTokens: args.maxOutputTokens } : {}),
    },
  };

  let lastError = "";
  let lastRawResponse: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      // Retry on 429 / 5xx
      if (res.status === 429 || res.status >= 500) {
        const raw = await res.json().catch(() => null);
        lastError = `HTTP ${res.status}`;
        lastRawResponse = raw;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        return { ok: false, error: lastError, model, rawResponse: lastRawResponse };
      }

      if (!res.ok) {
        const raw = await res.json().catch(() => null);
        return {
          ok: false,
          error: `HTTP ${res.status}: ${JSON.stringify(raw)}`,
          model,
          rawResponse: raw,
        };
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: unknown;
      };

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!rawText) {
        return { ok: false, error: "Empty response from Gemini", model, rawResponse: data };
      }

      let json: T;
      try {
        json = JSON.parse(rawText) as T;
      } catch (e) {
        return { ok: false, error: `JSON parse error: ${e}`, model, rawResponse: rawText };
      }

      return { ok: true, json, rawText, model, usage: data.usageMetadata };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }

  return { ok: false, error: lastError || "Unknown error", model };
}
