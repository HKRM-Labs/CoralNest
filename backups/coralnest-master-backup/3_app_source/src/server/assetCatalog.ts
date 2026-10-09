/**
 * Server-only access layer for the CockroachDB + Backblaze B2 asset catalog.
 *
 * This module must never be imported from browser code: it creates database
 * and storage clients (lazily, inside functions) using runtime env vars.
 * Never add hardcoded credential fallbacks here.
 */

import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import type postgres from "postgres";
import type {
  AssetCountsResponse,
  AssetFilterOptionsResponse,
  AssetRow,
  AssetSearchParams,
  AssetSearchResponse,
  AssetTreeFile,
  AssetType,
} from "../lib/assetTypes";
import { ASSET_TYPES } from "../lib/assetTypes";

export class AssetCatalogConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetCatalogConfigError";
  }
}

function envConfig() {
  const databaseUrl = process.env.COCKROACH_DATABASE_URL ?? process.env.DATABASE_URL;
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  if (!databaseUrl) {
    throw new AssetCatalogConfigError(
      "Asset catalog is not configured: missing env COCKROACH_DATABASE_URL",
    );
  }
  if (!keyId)
    throw new AssetCatalogConfigError("Asset catalog is not configured: missing env B2_KEY_ID");
  if (!applicationKey) {
    throw new AssetCatalogConfigError(
      "Asset catalog is not configured: missing env B2_APPLICATION_KEY",
    );
  }
  return {
    databaseUrl,
    bucket: process.env.B2_BUCKET_NAME ?? "coralnest-assets",
    bucketEndpoint: process.env.B2_BUCKET_ENDPOINT ?? "https://s3.us-west-004.backblazeb2.com",
    keyId,
    applicationKey,
  };
}

let sqlClient: ReturnType<typeof postgres> | null = null;

async function getSql(): Promise<ReturnType<typeof postgres>> {
  if (sqlClient) return sqlClient;
  const { databaseUrl } = envConfig();
  const postgresModule = (await import("postgres")).default;
  sqlClient = postgresModule(databaseUrl, {
    ssl: { rejectUnauthorized: false },
    max: 5,
    idle_timeout: 30,
  });
  return sqlClient;
}

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (s3Client) return s3Client;
  const { bucketEndpoint, keyId, applicationKey } = envConfig();
  s3Client = new S3Client({
    endpoint: bucketEndpoint,
    region: "us-west-004",
    credentials: { accessKeyId: keyId, secretAccessKey: applicationKey },
    forcePathStyle: true,
  });
  return s3Client;
}

