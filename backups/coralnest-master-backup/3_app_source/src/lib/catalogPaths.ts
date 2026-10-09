import type { AssetType } from "./assetTypes";

/**
 * Public route mapping for catalog rows, shared by browse cards, detail pages,
 * home sections, and the unified search page.
 */
export function catalogDetailHref(type: AssetType, slug: string): string {
  switch (type) {
    case "skills":
      return `/skills/${encodeURIComponent(slug)}`;
    case "loops":
      return `/loops/${encodeURIComponent(slug)}`;
    case "graphs":
      return `/graphs/${encodeURIComponent(slug)}`;
    case "mcp_servers":
      return `/mcp/${encodeURIComponent(slug)}`;
    case "connectors":
      return `/connectors/${encodeURIComponent(slug)}`;
    case "plugins":
      return `/plugins/catalog/${encodeURIComponent(slug)}`;
    default: {
      const exhaustive: never = type;
      throw new Error(`Unhandled asset type: ${String(exhaustive)}`);
    }
  }
}

export function catalogBrowseHref(type: AssetType): string {
  switch (type) {
    case "skills":
      return "/flows?tab=skills";
    case "loops":
      return "/flows?tab=loops";
    case "graphs":
      return "/flows?tab=graphs";
    case "mcp_servers":
      return "/mcp";
    case "connectors":
      return "/connectors";
    case "plugins":
      return "/plugins";
    default: {
      const exhaustive: never = type;
      throw new Error(`Unhandled asset type: ${String(exhaustive)}`);
    }
  }
}
