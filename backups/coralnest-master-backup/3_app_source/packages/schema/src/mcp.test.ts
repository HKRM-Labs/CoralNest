import { describe, expect, it } from "vitest";
import {
  MCP_MANIFEST_VALIDATION_CODES,
  McpManifestSummarySchema,
  summarizeMcpManifest,
  validateMcpManifest,
} from "./mcp.js";
import { PackageFamilySchema, PackagePublishMetadataSchema } from "./packages.js";

const stdioManifest = {
  schemaVersion: 1,
  name: "github",
  description: "Manage GitHub issues.",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-github"],
  env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
  timeout: 30,
} as const;

describe("MCP manifest contract", () => {
  it("allows mcp in storage and publication metadata contracts", () => {
    expect(PackageFamilySchema("mcp")).toBe("mcp");
    expect(
      PackagePublishMetadataSchema({
        name: "@acme/github",
        family: "mcp",
        version: "1.0.0",
        changelog: "Initial release",
      }),
    ).not.toBeInstanceOf(Error);
  });

  it("accepts a valid stdio manifest and derives a safe summary", () => {
    const result = validateMcpManifest(stdioManifest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(summarizeMcpManifest(result.manifest)).toEqual({
      schemaVersion: 1,
      name: "github",
      description: "Manage GitHub issues.",
      transport: "stdio",
      command: "npx",
      argCount: 2,
      envCount: 1,
      toolCount: 0,
    });
  });

  it("accepts a streamable-http manifest", () => {
    const result = validateMcpManifest({
      schemaVersion: 1,
      name: "search",
      transport: "streamable-http",
      url: "https://example.test/mcp",
      toolFilter: { include: ["web_search"], exclude: ["browse"] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(summarizeMcpManifest(result.manifest)).toMatchObject({
      transport: "streamable-http",
      url: "https://example.test/mcp",
      toolCount: 2,
    });
  });

  it("rejects remote transports without a url", () => {
    const result = validateMcpManifest({
      schemaVersion: 1,
      name: "search",
      transport: "sse",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((entry) => entry.code)).toContain(
      MCP_MANIFEST_VALIDATION_CODES.invalidMcpUrl,
    );
  });

  it("rejects stdio manifests without a command", () => {
    const result = validateMcpManifest({
      schemaVersion: 1,
      name: "github",
      transport: "stdio",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((entry) => entry.code)).toContain(
      MCP_MANIFEST_VALIDATION_CODES.invalidCommand,
    );
  });

  it("rejects http urls that are not loopback", () => {
    const result = validateMcpManifest({
      schemaVersion: 1,
      name: "search",
      transport: "streamable-http",
      url: "http://example.test/mcp",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((entry) => entry.code)).toContain(
      MCP_MANIFEST_VALIDATION_CODES.invalidMcpUrl,
    );
  });

  it("rejects urls with embedded credentials", () => {
    const result = validateMcpManifest({
      schemaVersion: 1,
      name: "search",
      transport: "streamable-http",
      url: "https://token@example.test/mcp",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((entry) => entry.code)).toContain(
      MCP_MANIFEST_VALIDATION_CODES.mcpUrlCredentials,
    );
  });

  it("rejects invalid names", () => {
    const result = validateMcpManifest({
      schemaVersion: 1,
      name: "Github!",
      transport: "stdio",
      command: "npx",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((entry) => entry.code)).toContain(
      MCP_MANIFEST_VALIDATION_CODES.invalidName,
    );
  });

  it("rejects duplicate tool filter entries", () => {
    const result = validateMcpManifest({
      schemaVersion: 1,
      name: "search",
      transport: "streamable-http",
      url: "https://example.test/mcp",
      toolFilter: { include: ["a", "a"] },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((entry) => entry.code)).toContain(
      MCP_MANIFEST_VALIDATION_CODES.duplicateToolFilter,
    );
  });

  it("keeps the summary within the structured summary contract", () => {
    const result = validateMcpManifest(stdioManifest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(McpManifestSummarySchema.allows(summarizeMcpManifest(result.manifest))).toBe(true);
  });
});
