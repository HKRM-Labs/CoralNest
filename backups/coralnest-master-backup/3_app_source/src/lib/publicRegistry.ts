export const CLAWHUB_SITE_URL = "https://clawhub.ai";
export const CLAWHUB_REPOSITORY_URL = "https://github.com/openclaw/clawhub";
export const CLAWHUB_DOCS_URL = "https://docs.openclaw.ai/clawhub/";
export const OPENCLAW_DOCS_LLMS_URL = "https://docs.openclaw.ai/llms.txt";
export const CLAWHUB_OPENAPI_URL = `${CLAWHUB_SITE_URL}/api/v1/openapi.json`;

export const PublicRegistryPaths = {
  home: "/",
  skills: "/flows",
  flows: "/flows",
  plugins: "/plugins",
  mcp: "/mcp",
  persona: "/persona",
  connectors: "/connectors",
  search: "/search",
} as const;

export const PUBLIC_REGISTRY_SURFACES = [
  {
    label: "Flows & skills",
    path: PublicRegistryPaths.flows,
    summary: "Browse agent recipes: skills, loops, and graph architectures.",
  },
  {
    label: "Plugins and packages",
    path: PublicRegistryPaths.plugins,
    summary: "Browse and search plugin package records on CoralNest.",
  },
  {
    label: "MCP servers",
    path: PublicRegistryPaths.mcp,
    summary: "Browse and search MCP server packages.",
  },
  {
    label: "Personas",
    path: PublicRegistryPaths.persona,
    summary: "Browse and search Persona packages.",
  },
  {
    label: "Connectors",
    path: PublicRegistryPaths.connectors,
    summary: "Browse managed, agent-agnostic SaaS connectors.",
  },
  {
    label: "Search",
    path: PublicRegistryPaths.search,
    summary: "Search the public CoralNest catalog.",
  },
] as const;

export function publicRegistryUrl(path: string) {
  return new URL(path, CLAWHUB_SITE_URL).href;
}

export function clawhubDocsUrl(slug?: string) {
  return new URL(slug ?? "", CLAWHUB_DOCS_URL).href;
}
