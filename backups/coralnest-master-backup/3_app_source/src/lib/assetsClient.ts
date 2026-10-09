import type {
  AssetCountsResponse,
  AssetDetailResponse,
  AssetFilterOptionsResponse,
  AssetPayloadResponse,
  AssetRow,
  AssetSearchParams,
  AssetSearchResponse,
  AssetTreeResponse,
  AssetType,
} from "./assetTypes";

/**
 * Browser-side fetchers for the CockroachDB-backed asset catalog. These talk
 * to the Nitro `/api/v1/assets/*` endpoints only — no database or storage
 * credentials ever reach the client bundle.
 */

export async function searchAssetsClient(
  params: AssetSearchParams,
  signal?: AbortSignal,
): Promise<AssetSearchResponse | null> {
  const url = new URL("/api/v1/assets/search", window.location.origin);
  if (params.type) url.searchParams.set("type", params.type);
  if (params.query) url.searchParams.set("query", params.query);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.framework) url.searchParams.set("framework", params.framework);
  if (params.transport) url.searchParams.set("transport", params.transport);
  if (params.sortBy) url.searchParams.set("sortBy", params.sortBy);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  try {
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return null;
    return (await res.json()) as AssetSearchResponse;
  } catch {
    return null;
  }
}

export async function getAssetDetailClient(
  type: AssetType,
  slug: string,
  signal?: AbortSignal,
): Promise<AssetDetailResponse | null> {
  try {
    const res = await fetch(
      `/api/v1/assets/detail?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`,
      { signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as AssetDetailResponse;
  } catch {
    return null;
  }
}

export async function getAssetPayloadClient(
  type: AssetType,
  slug: string,
  signal?: AbortSignal,
): Promise<AssetPayloadResponse | null> {
  try {
    const res = await fetch(
      `/api/v1/assets/payload?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`,
      { signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as AssetPayloadResponse;
  } catch {
    return null;
  }
}

export async function getAssetCountsClient(
  signal?: AbortSignal,
): Promise<AssetCountsResponse | null> {
  try {
    const res = await fetch("/api/v1/assets/counts", { signal });
    if (!res.ok) return null;
    return (await res.json()) as AssetCountsResponse;
  } catch {
    return null;
  }
}

export async function getAssetFilterOptionsClient(
  type: AssetType,
  signal?: AbortSignal,
): Promise<AssetFilterOptionsResponse | null> {
  try {
    const res = await fetch(`/api/v1/assets/filters?type=${encodeURIComponent(type)}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as AssetFilterOptionsResponse;
  } catch {
    return null;
  }
}

export async function getAssetTreeClient(
  type: AssetType,
  slug: string,
  signal?: AbortSignal,
): Promise<AssetTreeResponse | null> {
  try {
    const res = await fetch(
      `/api/v1/assets/tree?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`,
      { signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as AssetTreeResponse;
  } catch {
    return null;
  }
}

export function assetFileUrl(type: AssetType, slug: string, path: string): string {
  return `/api/v1/assets/file?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(path)}`;
}

export function assetDownloadUrl(type: AssetType, slug: string): string {
  return `/api/v1/assets/download?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`;
}

export function assetPayloadUrl(type: AssetType, slug: string): string {
  return `/api/v1/assets/payload?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`;
}

export function rowValue(row: AssetRow, key: string): unknown {
  return row[key];
}

export function rowString(row: AssetRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function rowNumber(row: AssetRow, key: string): number | undefined {
  const value = row[key];
  return typeof value === "number" ? value : undefined;
}

export function rowBool(row: AssetRow, key: string): boolean | undefined {
  const value = row[key];
  return typeof value === "boolean" ? value : undefined;
}

export function rowStringArray(row: AssetRow, key: string): string[] {
  const value = row[key];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

export function parsePayloadJson(payload: AssetPayloadResponse | null): unknown {
  if (!payload) return null;
  try {
    return JSON.parse(payload.content) as unknown;
  } catch {
    return null;
  }
}
