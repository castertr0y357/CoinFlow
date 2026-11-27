import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const NON_CHAT_PATTERN = /embed|whisper|tts|dall-e|moderation|rerank|bge-|nomic-embed/i;

export function normalizeAiBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported.");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "169.254.169.254" ||
    host === "metadata.google.internal" ||
    host === "metadata.goog"
  ) {
    throw new Error("Blocked metadata endpoint.");
  }

  // Match aiService.ts: promote remote http:// domains to https:// while keeping local/LAN http:// intact
  const isLocalOrLan =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "host.docker.internal" ||
    host.endsWith(".local") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    !host.includes(".");

  if (parsed.protocol === "http:" && !isLocalOrLan) {
    parsed.protocol = "https:";
  }

  return parsed.toString().replace(/\/+$/, "");
}

export function sortAndDedupeModels(ids: string[]): string[] {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  return unique.sort((a, b) => {
    const aNonChat = NON_CHAT_PATTERN.test(a) ? 1 : 0;
    const bNonChat = NON_CHAT_PATTERN.test(b) ? 1 : 0;
    if (aNonChat !== bNonChat) return aNonChat - bNonChat;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = (await req.json().catch(() => ({}))) as {
        baseUrl?: string;
        apiKey?: string;
      };

      const settings = await prisma.settings.findUnique({ where: { id: "global" } });
      const rawBaseUrl = (body.baseUrl ?? settings?.aiBaseUrl ?? "").trim();
      const apiKey = (body.apiKey ?? settings?.aiApiKey ?? "").trim();

      if (!rawBaseUrl) {
        return NextResponse.json({ error: "AI Base URL is required." }, { status: 400 });
      }

      let baseUrl: string;
      try {
        baseUrl = normalizeAiBaseUrl(rawBaseUrl);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Invalid AI Base URL." },
          { status: 400 }
        );
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        // 1. Try OpenAI-compatible GET /models
        const modelsUrl = `${baseUrl}/models`;
        const res = await fetch(modelsUrl, { headers, signal: controller.signal });

        if (res.ok) {
          const json = (await res.json()) as {
            data?: Array<{ id?: string; name?: string }>;
            models?: Array<{ name?: string; id?: string }>;
          };
          const rawIds = [
            ...(Array.isArray(json.data) ? json.data.map((m) => m.id || m.name || "") : []),
            ...(Array.isArray(json.models) ? json.models.map((m) => m.name || m.id || "") : []),
          ];
          const models = sortAndDedupeModels(rawIds);
          return NextResponse.json({ models, endpoint: modelsUrl });
        }

        // 2. Fallback to native Ollama GET /api/tags if /models returned 404
        if (res.status === 404) {
          const ollamaBase = baseUrl.replace(/\/v1$/i, "");
          const tagsUrl = `${ollamaBase}/api/tags`;
          const tagsRes = await fetch(tagsUrl, { headers, signal: controller.signal });
          if (tagsRes.ok) {
            const tagsJson = (await tagsRes.json()) as {
              models?: Array<{ name?: string; model?: string }>;
            };
            const rawIds = Array.isArray(tagsJson.models)
              ? tagsJson.models.map((m) => m.name || m.model || "")
              : [];
            const models = sortAndDedupeModels(rawIds);
            return NextResponse.json({ models, endpoint: tagsUrl });
          }
        }

        if (res.status === 401 || res.status === 403) {
          return NextResponse.json(
            { error: `Authentication failed (${res.status}) — check your AI API Key.` },
            { status: 502 }
          );
        }

        return NextResponse.json(
          { error: `Endpoint returned HTTP ${res.status} (${res.statusText}).` },
          { status: 502 }
        );
      } catch (fetchErr) {
        const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
        logger.warn("AI", "Model discovery failed", {
          action: "ai.models.discover",
          context: { baseUrl, error: String(fetchErr) },
        });
        return NextResponse.json(
          { error: isAbort ? "Connection timed out after 8s." : "Could not reach AI endpoint." },
          { status: 502 }
        );
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      logger.error("AI", "Unexpected error in /api/v1/ai/models", error);
      return NextResponse.json({ error: "Failed to discover models." }, { status: 500 });
    }
  });
}
