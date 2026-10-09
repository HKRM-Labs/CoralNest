import postgres from "postgres";

export interface CockroachFlowRecord {
  id: string;
  slug: string;
  name: string;
  provider: string; // 'clawhub', 'skills.sh', 'github', 'composio'
  kind?: "skill" | "loop" | "graph";
  family?: string;
  category?: string;
  topics?: string[];
  summary?: string;
  prompt_content?: string;
  author_handle?: string;
  source_repo?: string;
  version?: string;
  license?: string;
  is_official?: boolean;
  is_featured?: boolean;
  downloads?: number;
  stars?: number;
  raw_manifest?: Record<string, unknown>;
}

// Read database URL from environment
const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

// High-speed pooled connection with TLS support
export const sql = postgres(databaseUrl, {
  ssl: {
    rejectUnauthorized: false,
  },
  max: 25,
  idle_timeout: 30,
});

/**
 * 1. Initialize CockroachDB Tables (Native Cockroach SQL)
 */
export async function initializeCockroachSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS flows (
      id STRING PRIMARY KEY,
      slug STRING UNIQUE NOT NULL,
      name STRING NOT NULL,
      provider STRING NOT NULL,
      kind STRING NOT NULL,
      family STRING,
      category STRING,
      topics STRING[],
      summary STRING,
      prompt_content STRING,
      author_handle STRING,
      source_repo STRING,
      version STRING,
      license STRING,
      is_official BOOL,
      is_featured BOOL,
      downloads INT8,
      stars INT8,
      raw_manifest JSONB,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_flows_provider ON flows (provider);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_kind ON flows (kind);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_category ON flows (category);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_downloads ON flows (downloads DESC);`;
}

/**
 * 2. High-Throughput Upsert for Scraped Skills & Flows
 */
export async function upsertFlow(item: CockroachFlowRecord): Promise<void> {
  await sql`
    INSERT INTO flows (
      id, slug, name, provider, kind, family, category, topics, summary,
      prompt_content, author_handle, source_repo, version, license,
      is_official, is_featured, downloads, stars, raw_manifest,
      created_at, updated_at
    ) VALUES (
      ${item.id},
      ${item.slug},
      ${item.name},
      ${item.provider ?? "clawhub"},
      ${item.kind ?? "skill"},
      ${item.family ?? "community"},
      ${item.category ?? "other"},
      ${item.topics ?? []},
      ${item.summary ?? null},
      ${item.prompt_content ?? null},
      ${item.author_handle ?? null},
      ${item.source_repo ?? null},
      ${item.version ?? "1.0.0"},
      ${item.license ?? "MIT"},
      ${item.is_official ?? false},
      ${item.is_featured ?? false},
      ${sql.json((item.raw_manifest ?? {}) as postgres.JSONValue)},
      clock_timestamp()
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      provider = EXCLUDED.provider,
      summary = EXCLUDED.summary,
      prompt_content = EXCLUDED.prompt_content,
      category = EXCLUDED.category,
      topics = EXCLUDED.topics,
      author_handle = EXCLUDED.author_handle,
      source_repo = EXCLUDED.source_repo,
      version = EXCLUDED.version,
      downloads = EXCLUDED.downloads,
      stars = EXCLUDED.stars,
      raw_manifest = EXCLUDED.raw_manifest,
      updated_at = clock_timestamp();
  `;
}

/**
 * 3. Batch Upsert for Scrapers
 */
export async function batchUpsertFlows(items: CockroachFlowRecord[]): Promise<number> {
  if (items.length === 0) return 0;
  for (const item of items) {
    await upsertFlow(item);
  }
  return items.length;
}

/**
 * 4. Query Flows & Skills with Filters
 */
export async function queryFlows(options: {
  provider?: string;
  kind?: string;
  category?: string;
  search?: string;
  limit?: number;
}): Promise<CockroachFlowRecord[]> {
  const { provider, kind, category, search, limit = 50 } = options;

  const results = await sql<CockroachFlowRecord[]>`
    SELECT
      id, slug, name, provider, kind, family, category, topics,
      summary, author_handle, source_repo, version, license,
      is_official, is_featured, downloads, stars
    FROM flows
    WHERE 1=1
      ${provider ? sql`AND provider = ${provider}` : sql``}
      ${kind ? sql`AND kind = ${kind}` : sql``}
      ${category ? sql`AND category = ${category}` : sql``}
      ${search ? sql`AND (name ILIKE ${`%${search}%`} OR summary ILIKE ${`%${search}%`})` : sql``}
    ORDER BY downloads DESC
    LIMIT ${limit};
  `;

  return results;
}
