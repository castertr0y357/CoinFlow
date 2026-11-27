import { describe, it, expect } from "vitest";
import { normalizeAiBaseUrl, sortAndDedupeModels } from "./route";

describe("AI Model Discovery Helpers", () => {
  it("normalizes remote http URLs to https while keeping local/LAN http intact", () => {
    expect(normalizeAiBaseUrl("http://ai.example.com/api/v1/")).toBe("https://ai.example.com/api/v1");
    expect(normalizeAiBaseUrl("http://localhost:11434/v1/")).toBe("http://localhost:11434/v1");
    expect(normalizeAiBaseUrl("http://host.docker.internal:11434")).toBe("http://host.docker.internal:11434");
    expect(normalizeAiBaseUrl("http://192.168.1.50:11434/v1")).toBe("http://192.168.1.50:11434/v1");
  });

  it("blocks cloud metadata endpoints and non-http schemes", () => {
    expect(() => normalizeAiBaseUrl("http://169.254.169.254/latest/meta-data")).toThrow();
    expect(() => normalizeAiBaseUrl("file:///etc/passwd")).toThrow();
  });

  it("deduplicates and sorts chat models ahead of embedding/audio models", () => {
    const sorted = sortAndDedupeModels([
      "nomic-embed-text",
      "gpt-4o",
      "gemma4:e4b",
      "whisper-1",
      "gemma4:e4b",
    ]);
    expect(sorted).toEqual(["gemma4:e4b", "gpt-4o", "nomic-embed-text", "whisper-1"]);
  });
});
