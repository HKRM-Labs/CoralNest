import type { PackageFamily } from "clawhub-schema";

export function familyLabel(family: PackageFamily) {
  switch (family) {
    case "code-plugin":
      return "Code Plugin";
    case "bundle-plugin":
      return "Bundle Plugin";
    case "claw":
      return "Claw";
    case "mcp":
      return "MCP";
    case "persona":
      return "Persona";
    case "connectors":
      return "Connector";
    default:
      return "Skill";
  }
}
