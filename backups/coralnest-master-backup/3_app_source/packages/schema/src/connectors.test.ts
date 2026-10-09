import { describe, expect, it } from "vitest";
import { summarizeConnectorManifest, validateConnectorManifest } from "./connectors.js";
import { PackageFamilySchema, PackagePublishMetadataSchema } from "./packages.js";

const fixture = {
  schemaVersion: 1,
  id: "github",
  name: "GitHub",
  description: "Connect any agent to GitHub issues, PRs, and repositories.",
  service: "github",
  transport: "managed",
  auth: "oauth2",
  scopes: ["repo", "issues", "pull_requests"],
  targets: ["any-agent", "openclaw", "claude", "copilot", "composer"],
} as const;

describe("Connector manifest contract", () => {
  it("allows connectors in storage and publication metadata contracts", () => {
    expect(PackageFamilySchema("connectors")).toBe("connectors");
    expect(
      PackagePublishMetadataSchema({
        name: "@acme/github",
        family: "connectors",
        version: "1.0.0",
        changelog: "Initial release",
      }),
    ).not.toBeInstanceOf(Error);
  });

  it("accepts a valid connector and derives a safe summary", () => {
    const result = validateConnectorManifest(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(summarizeConnectorManifest(result.manifest)).toEqual({
      schemaVersion: 1,
      id: "github",
      name: "GitHub",
      description: "Connect any agent to GitHub issues, PRs, and repositories.",
      service: "github",
      transport: "managed",
      auth: "oauth2",
      scopeCount: 3,
      targetCount: 5,
    });
  });

  it("rejects a connector with an implied auth mismatch", () => {
    const result = validateConnectorManifest({
      ...fixture,
      auth: "managed",
      transport: "sdk",
      targets: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "connector_v1_empty_list", path: "$.targets" }),
    );
  });
});
