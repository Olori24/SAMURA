export type CapabilityStatus = "available" | "needs_configuration" | "planned";

export interface Capability {
  id: string;
  name: string;
  status: CapabilityStatus;
  description: string;
  requirement?: string;
}

interface CapabilityInputs {
  runtimeConfigured: boolean;
  chatConfigured: boolean;
  imageConfigured: boolean;
  webSearchConfigured: boolean;
}

export function buildCapabilityRegistry(input: CapabilityInputs): Capability[] {
  return [
    {
      id: "chat",
      name: "AI chat",
      status: input.runtimeConfigured && input.chatConfigured ? "available" : "needs_configuration",
      description: "Streaming conversations with saved history.",
      ...(!input.runtimeConfigured
        ? { requirement: "Application database and authentication configuration" }
        : !input.chatConfigured
          ? { requirement: "A working server-side AI model connection" }
          : {}),
    },
    {
      id: "code",
      name: "Code assistant",
      status: input.runtimeConfigured && input.chatConfigured ? "available" : "needs_configuration",
      description: "Code-focused answers through the existing chat workflow.",
      ...(!input.runtimeConfigured
        ? { requirement: "Application database and authentication configuration" }
        : !input.chatConfigured
          ? { requirement: "A working server-side AI model connection" }
          : {}),
    },
    {
      id: "documents",
      name: "Document workspace",
      status: input.runtimeConfigured ? "available" : "needs_configuration",
      description: "Create, edit, save, reopen, and export account-owned text documents.",
      ...(!input.runtimeConfigured ? { requirement: "Application database and authentication configuration" } : {}),
    },
    {
      id: "image_generation",
      name: "Image generation",
      status: input.runtimeConfigured && input.imageConfigured ? "available" : "needs_configuration",
      description: "Generate images from text prompts.",
      ...(!input.runtimeConfigured
        ? { requirement: "Application database and authentication configuration" }
        : !input.imageConfigured
          ? { requirement: "An administrator-configured image-generation service and valid access" }
          : {}),
    },
    {
      id: "web_search",
      name: "Web search and research",
      status: input.runtimeConfigured && input.chatConfigured && input.webSearchConfigured ? "available" : "needs_configuration",
      description: "Search public web sources and produce a source-grounded report with links.",
      ...(!input.runtimeConfigured
        ? { requirement: "Application database and authentication configuration" }
        : !input.chatConfigured
          ? { requirement: "A working server-side AI model connection" }
          : !input.webSearchConfigured
            ? { requirement: "An administrator-configured web search service key" }
            : {}),
    },
    {
      id: "file_analysis",
      name: "File analysis and citations",
      status: "planned",
      description: "Upload supported files, analyze their contents, and cite source passages.",
    },
    {
      id: "data_analysis",
      name: "CSV data analysis",
      status: "available",
      description: "Preview CSV files locally in the browser, calculate basic numeric summaries, view a quick numeric bar chart, and export a summary CSV. Spreadsheet formats and advanced charting are not yet supported.",
    },
    {
      id: "voice",
      name: "Voice conversations",
      status: "planned",
      description: "Speech input and spoken responses with explicit recording controls.",
    },
    {
      id: "memory_projects",
      name: "Memory and projects",
      status: "planned",
      description: "User-controlled memory and isolated project context.",
    },
    {
      id: "agent_workflows",
      name: "Agent workflows",
      status: "planned",
      description: "Multi-step tasks using approved tools with reviewable actions.",
    },
  ];
}