function getBucket(): string {
  return envConfig().bucket;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const SEARCH_LIMIT_MAX = 100;

const SEARCH_COLUMNS: Record<AssetType, string> = {
  skills:
    "id, slug, name, source, source_repo, publisher, publisher_trust, category, subcategory, tags, difficulty, summary, version, license, quality_score, security_score, downloads, stars, storage_path, storage_url, created_at",
  plugins:
    "id, slug, name, source, source_repo, publisher, publisher_trust, category, subcategory, tags, summary, version, license, quality_score, security_score, downloads, stars, storage_path, storage_url, created_at",
  mcp_servers:
    "id, slug, name, source, namespace, transport, hosting, command, tools_count, category, subcategory, tags, summary, license, quality_score, security_score, storage_path, storage_url, created_at",
  connectors:
    "id, slug, name, source, provider, auth_type, actions_count, triggers_count, webhooks_count, category, subcategory, tags, summary, logo_url, docs_url, quality_score, security_score, storage_path, storage_url, created_at",
  loops:
    "id, slug, name, source, loop_kind, max_iterations, exit_criteria, step_count, convergence_strategy, category, subcategory, tags, difficulty, summary, author, quality_score, security_score, storage_path, storage_url, created_at",
  graphs:
    "id, slug, name, source, graph_type, entry_node, node_count, edge_count, framework, supports_streaming, supports_human_in_loop, category, subcategory, tags, difficulty, summary, author, license, quality_score, security_score, storage_path, storage_url, created_at",
};

const SORT_COLUMNS: Record<string, string> = {
  quality: "quality_score DESC",
  downloads: "downloads DESC",
  stars: "stars DESC",
  newest: "created_at DESC",
};

function normalizeType(type: string | undefined | null): AssetType {
  return (ASSET_TYPES as string[]).includes(type ?? "") ? (type as AssetType) : "skills";
}

function likeParam(query: string | undefined): string | null {
  const trimmed = query?.trim().toLowerCase();
  return trimmed ? `%${trimmed}%` : null;
}

export async function searchAssets(params: AssetSearchParams): Promise<AssetSearchResponse> {
  const sql = await getSql();
  const requestedType = params.type === "all" ? "all" : normalizeType(params.type);
  const limit = Math.min(Math.max(params.limit ?? 24, 1), SEARCH_LIMIT_MAX);
  const offset = Math.max(params.offset ?? 0, 0);
  const q = likeParam(params.query);

  if (requestedType === "all") {
    const counts: Partial<Record<AssetType, number>> = {};
    const items: AssetRow[] = [];
    for (const type of ASSET_TYPES) {
      const result = await searchAssets({ ...params, type, limit, offset });
      counts[type] = result.total;
      items.push(...result.items.map((row) => ({ type, ...row })));
    }
    return { type: "all", items, total: items.length, counts };
  }

  const type = requestedType;
  const columns = SEARCH_COLUMNS[type];
  const conditions: string[] = [];
  const values: string[] = [];
  if (q) {
    values.push(q);
    conditions.push(
      `(lower(name) LIKE $${values.length} OR lower(summary) LIKE $${values.length} OR lower(slug) LIKE $${values.length})`,
    );
  }
  if (params.category) {
    values.push(params.category);
    conditions.push(`category = $${values.length}`);
  }
  if (params.framework && type === "graphs") {
    values.push(params.framework);
    conditions.push(`framework = $${values.length}`);
  }
  if (params.transport && type === "mcp_servers") {
    values.push(params.transport);
    conditions.push(`transport = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sort = SORT_COLUMNS[params.sortBy ?? "quality"] ?? SORT_COLUMNS.quality;
  const orderBy =
    type === "skills" && !params.sortBy
      ? "ORDER BY quality_score DESC, stars DESC"
      : `ORDER BY ${sort}`;

  const rows = await sql.unsafe(
    `SELECT ${columns} FROM ${type} ${where} ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  const countRes = await sql.unsafe(`SELECT count(*) as c FROM ${type} ${where}`, values);
  return {
    type,
    items: rows as AssetRow[],
    total: parseInt(countRes[0].c, 10),
  };
}

export async function getAssetCounts(): Promise<AssetCountsResponse> {
  const sql = await getSql();
  const subselects = ASSET_TYPES.map((t) => `(SELECT count(*) FROM ${t}) AS ${t}`).join(", ");
  const res = await sql.unsafe(`SELECT ${subselects}`);
  const counts = {} as AssetCountsResponse;
  for (const t of ASSET_TYPES) {
    counts[t] = parseInt(res[0][t] as string, 10);
  }
  return counts;
}

export async function getAssetFilterOptions(type: AssetType): Promise<AssetFilterOptionsResponse> {
  const sql = await getSql();
  const empty: AssetFilterOptionsResponse = {
    categories: [],
    subcategories: [],
    frameworks: [],
    transports: [],
    providers: [],
    authTypes: [],
    publishers: [],
  };
  const columnChecks: Array<[keyof AssetFilterOptionsResponse, string]> = [
    ["categories", "category"],
    ["subcategories", "subcategory"],
    ["frameworks", "framework"],
    ["transports", "transport"],
    ["providers", "provider"],
    ["authTypes", "auth_type"],
    ["publishers", "publisher"],
  ];
  const columnNames = new Set(
    (
      await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [
        type,
      ])
    ).map((r) => r.column_name),
  );
  for (const [key, column] of columnChecks) {
    if (!columnNames.has(column)) continue;
    const rows = await sql.unsafe(
      `SELECT DISTINCT ${column} AS v FROM ${type} WHERE ${column} IS NOT NULL AND ${column} <> '' ORDER BY ${column} LIMIT 200`,
    );
    empty[key] = rows.map((r) => r.v);
  }
  return empty;
}

// ---------------------------------------------------------------------------
// Detail / payload / download
// ---------------------------------------------------------------------------

async function getAssetDetail(type: AssetType, slug: string): Promise<AssetRow | null> {
  const sql = await getSql();
  const rows = await sql.unsafe(`SELECT * FROM ${type} WHERE slug = $1 LIMIT 1`, [slug]);
  return (rows[0] as AssetRow) ?? null;
}

function storagePathFor(row: AssetRow): string | undefined {
  const path = row.storage_path;
  if (typeof path === "string" && path.length > 0) return path;
  const url = row.storage_url;
  if (typeof url === "string" && url.startsWith("b2://")) {
    return url.replace(/^b2:\/\/[^/]+\//, "");
  }
  return undefined;
}

async function readB2Object(key: string, maxBytes = 512 * 1024): Promise<string | null> {
  try {
    const res = await getS3().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    const content = await res.Body?.transformToString();
    if (content == null) return null;
    if (Buffer.byteLength(content, "utf8") > maxBytes) {
      return content.slice(0, maxBytes);
    }
    return content;
  } catch {
    return null;
  }
}

function fileNameForPath(path: string): string {
  return path.split("/").pop() ?? path;
}

function contentTypeForPath(path: string): string {
  if (/\.(md|markdown)$/i.test(path)) return "text/markdown; charset=utf-8";
  if (/\.json$/i.test(path)) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

/** README/LOOP companion files for a row's primary storage path, if any. */
async function readCompanionReadme(
  type: AssetType,
  storagePath: string | undefined,
): Promise<string | null> {
  if (!storagePath) return null;
  const slash = storagePath.lastIndexOf("/");
  if (slash < 0) return null;
  const dir = storagePath.slice(0, slash + 1);
  const base = storagePath.slice(slash + 1).toLowerCase();
  if (base === "readme.md") return null;
  if (type === "loops" && base === "loop.json") {
    return readB2Object(`${dir}LOOP.md`);
  }
  if (base !== "readme.md" && /\.json$/i.test(base)) {
    return readB2Object(`${dir}README.md`);
  }
  return null;
}

export async function getAssetPayload(
  type: AssetType,
  slug: string,
): Promise<{ content: string; fileName: string; contentType: string; storagePath: string } | null> {
  const row = await getAssetDetail(type, slug);
  if (!row) return null;
  const storagePath = storagePathFor(row);
  if (!storagePath) return null;
  const content = await readB2Object(storagePath);
  if (content == null) return null;
  return {
    content,
    fileName: fileNameForPath(storagePath),
    contentType: contentTypeForPath(storagePath),
    storagePath,
  };
}

export async function getAssetDetailWithReadme(
  type: AssetType,
  slug: string,
): Promise<{ item: AssetRow; readme: string | null } | null> {
  const item = await getAssetDetail(type, slug);
  if (!item) return null;
  const readme = await readCompanionReadme(type, storagePathFor(item));
  return { item, readme };
}

export async function getAssetDownload(
  type: AssetType,
  slug: string,
): Promise<
  | { kind: "file"; content: string; fileName: string; contentType: string }
  | { kind: "row"; content: string; fileName: string }
  | null
> {
  const row = await getAssetDetail(type, slug);
  if (!row) return null;
  const storagePath = storagePathFor(row);
  if (storagePath) {
    const content = await readB2Object(storagePath, 4 * 1024 * 1024);
    if (content != null) {
      return {
        kind: "file",
        content,
        fileName: fileNameForPath(storagePath),
        contentType: contentTypeForPath(storagePath),
      };
    }
  }
  return {
    kind: "row",
    content: JSON.stringify(row, null, 2),
    fileName: `${slug}.json`,
  };
}

// ---------------------------------------------------------------------------
// File tree (folder structure) + per-file reads
// ---------------------------------------------------------------------------

/** Live asset listing from B2 for the storage directory of a catalog row. */
export async function getAssetTree(
  type: AssetType,
  slug: string,
): Promise<{ storagePath: string | null; files: AssetTreeFile[] }> {
  const row = await getAssetDetail(type, slug);
  const storagePath = row ? storagePathFor(row) : undefined;
  if (!storagePath) return { storagePath: null, files: [] };
  const slash = storagePath.lastIndexOf("/");
  const dir = slash >= 0 ? storagePath.slice(0, slash + 1) : "";
  try {
    const listed = await getS3().send(
      new ListObjectsV2Command({ Bucket: getBucket(), Prefix: dir }),
    );
    const files = (listed.Contents ?? [])
      .filter((entry) => entry.Key !== dir && entry.Key && entry.Key.length > 0)
      .map((entry) => {
        const key = entry.Key as string;
        return {
          // Relative to the asset directory so file reads resolve to dir + path.
          path: dir ? key.slice(dir.length) : key,
          size: entry.Size ?? 0,
          modified: entry.LastModified?.toISOString() ?? "",
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
    return { storagePath, files };
  } catch {
    return { storagePath, files: [] };
  }
}

const FILE_LIMIT_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Read any file inside an asset's B2 directory. `path` must be a relative
 * path (e.g. `README.md`, `src/main.py`) and is resolved against the asset
 * directory; traversal outside the directory is rejected.
 */
export async function getAssetFileContent(
  type: AssetType,
  slug: string,
  path: string,
): Promise<{ content: string; fileName: string; contentType: string; storagePath: string } | null> {
  if (!path || path.includes("..") || path.startsWith("/")) return null;
  const row = await getAssetDetail(type, slug);
  if (!row) return null;
  const storagePath = storagePathFor(row);
  if (!storagePath) return null;
  const slash = storagePath.lastIndexOf("/");
  const dir = slash >= 0 ? storagePath.slice(0, slash + 1) : "";
  const key = `${dir}${path}`;
  const content = await readB2Object(key, FILE_LIMIT_MAX_BYTES);
  if (content == null) return null;
  return {
    content,
    fileName: fileNameForPath(key),
    contentType: contentTypeForPath(key),
    storagePath: key,
  };
}
