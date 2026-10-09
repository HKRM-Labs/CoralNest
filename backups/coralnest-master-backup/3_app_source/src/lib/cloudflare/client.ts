/**
 * Cloudflare D1, R2, and Vectorize Client Helpers for CoralNest
 */

export interface RegistryItemRecord {
  id: string;
  slug: string;
  name: string;
  type: "flow" | "mcp" | "plugin" | "connector" | "persona";
  sub_type?: "skill" | "loop" | "graph";
  summary?: string;
  category: string;
  topics: string[];
  owner_handle?: string;
  source_repo?: string;
  downloads?: number;
  stars?: number;
  r2_payload_key?: string;
  is_official?: boolean;
}

export interface CloudflareEnv {
  CORALNEST_DB: {
    prepare: (query: string) => {
      bind: (...args: unknown[]) => {
        run: () => Promise<{ success: boolean }>;
        all: () => Promise<{ results: Record<string, unknown>[] }>;
        first: () => Promise<Record<string, unknown> | null>;
      };
    };
  };
  CORALNEST_STORAGE: {
    put: (
      key: string,
      value: string | ArrayBuffer | ReadableStream,
      options?: { httpMetadata?: { contentType?: string } },
    ) => Promise<unknown>;
    get: (
      key: string,
    ) => Promise<{ json: () => Promise<unknown>; text: () => Promise<string> } | null>;
    delete: (key: string) => Promise<void>;
  };
  CORALNEST_VECTORS: {
    query: (
      vector: number[],
      options?: { topK?: number; returnMetadata?: boolean },
    ) => Promise<{ matches: Array<{ id: string; score: number }> }>;
    insert: (vectors: Array<{ id: string; values: number[] }>) => Promise<unknown>;
  };
}

/**
 * 1. Upload heavy raw scraped JSON or package tarball into Cloudflare R2 (10 GB Free)
 */
export async function uploadScrapedRawFile(
  env: CloudflareEnv,
  key: string,
  data: Record<string, unknown>,
): Promise<string> {
  const r2Key = `scraped/${key}.json`;
  await env.CORALNEST_STORAGE.put(r2Key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
  return r2Key;
}

/**
 * 2. Fetch raw scraped JSON payload from Cloudflare R2
 */
export async function getScrapedRawFile<T = unknown>(
  env: CloudflareEnv,
  r2Key: string,
): Promise<T | null> {
  const object = await env.CORALNEST_STORAGE.get(r2Key);
  if (!object) return null;
  return (await object.json()) as T;
}

/**
 * 3. Upsert fast indexed metadata into Cloudflare D1 SQL (5 GB Free)
 */
export async function upsertRegistryItem(
  env: CloudflareEnv,
  item: RegistryItemRecord,
): Promise<void> {
  const query = `
    INSERT INTO registry_items (
      id, slug, name, type, sub_type, summary, category, topics,
      owner_handle, source_repo, downloads, stars, r2_payload_key, is_official
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      summary = excluded.summary,
      category = excluded.category,
      topics = excluded.topics,
      downloads = excluded.downloads,
      stars = excluded.stars,
      r2_payload_key = excluded.r2_payload_key,
      updated_at = datetime('now')
  `;

  await env.CORALNEST_DB.prepare(query)
    .bind(
      item.id,
      item.slug,
      item.name,
      item.type,
      item.sub_type ?? null,
      item.summary ?? null,
      item.category,
      JSON.stringify(item.topics ?? []),
      item.owner_handle ?? null,
      item.source_repo ?? null,
      item.downloads ?? 0,
      item.stars ?? 0,
      item.r2_payload_key ?? null,
      item.is_official ? 1 : 0,
    )
    .run();
}

/**
 * 4. Query registry items by type and category with sub-millisecond D1 speed
 */
export async function queryRegistryItems(
  env: CloudflareEnv,
  options: {
    type?: string;
    subType?: string;
    category?: string;
    limit?: number;
  },
): Promise<RegistryItemRecord[]> {
  const { type, subType, category, limit = 50 } = options;

  let query = "SELECT * FROM registry_items WHERE 1=1";
  const params: unknown[] = [];

  if (type) {
    query += " AND type = ?";
    params.push(type);
  }
  if (subType) {
    query += " AND sub_type = ?";
    params.push(subType);
  }
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY downloads DESC LIMIT ?";
  params.push(limit);

  const { results } = await env.CORALNEST_DB.prepare(query)
    .bind(...params)
    .all();

  return ((results ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    type: row.type as RegistryItemRecord["type"],
    sub_type: (row.sub_type as RegistryItemRecord["sub_type"]) ?? undefined,
    summary: (row.summary as string) ?? undefined,
    category: String(row.category),
    topics: typeof row.topics === "string" ? (JSON.parse(row.topics) as string[]) : [],
    owner_handle: (row.owner_handle as string) ?? undefined,
    source_repo: (row.source_repo as string) ?? undefined,
    downloads: typeof row.downloads === "number" ? row.downloads : 0,
    stars: typeof row.stars === "number" ? row.stars : 0,
    r2_payload_key: (row.r2_payload_key as string) ?? undefined,
    is_official: Boolean(row.is_official),
  }));
}

/**
 * 5. Run AI Vector Similarity Search using Cloudflare Vectorize (Free)
 */
export async function searchWithVectorize(
  env: CloudflareEnv,
  queryVector: number[],
  topK = 20,
): Promise<Array<{ id: string; score: number }>> {
  const response = await env.CORALNEST_VECTORS.query(queryVector, {
    topK,
    returnMetadata: true,
  });
  return response.matches ?? [];
}
