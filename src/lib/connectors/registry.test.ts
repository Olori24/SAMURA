import { describe, expect, it } from "vitest";
import { connectorRegistry, getConnector } from "./registry";

describe("SAMURA connector registry", () => {
  it("exposes the built-in text tools plugin as the only immediately available connector", () => {
    const available = connectorRegistry.filter((connector) => connector.status === "available");
    expect(available.map((connector) => connector.id)).toEqual(["text-tools"]);
    expect(available[0]?.auth).toBe("none");
  });

  it("does not claim external OAuth connectors are connected before setup", () => {
    for (const id of ["github", "google-drive", "slack"]) {
      const connector = getConnector(id);
      expect(connector).toBeDefined();
      expect(connector?.status).toBe("setup_required");
      expect(connector?.auth).toBe("oauth");
    }
  });

  it("only publishes actions declared by each connector", () => {
    const textTools = getConnector("text-tools");
    expect(textTools?.actions).toContain("format_json");
    expect(textTools?.actions).not.toContain("send_email");
    expect(getConnector("unknown-plugin")).toBeUndefined();
  });
});
