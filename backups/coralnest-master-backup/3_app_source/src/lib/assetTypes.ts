/**
 * Shared catalog types for the six CoralNest asset categories backed by
 * CockroachDB + Backblaze B2. This module must stay free of side effects so it
 * is safe to import from both browser components and the Nitro server.
 */

export type AssetType = "skills" | "plugins" | "mcp_servers" | "connectors" | "loops" | "graphs";

export const ASSET_TYPES: AssetType[] = [
  "skills",
  "plugins",
  "mcp_servers",
  "connectors",
  "loops",
  "graphs",
];

export type AssetSortKey = "quality" | "downloads" | "stars" | "newest";

export type AssetSearchParams = {
  query?: string;
  type?: AssetType | "all";
  category?: string;
  framework?: string;
  transport?: string;
  sortBy?: AssetSortKey;
  limit?: number;
  offset?: number;
};

export type AssetRow = Record<string, unknown>;

export type AssetSearchResponse = {
  type: string;
  items: AssetRow[];
  total: number;
  counts?: Partial<Record<AssetType, number>>;
};

export type AssetDetailResponse = {
  item: AssetRow;
  readme: string | null;
};

export type AssetPayloadResponse = {
  content: string;
  fileName: string;
  contentType: string;
  storagePath: string;
};

export type AssetCountsResponse = Record<AssetType, number>;

export type AssetFilterOptionsResponse = {
  categories: string[];
  subcategories: string[];
  frameworks: string[];
  transports: string[];
  providers: string[];
  authTypes: string[];
  publishers: string[];
};

export type AssetTreeFile = {
  path: string;
  size: number;
  modified: string;
};

export type AssetTreeResponse = {
  type: AssetType;
  slug: string;
  storagePath: string | null;
  files: AssetTreeFile[];
};
