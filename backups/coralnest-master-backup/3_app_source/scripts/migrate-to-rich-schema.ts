import postgres from "postgres";

const DATABASE_URL =
  process.env.COCKROACH_DATABASE_URL ??
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 3 });

async function main() {
  console.log("================================================================");
  console.log("🪸 CORALNEST — RICH SCHEMA MIGRATION");
  console.log("================================================================");

  // ── Drop existing tables completely so we can recreate with new schema ─────
  console.log("\n1. Dropping all tables for full clean rebuild...");
  const ALL_TABLES = [
    "flow_skills",
    "flow_loops",
    "flow_graphs",
    "skills",
    "loops",
    "graphs",
    "mcp_servers",
    "connectors",
    "plugins",
  ];
  for (const t of ALL_TABLES) {
    try {
      await sql`DROP TABLE IF EXISTS ${sql(t)} CASCADE`;
      console.log(`   ✅ Dropped ${t}`);
    } catch {
      // ignore
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TABLE: skills
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n4. Creating skills table...");
  await sql`
    CREATE TABLE skills (
      id                  STRING PRIMARY KEY,
      slug                STRING UNIQUE NOT NULL,
      name                STRING NOT NULL,

      -- Source metadata
      source              STRING NOT NULL DEFAULT 'unknown',   -- 'clawhub', 'skillsh', 'github', 'custom'
      source_id           STRING,
      source_ref          STRING,                               -- 'public-github', 'public-clawhub'
      external_url        STRING,
      source_repo         STRING,
      source_path         STRING,
      source_commit       STRING,

      -- Publisher & trust
      publisher           STRING NOT NULL DEFAULT 'community',
      publisher_trust     STRING NOT NULL DEFAULT 'community', -- 'official', 'verified', 'community'
      integrity           STRING,                               -- sha256 of package tarball

      -- Classification
      category            STRING NOT NULL DEFAULT 'general',   -- 'development', 'security', 'research', 'data', 'media', 'finance', 'ops'
      subcategory         STRING,
      tags                STRING[] DEFAULT ARRAY[]::STRING[],
      language            STRING[] DEFAULT ARRAY[]::STRING[], -- 'typescript', 'python', 'go'
      compatibility       STRING[] DEFAULT ARRAY[]::STRING[], -- 'langchain', 'langgraph', 'autogen', 'crewai', 'openai', 'any'
      difficulty          STRING NOT NULL DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'advanced'
      use_cases           STRING[] DEFAULT ARRAY[]::STRING[],

      -- Content
      summary             STRING NOT NULL DEFAULT '',
      version             STRING,
      license             STRING,
      icon_url            STRING,
      readme_url          STRING,

      -- Quality & scoring
      quality_score       INT2 NOT NULL DEFAULT 0,            -- 0-100 auto-computed
      security_score      INT2 NOT NULL DEFAULT 50,           -- 0-100 (50 = unreviewed)
      popularity_score    INT2 NOT NULL DEFAULT 0,            -- 0-100 composite
      is_general_purpose  BOOL NOT NULL DEFAULT true,
      is_verified         BOOL NOT NULL DEFAULT false,
      is_featured         BOOL NOT NULL DEFAULT false,
      is_official         BOOL NOT NULL DEFAULT false,
      is_deprecated       BOOL NOT NULL DEFAULT false,
      is_archived         BOOL NOT NULL DEFAULT false,

      -- Stats
      downloads           INT8 NOT NULL DEFAULT 0,
      stars               INT8 NOT NULL DEFAULT 0,
      forks               INT8 NOT NULL DEFAULT 0,

      -- Storage (B2)
      storage_path        STRING,
      storage_url         STRING,
      content_hash        STRING,
      file_size_bytes     INT8,

      -- Timestamps
      last_synced_at      TIMESTAMPTZ DEFAULT clock_timestamp(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )
  `;
  await sql`CREATE INDEX ON skills (source)`;
  await sql`CREATE INDEX ON skills (publisher)`;
  await sql`CREATE INDEX ON skills (publisher_trust)`;
  await sql`CREATE INDEX ON skills (category)`;
  await sql`CREATE INDEX ON skills (difficulty)`;
  await sql`CREATE INDEX ON skills (quality_score DESC)`;
  await sql`CREATE INDEX ON skills (downloads DESC)`;
  await sql`CREATE INDEX ON skills (stars DESC)`;
  await sql`CREATE INDEX ON skills (is_featured) WHERE is_featured = true`;
  await sql`CREATE INDEX ON skills (is_official) WHERE is_official = true`;
  await sql`CREATE INVERTED INDEX ON skills (tags)`;
  await sql`CREATE INVERTED INDEX ON skills (compatibility)`;
  console.log("   ✅ skills table created");

  // ─────────────────────────────────────────────────────────────────────────────
  // TABLE: loops
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n5. Creating loops table...");
  await sql`
    CREATE TABLE loops (
      id                  STRING PRIMARY KEY,
      slug                STRING UNIQUE NOT NULL,
      name                STRING NOT NULL,

      -- Source
      source              STRING NOT NULL DEFAULT 'custom',   -- 'forwardfuture', 'github', 'custom'
      source_id           STRING,
      external_url        STRING,

      -- Loop mechanics
      loop_kind           STRING NOT NULL DEFAULT 'feedback-loop', -- 'feedback-loop', 'step-verifier', 'eval-loop', 'optimization-loop'
      max_iterations      INT4 NOT NULL DEFAULT 10,
      exit_criteria       STRING NOT NULL DEFAULT '',
      step_count          INT4 NOT NULL DEFAULT 1,
      convergence_strategy STRING,                            -- 'threshold', 'consensus', 'oracle', 'timeout'

      -- Classification
      category            STRING NOT NULL DEFAULT 'engineering', -- 'engineering', 'evaluation', 'operations', 'research', 'security'
      subcategory         STRING,
      tags                STRING[] DEFAULT ARRAY[]::STRING[],
      compatibility       STRING[] DEFAULT ARRAY[]::STRING[],
      use_cases           STRING[] DEFAULT ARRAY[]::STRING[],
      difficulty          STRING NOT NULL DEFAULT 'intermediate',

      -- Content
      summary             STRING NOT NULL DEFAULT '',
      author              STRING NOT NULL DEFAULT 'community',
      license             STRING,

      -- Quality
      quality_score       INT2 NOT NULL DEFAULT 0,
      security_score      INT2 NOT NULL DEFAULT 50,
      is_verified         BOOL NOT NULL DEFAULT false,
      is_featured         BOOL NOT NULL DEFAULT false,
      is_deprecated       BOOL NOT NULL DEFAULT false,

      -- Stats
      downloads           INT8 NOT NULL DEFAULT 0,
      stars               INT8 NOT NULL DEFAULT 0,

      -- Storage (B2)
      storage_path        STRING,
      storage_url         STRING,
      content_hash        STRING,
      file_size_bytes     INT8,

      last_synced_at      TIMESTAMPTZ DEFAULT clock_timestamp(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )
  `;
  await sql`CREATE INDEX ON loops (loop_kind)`;
  await sql`CREATE INDEX ON loops (category)`;
  await sql`CREATE INDEX ON loops (quality_score DESC)`;
  await sql`CREATE INVERTED INDEX ON loops (tags)`;
  console.log("   ✅ loops table created");

  // ─────────────────────────────────────────────────────────────────────────────
  // TABLE: graphs
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n6. Creating graphs table...");
  await sql`
    CREATE TABLE graphs (
      id                  STRING PRIMARY KEY,
      slug                STRING UNIQUE NOT NULL,
      name                STRING NOT NULL,

      -- Source
      source              STRING NOT NULL DEFAULT 'custom',  -- 'langgraph', 'crewai', 'autogen', 'custom'
      source_id           STRING,
      external_url        STRING,
      source_repo         STRING,

      -- Graph topology
      graph_type          STRING NOT NULL DEFAULT 'dag',     -- 'dag', 'state-machine', 'router', 'pipeline', 'cyclic'
      entry_node          STRING,
      node_count          INT4 NOT NULL DEFAULT 0,
      edge_count          INT4 NOT NULL DEFAULT 0,
      framework           STRING NOT NULL DEFAULT 'custom',  -- 'langgraph', 'autogen', 'crewai', 'custom'
      supports_streaming  BOOL NOT NULL DEFAULT false,
      supports_human_in_loop BOOL NOT NULL DEFAULT false,

      -- Classification
      category            STRING NOT NULL DEFAULT 'agents',
      subcategory         STRING,
      tags                STRING[] DEFAULT ARRAY[]::STRING[],
      compatibility       STRING[] DEFAULT ARRAY[]::STRING[],
      use_cases           STRING[] DEFAULT ARRAY[]::STRING[],
      difficulty          STRING NOT NULL DEFAULT 'advanced',

      -- Content
      summary             STRING NOT NULL DEFAULT '',
      author              STRING NOT NULL DEFAULT 'community',
      license             STRING,
      icon_url            STRING,

      -- Quality
      quality_score       INT2 NOT NULL DEFAULT 0,
      security_score      INT2 NOT NULL DEFAULT 50,
      is_verified         BOOL NOT NULL DEFAULT false,
      is_featured         BOOL NOT NULL DEFAULT false,
      is_deprecated       BOOL NOT NULL DEFAULT false,

      -- Stats
      downloads           INT8 NOT NULL DEFAULT 0,
      stars               INT8 NOT NULL DEFAULT 0,

      -- Storage (B2)
      storage_path        STRING,
      storage_url         STRING,
      content_hash        STRING,
      file_size_bytes     INT8,

      last_synced_at      TIMESTAMPTZ DEFAULT clock_timestamp(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )
  `;
  await sql`CREATE INDEX ON graphs (graph_type)`;
  await sql`CREATE INDEX ON graphs (framework)`;
  await sql`CREATE INDEX ON graphs (category)`;
  await sql`CREATE INDEX ON graphs (quality_score DESC)`;
  await sql`CREATE INVERTED INDEX ON graphs (tags)`;
  console.log("   ✅ graphs table created");

  // ─────────────────────────────────────────────────────────────────────────────
  // TABLE: mcp_servers
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n7. Creating mcp_servers table...");
  await sql`
    CREATE TABLE mcp_servers (
      id                  STRING PRIMARY KEY,
      slug                STRING UNIQUE NOT NULL,
      name                STRING NOT NULL,

      -- Source
      source              STRING NOT NULL DEFAULT 'unknown', -- 'glama', 'mcpservers-org', 'smithery', 'github', 'custom'
      source_id           STRING,
      external_url        STRING,
      repo_url            STRING,
      namespace           STRING,                            -- GitHub org/user

      -- MCP Protocol
      transport           STRING NOT NULL DEFAULT 'stdio',   -- 'stdio', 'http', 'sse', 'websocket'
      hosting             STRING NOT NULL DEFAULT 'local-only', -- 'local-only', 'remote-capable', 'hybrid'
      command             STRING,                            -- "npx -y @modelcontextprotocol/server-github"
      npm_package         STRING,
      pypi_package        STRING,
      docker_image        STRING,

      -- Tools
      tools_count         INT4 NOT NULL DEFAULT 0,
      requires_auth       BOOL NOT NULL DEFAULT false,
      env_vars_count      INT4 NOT NULL DEFAULT 0,          -- how many env vars needed

      -- Classification
      category            STRING NOT NULL DEFAULT 'general', -- 'database', 'filesystem', 'web', 'communication', 'development', 'ai', 'productivity'
      subcategory         STRING,
      tags                STRING[] DEFAULT ARRAY[]::STRING[],
      compatibility       STRING[] DEFAULT ARRAY[]::STRING[],
      use_cases           STRING[] DEFAULT ARRAY[]::STRING[],

      -- Content
      summary             STRING NOT NULL DEFAULT '',
      license             STRING,
      icon_url            STRING,

      -- Quality
      quality_score       INT2 NOT NULL DEFAULT 0,
      security_score      INT2 NOT NULL DEFAULT 50,
      is_verified         BOOL NOT NULL DEFAULT false,
      is_featured         BOOL NOT NULL DEFAULT false,
      is_official         BOOL NOT NULL DEFAULT false,
      is_deprecated       BOOL NOT NULL DEFAULT false,
      is_archived         BOOL NOT NULL DEFAULT false,

      -- Stats
      downloads           INT8 NOT NULL DEFAULT 0,
      stars               INT8 NOT NULL DEFAULT 0,
      forks               INT8 NOT NULL DEFAULT 0,

      -- Storage (B2) — stores full mcp-server.json with tools & env schema
      storage_path        STRING,
      storage_url         STRING,
      content_hash        STRING,
      file_size_bytes     INT8,

      last_synced_at      TIMESTAMPTZ DEFAULT clock_timestamp(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )
  `;
  await sql`CREATE INDEX ON mcp_servers (source)`;
  await sql`CREATE INDEX ON mcp_servers (transport)`;
  await sql`CREATE INDEX ON mcp_servers (hosting)`;
  await sql`CREATE INDEX ON mcp_servers (category)`;
  await sql`CREATE INDEX ON mcp_servers (requires_auth)`;
  await sql`CREATE INDEX ON mcp_servers (quality_score DESC)`;
  await sql`CREATE INDEX ON mcp_servers (downloads DESC)`;
  await sql`CREATE INDEX ON mcp_servers (is_featured) WHERE is_featured = true`;
  await sql`CREATE INVERTED INDEX ON mcp_servers (tags)`;
  console.log("   ✅ mcp_servers table created");

  // ─────────────────────────────────────────────────────────────────────────────
  // TABLE: connectors
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n8. Creating connectors table...");
  await sql`
    CREATE TABLE connectors (
      id                  STRING PRIMARY KEY,
      slug                STRING UNIQUE NOT NULL,
      name                STRING NOT NULL,

      -- Source
      source              STRING NOT NULL DEFAULT 'composio',  -- 'composio', 'zapier', 'make', 'glama', 'custom'
      source_id           STRING,
      external_url        STRING,

      -- Connector details
      provider            STRING NOT NULL DEFAULT 'composio',
      auth_type           STRING NOT NULL DEFAULT 'oauth2',    -- 'oauth2', 'api_key', 'bearer', 'basic', 'none'
      actions_count       INT4 NOT NULL DEFAULT 0,
      webhooks_count      INT4 NOT NULL DEFAULT 0,
      triggers_count      INT4 NOT NULL DEFAULT 0,

      -- Classification
      category            STRING NOT NULL DEFAULT 'productivity', -- 'crm', 'productivity', 'devops', 'finance', 'communication', 'database', 'ai', 'ecommerce', 'marketing'
      subcategory         STRING,
      tags                STRING[] DEFAULT ARRAY[]::STRING[],
      use_cases           STRING[] DEFAULT ARRAY[]::STRING[],

      -- Content
      summary             STRING NOT NULL DEFAULT '',
      logo_url            STRING,
      docs_url            STRING,

      -- Quality
      quality_score       INT2 NOT NULL DEFAULT 0,
      security_score      INT2 NOT NULL DEFAULT 50,
      is_verified         BOOL NOT NULL DEFAULT false,
      is_featured         BOOL NOT NULL DEFAULT false,
      is_official         BOOL NOT NULL DEFAULT false,
      is_deprecated       BOOL NOT NULL DEFAULT false,

      -- Stats
      downloads           INT8 NOT NULL DEFAULT 0,
      stars               INT8 NOT NULL DEFAULT 0,

      -- Storage (B2) — stores full openapi.json with all action schemas
      storage_path        STRING,
      storage_url         STRING,
      content_hash        STRING,
      file_size_bytes     INT8,

      last_synced_at      TIMESTAMPTZ DEFAULT clock_timestamp(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )
  `;
  await sql`CREATE INDEX ON connectors (source)`;
  await sql`CREATE INDEX ON connectors (provider)`;
  await sql`CREATE INDEX ON connectors (category)`;
  await sql`CREATE INDEX ON connectors (auth_type)`;
  await sql`CREATE INDEX ON connectors (quality_score DESC)`;
  await sql`CREATE INDEX ON connectors (is_featured) WHERE is_featured = true`;
  await sql`CREATE INVERTED INDEX ON connectors (tags)`;
  console.log("   ✅ connectors table created");

  // ─────────────────────────────────────────────────────────────────────────────
  // TABLE: plugins
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n9. Creating plugins table...");
  await sql`
    CREATE TABLE plugins (
      id                  STRING PRIMARY KEY,
      slug                STRING UNIQUE NOT NULL,
      name                STRING NOT NULL,

      -- Source
      source              STRING NOT NULL DEFAULT 'clawhub',   -- 'clawhub', 'openai', 'custom'
      source_id           STRING,
      external_url        STRING,

      -- Publisher & trust
      publisher           STRING NOT NULL DEFAULT 'community',
      publisher_trust     STRING NOT NULL DEFAULT 'community', -- 'official', 'verified', 'community'
      integrity           STRING,                               -- sha256 of package tarball

      -- Plugin details
      version             STRING NOT NULL DEFAULT '1.0.0',
      category            STRING NOT NULL DEFAULT 'tool',      -- 'channel', 'provider', 'memory', 'tool', 'runtime', 'search', 'speech', 'vision'
      subcategory         STRING,
      tags                STRING[] DEFAULT ARRAY[]::STRING[],
      compatibility       STRING[] DEFAULT ARRAY[]::STRING[], -- 'openclaw', 'openai', 'anthropic', 'any'
      use_cases           STRING[] DEFAULT ARRAY[]::STRING[],

      -- Content
      summary             STRING NOT NULL DEFAULT '',
      license             STRING,
      icon_url            STRING,
      docs_url            STRING,
      repo_url            STRING,

      -- Quality
      quality_score       INT2 NOT NULL DEFAULT 0,
      security_score      INT2 NOT NULL DEFAULT 50,
      is_verified         BOOL NOT NULL DEFAULT false,
      is_featured         BOOL NOT NULL DEFAULT false,
      is_official         BOOL NOT NULL DEFAULT false,
      is_deprecated       BOOL NOT NULL DEFAULT false,

      -- Stats
      downloads           INT8 NOT NULL DEFAULT 0,
      stars               INT8 NOT NULL DEFAULT 0,

      -- Storage (B2)
      storage_path        STRING,
      storage_url         STRING,
      content_hash        STRING,
      file_size_bytes     INT8,

      last_synced_at      TIMESTAMPTZ DEFAULT clock_timestamp(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )
  `;
  await sql`CREATE INDEX ON plugins (source)`;
  await sql`CREATE INDEX ON plugins (publisher)`;
  await sql`CREATE INDEX ON plugins (publisher_trust)`;
  await sql`CREATE INDEX ON plugins (category)`;
  await sql`CREATE INDEX ON plugins (quality_score DESC)`;
  await sql`CREATE INDEX ON plugins (downloads DESC)`;
  await sql`CREATE INDEX ON plugins (is_featured) WHERE is_featured = true`;
  await sql`CREATE INDEX ON plugins (is_official) WHERE is_official = true`;
  await sql`CREATE INVERTED INDEX ON plugins (tags)`;
  console.log("   ✅ plugins table created");

  // ── Verify ─────────────────────────────────────────────────────────────────
  console.log("\n10. Verifying all 6 tables...");
  const tables = ["skills", "loops", "graphs", "mcp_servers", "connectors", "plugins"];
  for (const t of tables) {
    const r = await sql`SELECT count(*) AS c FROM ${sql(t)}`;
    console.log(`    ✅ ${t.padEnd(14)}: ${r[0].c} rows (schema ready)`);
  }

  console.log("\n================================================================");
  console.log("🎉 RICH SCHEMA MIGRATION COMPLETE!");
  console.log("   All 6 tables rebuilt with full metadata fields.");
  console.log("   Quality score, security score, compatibility, use_cases,");
  console.log("   difficulty, license, icon_url, language, tags all ready.");
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
