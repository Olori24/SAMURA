export type ConnectorStatus = "available" | "setup_required";

export type ConnectorDefinition = {
  id: string;
  name: string;
  category: "productivity" | "developer" | "utility";
  description: string;
  status: ConnectorStatus;
  auth: "none" | "oauth";
  scopes: string[];
  actions: string[];
};

export const connectorRegistry: ConnectorDefinition[] = [
  {
    id: "text-tools",
    name: "Text tools",
    category: "utility",
    description: "Analyze text and safely format JSON directly inside SAMURA. No external account required.",
    status: "available",
    auth: "none",
    scopes: ["process submitted text only"],
    actions: ["word_count", "character_count", "format_json"],
  },
  {
    id: "github",
    name: "GitHub",
    category: "developer",
    description: "Connect GitHub, inspect repositories your account can access, and use the AI engineering workspace to generate reviewed changes. Publishing requires effective repository write permission and your explicit approval; SAMURA creates a new branch and draft pull request.",
    status: "setup_required",
    auth: "oauth",
    scopes: ["read:user", "user:email", "repo"],
    actions: ["view_profile", "list_authorized_repositories", "inspect_repository", "generate_reviewed_patch", "publish_approved_draft_pull_request"],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "productivity",
    description: "Connect files and documents after Google OAuth credentials and restricted Drive scopes are configured.",
    status: "setup_required",
    auth: "oauth",
    scopes: ["drive.file"],
    actions: ["search_files", "read_file"],
  },
  {
    id: "slack",
    name: "Slack",
    category: "productivity",
    description: "Prepare workspace search and messaging workflows after Slack OAuth and explicit workspace consent are configured.",
    status: "setup_required",
    auth: "oauth",
    scopes: ["search:read"],
    actions: ["search_messages"],
  },
];

export function getConnector(id: string) {
  return connectorRegistry.find((connector) => connector.id === id);
}

export function getConnectorRegistry() {
  const githubConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY &&
    process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY.length >= 32
  );
  return connectorRegistry.map((connector) => connector.id === "github"
    ? { ...connector, status: githubConfigured ? "available" as const : "setup_required" as const }
    : connector);
}
