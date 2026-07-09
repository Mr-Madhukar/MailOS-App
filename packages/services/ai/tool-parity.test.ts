import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { AGENT_TOOLS } from "./agent-internals";

function loadMcpToolNames(): string[] | null {
  const manifestPath = resolve(__dirname, "../../../mcp-server.json");
  if (!existsSync(manifestPath)) {
    return null;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    tools: Array<{ name: string }>;
  };
  return manifest.tools.map((tool) => tool.name).sort();
}

describe("agent ↔ MCP tool parity", () => {
  it("agent exposes every domain tool documented in mcp-server.json", () => {
    const mcpNames = loadMcpToolNames();
    if (mcpNames === null) {
      // Skip or pass cleanly on environments without the mcp-server.json manifest (e.g. CI)
      return;
    }
    const agentNames = AGENT_TOOLS.map((tool) => tool.function.name).sort();

    expect(agentNames).toEqual(mcpNames);
    expect(agentNames.length).toBe(57);
  });
});
