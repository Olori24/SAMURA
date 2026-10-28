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

  it("does not report unimplemented capabilities as available", () => {
    const result = buildCapabilityRegistry({
      runtimeConfigured: true,
      chatConfigured: true,
      imageConfigured: true,
      webSearchConfigured: false,
    });

    for (const id of ["file_analysis", "data_analysis", "voice", "memory_projects", "agent_workflows"]) {
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
