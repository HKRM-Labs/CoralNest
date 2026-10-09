import { defineEventHandler, getRequestIP, getRequestURL, type H3Event } from "h3";
import { ASSET_TYPES, type AssetSortKey, type AssetType } from "../../src/lib/assetTypes";
import {
  AssetCatalogConfigError,
  getAssetCounts,
  getAssetDetailWithReadme,
  getAssetDownload,
  getAssetFileContent,
  getAssetFilterOptions,
  getAssetPayload,
  getAssetTree,
  searchAssets,
} from "../../src/server/assetCatalog";

const ASSET_TYPES_SET = new Set<string>(ASSET_TYPES);

function isAssetType(value: unknown): value is AssetType {
  return typeof value === "string" && ASSET_TYPES_SET.has(value);
}

// ---------------------------------------------------------------------------
// Minimal in-memory per-IP rate limiting (windowed counters). Sufficient for
// a single-process Nitro deployment; not a distributed limiter.
// ---------------------------------------------------------------------------

type RateLimitRule = { limit: number; windowMs: number };

const RATE_LIMITS: Record<string, RateLimitRule> = {
  search: { limit: 120, windowMs: 60_000 },
  counts: { limit: 120, windowMs: 60_000 },
  filters: { limit: 120, windowMs: 60_000 },
  detail: { limit: 120, windowMs: 60_000 },
  payload: { limit: 120, windowMs: 60_000 },
  tree: { limit: 120, windowMs: 60_000 },
  file: { limit: 240, windowMs: 60_000 },
  download: { limit: 60, windowMs: 60_000 },
};

const buckets = new Map<string, { windowStart: number; count: number }>();

function isRateLimited(event: H3Event, key: string): boolean {
  const ip = typeof getRequestIP === "function" ? (getRequestIP(event) ?? "unknown") : "unknown";
  const rule = RATE_LIMITS[key];
  if (!rule) return false;
  const now = Date.now();
  const bucketKey = `${ip}:${key}`;
  const bucket = buckets.get(bucketKey);
  if (!bucket || now - bucket.windowStart >= rule.windowMs) {
    buckets.set(bucketKey, { windowStart: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > rule.limit;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function cacheHeaders(ttlSeconds: number): Record<string, string> {
  return { "Cache-Control": `public, max-age=${ttlSeconds}` };
}

function rateLimited(): Response {
  return jsonResponse({ error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });
}

function parseIntParam(value: string | null, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function isAssetSortKey(value: string | null): value is AssetSortKey {
  return value === "quality" || value === "downloads" || value === "stars" || value === "newest";
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const method = event.req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "GET, HEAD" },
    });
  }

  const params = url.searchParams;
  const section = url.pathname.replace(/^\/api\/v1\/assets\/?/, "").split("/")[0] ?? "";

  try {
    if (section === "counts") {
      if (isRateLimited(event, "counts")) return rateLimited();
      return jsonResponse(await getAssetCounts(), 200, cacheHeaders(60));
    }

    if (section === "filters") {
      if (isRateLimited(event, "filters")) return rateLimited();
      const type = params.get("type");
      if (!type || !isAssetType(type)) {
        return jsonResponse({ error: "Valid type parameter required" }, 400);
      }
      return jsonResponse(await getAssetFilterOptions(type), 200, cacheHeaders(300));
    }

    if (section === "search") {
      if (isRateLimited(event, "search")) return rateLimited();
      const typeRaw = params.get("type") ?? "skills";
      if (typeRaw !== "all" && !isAssetType(typeRaw)) {
        return jsonResponse({ error: "Unknown asset type" }, 400);
      }
      const sortRaw = params.get("sortBy");
      const result = await searchAssets({
        type: typeRaw === "all" ? "all" : (typeRaw as AssetType),
        query: params.get("query") ?? undefined,
        category: params.get("category") ?? undefined,
        framework: params.get("framework") ?? undefined,
        transport: params.get("transport") ?? undefined,
        sortBy: isAssetSortKey(sortRaw) ? sortRaw : undefined,
        limit: parseIntParam(params.get("limit"), 24),
        offset: parseIntParam(params.get("offset"), 0),
      });
      return jsonResponse(result, 200, { "Cache-Control": "no-store" });
    }

    if (section === "detail" || section === "payload" || section === "download") {
      const type = params.get("type");
      const slug = params.get("slug")?.trim();
      if (!type || !isAssetType(type) || !slug) {
        return jsonResponse({ error: "type and slug parameters required" }, 400);
      }

      if (section === "download") {
        if (isRateLimited(event, "download")) return rateLimited();
        const download = await getAssetDownload(type, slug);
        if (!download) return jsonResponse({ error: "Asset not found" }, 404);
        const contentType =
          download.kind === "row" ? "application/json; charset=utf-8" : download.contentType;
        return new Response(download.content, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${download.fileName}"`,
            ...cacheHeaders(3600),
          },
        });
      }

      if (section === "payload") {
        if (isRateLimited(event, "payload")) return rateLimited();
        const payload = await getAssetPayload(type, slug);
        if (!payload) return jsonResponse({ error: "Asset not found" }, 404);
        return jsonResponse(payload, 200, cacheHeaders(300));
      }

      if (isRateLimited(event, "detail")) return rateLimited();
      const detail = await getAssetDetailWithReadme(type, slug);
      if (!detail) return jsonResponse({ error: "Asset not found" }, 404);
      return jsonResponse(detail, 200, cacheHeaders(300));
    }

    if (section === "tree" || section === "file") {
      const type = params.get("type");
      const slug = params.get("slug")?.trim();
      if (!type || !isAssetType(type) || !slug) {
        return jsonResponse({ error: "type and slug parameters required" }, 400);
      }

      if (section === "tree") {
        if (isRateLimited(event, "tree")) return rateLimited();
        const tree = await getAssetTree(type, slug);
        return jsonResponse({ type, slug, ...tree }, 200, cacheHeaders(300));
      }

      if (isRateLimited(event, "file")) return rateLimited();
      const path = params.get("path")?.trim();
      if (!path) return jsonResponse({ error: "path parameter required" }, 400);
      const file = await getAssetFileContent(type, slug, path);
      if (!file) return jsonResponse({ error: "File not found" }, 404);
      return new Response(file.content, {
        status: 200,
        headers: {
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename="${file.fileName}"`,
          ...cacheHeaders(300),
        },
      });
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof AssetCatalogConfigError) {
      console.error("[assets] catalog not configured:", error.message);
      return jsonResponse({ error: "Asset catalog unavailable" }, 503);
    }
    console.error("[assets] unexpected error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

// Kept for tests: expose parsing helpers.
export const __assetsTest = { isAssetType, parseIntParam };
