import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("🚀 Initializing CockroachDB tables for MCP Servers, Plugins, and Connectors...");

  // 1. MCP Servers Table
  await sql`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id STRING PRIMARY KEY,
      slug STRING UNIQUE NOT NULL,
      name STRING NOT NULL,
      description STRING,
      category STRING DEFAULT 'tools',
      transport STRING DEFAULT 'stdio',
      command STRING,
      args STRING[],
      env_vars JSONB,
      tools JSONB,
      resources JSONB,
      prompts JSONB,
      author_handle STRING DEFAULT 'community',
      source_repo STRING,
      stars INT DEFAULT 0,
      downloads INT DEFAULT 0,
      is_verified BOOL DEFAULT false,
      raw_config JSONB,
      created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
      updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
    );
  `;
  console.log("✅ Table `mcp_servers` ready!");

  // 2. Plugins Table
  await sql`
    CREATE TABLE IF NOT EXISTS plugins (
      id STRING PRIMARY KEY,
      slug STRING UNIQUE NOT NULL,
      name STRING NOT NULL,
      description STRING,
      category STRING DEFAULT 'productivity',
      author_handle STRING DEFAULT 'community',
      version STRING DEFAULT '1.0.0',
      manifest JSONB,
      openapi_spec JSONB,
      auth_type STRING DEFAULT 'none',
      tools JSONB,
      is_official BOOL DEFAULT false,
      stars INT DEFAULT 0,
      downloads INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
      updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
    );
  `;
  console.log("✅ Table `plugins` ready!");

  // 3. Connectors Table (Composio & Integration Toolkits)
  await sql`
    CREATE TABLE IF NOT EXISTS connectors (
      id STRING PRIMARY KEY,
      slug STRING UNIQUE NOT NULL,
      name STRING NOT NULL,
      description STRING,
      category STRING DEFAULT 'saas',
      provider STRING DEFAULT 'composio',
      auth_type STRING DEFAULT 'oauth2',
      actions_count INT DEFAULT 0,
      triggers_count INT DEFAULT 0,
      actions_schema JSONB,
      triggers_schema JSONB,
      icon_url STRING,
      doc_url STRING,
      is_popular BOOL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
      updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
    );
  `;
  console.log("✅ Table `connectors` ready!");

  // Query existing tables
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;

  console.log("\n📊 ALL TABLES IN COCKROACHDB:");
  for (const t of tables) {
    console.log(`   • ${t.table_name}`);
  }

  await sql.end();
}

void main();
