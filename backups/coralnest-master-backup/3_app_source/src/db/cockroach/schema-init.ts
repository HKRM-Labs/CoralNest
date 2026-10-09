import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

export const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 10,
});

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
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_flows_provider ON flows (provider)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_kind ON flows (kind)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_category ON flows (category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_downloads ON flows (downloads DESC)`;
}
