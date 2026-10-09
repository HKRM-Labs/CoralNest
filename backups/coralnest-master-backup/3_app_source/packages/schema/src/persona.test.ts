import { describe, expect, it } from "vitest";
import { PackageFamilySchema, PackagePublishMetadataSchema } from "./packages.js";
import { summarizePersonaManifest, validatePersonaManifest } from "./persona.js";

const fixture = {
  schemaVersion: 1,
  id: "creator-advisor",
  name: "Travel Advisor",
  description: "A warm travel planning assistant.",
  identity: { name: "travel-advisor", theme: "adventure", emoji: "🧭", avatar: "avatar.png" },
  traits: ["helpful", "concise", "proactive"],
  instructions: {
    source: "instructions/advisor.md",
    files: ["instructions/advisor.md", "instructions/rules.md"],
  },
} as const;

describe("Persona manifest contract", () => {
  it("allows persona in storage and publication metadata contracts", () => {
    expect(PackageFamilySchema("persona")).toBe("persona");
    expect(
      PackagePublishMetadataSchema({
        name: "@acme/travel-advisor",
        family: "persona",
        version: "1.0.0",
        changelog: "Initial release",
      }),
    ).not.toBeInstanceOf(Error);
  });

  it("accepts a valid persona and derives a safe summary", () => {
    const result = validatePersonaManifest(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(summarizePersonaManifest(result.manifest)).toEqual({
      schemaVersion: 1,
      id: "creator-advisor",
      name: "Travel Advisor",
      description: "A warm travel planning assistant.",
      traitCount: 3,
      instructionFileCount: 2,
    });
  });
});
