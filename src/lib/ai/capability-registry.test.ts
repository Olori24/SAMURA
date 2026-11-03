import { describe, expect, it } from "vitest";
import { buildCapabilityRegistry } from "./capability-registry";

describe("SAMURA capability registry", () => {
  it("marks configured chat and code as available without exposing provider details", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: true,
      imageConfigured: false,
      webSearchConfigured: false,
    });

    expect(result.find((item) => item.id === "chat")?.status).toBe("available");
    expect(result.find((item) => item.id === "code")?.status).toBe("available");
    expect(JSON.stringify(result)).not.toContain("apiKey");
    expect(JSON.stringify(result)).not.toContain("OPENAI_API_KEY");
    expect(JSON.stringify(result)).not.toContain("provider");
  });

  it("marks runtime-dependent features as requiring configuration when runtime is unavailable", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: false,
      chatConfigured: true,
      imageConfigured: false,
      webSearchConfigured: false,
    });

    expect(result.find((item) => item.id === "chat")?.status).toBe("needs_configuration");
    expect(result.find((item) => item.id === "documents")?.status).toBe("needs_configuration");
  });

  it("reports browser-local CSV analysis as available and keeps other unimplemented capabilities planned", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: true,
      imageConfigured: true,
      webSearchConfigured: false,
    });

    expect(result.find((item) => item.id === "data_analysis")?.status).toBe("available");
    expect(result.find((item) => item.id === "data_analysis")?.description).toContain("CSV");
    expect(result.find((item) => item.id === "file_analysis")?.status).toBe("available");
    expect(result.find((item) => item.id === "voice")?.status).toBe("available");
    for (const id of ["memory_projects", "agent_workflows"]) {
      expect(result.find((item) => item.id === id)?.status).toBe("planned");
    }
  });

  it("reports web research as available only when the search service is configured", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: true,
      imageConfigured: false,
      webSearchConfigured: true,
    });

    expect(result.find((item) => item.id === "web_search")?.status).toBe("available");
  });

  it("reports Gemini-grounded research as available without the separate chat provider", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: false,
      imageConfigured: false,
      webSearchConfigured: true,
    });

    expect(result.find((item) => item.id === "web_search")?.status).toBe("available");
  });

  it("does not mark research available when neither a complete Gemini nor Tavily path is configured", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: false,
      imageConfigured: false,
      webSearchConfigured: false,
    });

    expect(result.find((item) => item.id === "web_search")?.status).toBe("needs_configuration");
    expect(result.find((item) => item.id === "web_search")?.requirement).toContain("Gemini Search");
  });

  it("requires a working chat provider before enabling voice features", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: false,
      imageConfigured: false,
      webSearchConfigured: false,
    });

    expect(result.find((item) => item.id === "voice")?.status).toBe("needs_configuration");
  });
  it("requires a working chat provider before enabling file analysis", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: false,
      imageConfigured: false,
      webSearchConfigured: false,
    });

    expect(result.find((item) => item.id === "file_analysis")?.status).toBe("needs_configuration");
    expect(result.find((item) => item.id === "file_analysis")?.requirement).toContain("AI model");
  });
  it("reports image generation as requiring configuration when no image service key is configured", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: true,
      imageConfigured: false,
      webSearchConfigured: false,
    });

    expect(result.find((item) => item.id === "image_generation")?.status).toBe("needs_configuration");
    expect(result.find((item) => item.id === "image_generation")?.requirement).toBeTruthy();
  });
});
