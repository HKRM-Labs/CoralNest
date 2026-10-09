import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function main() {
  console.log("Creating base table and columns...");

  await sql`CREATE TABLE IF NOT EXISTS flows (id STRING PRIMARY KEY);`;

  const columns = [
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS slug STRING UNIQUE;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS name STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS provider STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS kind STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS "family" STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS category STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS topics STRING[];`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS summary STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS prompt_content STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS author_handle STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS source_repo STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS version STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS license STRING;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS is_official BOOL;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS is_featured BOOL;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS downloads INT8;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS stars INT8;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS raw_manifest JSONB;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`,
    sql`ALTER TABLE flows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`,
  ];

  for (const col of columns) {
    await col;
  }
  console.log("✅ All columns created successfully in CockroachDB!");

  await sql`CREATE INDEX IF NOT EXISTS idx_flows_provider ON flows (provider);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_kind ON flows (kind);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_category ON flows (category);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flows_downloads ON flows (downloads DESC);`;
  console.log("✅ All indexes created successfully in CockroachDB!");

  await sql.end();
}

void main();
