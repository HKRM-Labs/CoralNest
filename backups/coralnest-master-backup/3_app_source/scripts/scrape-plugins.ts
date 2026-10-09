import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
  idle_timeout: 30,
});

interface PluginRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  author_handle: string;
  version: string;
  manifest: Record<string, unknown>;
  openapi_spec: Record<string, unknown>;
  auth_type: string;
  tools: Array<{ name: string; description: string }>;
  is_official: boolean;
  stars: number;
  downloads: number;
}

const PLUGINS_REGISTRY: PluginRecord[] = [
  {
    id: "plugin:wolfram-alpha",
    slug: "wolfram-alpha-plugin",
    name: "Wolfram Alpha",
    description:
      "Access computation, math calculations, curated knowledgebase, and real-time scientific algorithms.",
    category: "computation",
    author_handle: "wolfram",
    version: "1.2.0",
    manifest: { schema_version: "v1", name_for_model: "wolfram_alpha" },
    openapi_spec: { openapi: "3.0.1", info: { title: "Wolfram Alpha API", version: "v1" } },
    auth_type: "api_key",
    tools: [
      { name: "evaluate_math", description: "Evaluates mathematical equations and calculus" },
      {
        name: "query_knowledge",
        description: "Queries curated scientific, geographical, and chemical facts",
      },
    ],
    is_official: true,
    stars: 8900,
    downloads: 520000,
  },
  {
    id: "plugin:zapier",
    slug: "zapier-plugin",
    name: "Zapier Actions",
    description:
      "Interact with over 6,000+ business applications to trigger automated zaps, webhooks, and multi-step data pipelines.",
    category: "automation",
    author_handle: "zapier",
    version: "2.1.0",
    manifest: { schema_version: "v1", name_for_model: "zapier_actions" },
    openapi_spec: { openapi: "3.0.1", info: { title: "Zapier Actions API", version: "v2" } },
    auth_type: "oauth2",
    tools: [
      { name: "list_actions", description: "Lists all available enabled Zapier user actions" },
      {
        name: "execute_action",
        description: "Runs an action with parameters across connected apps",
      },
    ],
    is_official: true,
    stars: 9400,
    downloads: 680000,
  },
  {
    id: "plugin:klarna",
    slug: "klarna-shopping-plugin",
    name: "Klarna Shopping",
    description:
      "Search and compare prices across thousands of online merchants, fetch product availability, and generate checkout links.",
    category: "ecommerce",
    author_handle: "klarna",
    version: "1.0.4",
    manifest: { schema_version: "v1", name_for_model: "klarna_shopping" },
    openapi_spec: { openapi: "3.0.1", info: { title: "Klarna Shopping API", version: "v1" } },
    auth_type: "none",
    tools: [
      {
        name: "search_products",
        description: "Search for products by query, price range, and category",
      },
    ],
    is_official: true,
    stars: 3100,
    downloads: 140000,
  },
  {
    id: "plugin:open-table",
    slug: "opentable-plugin",
    name: "OpenTable",
    description:
      "Restaurant recommendations, reservation availability checks, and direct dining booking across global cities.",
    category: "lifestyle",
    author_handle: "opentable",
    version: "1.1.0",
    manifest: { schema_version: "v1", name_for_model: "opentable" },
    openapi_spec: { openapi: "3.0.1", info: { title: "OpenTable API", version: "v1" } },
    auth_type: "none",
    tools: [
      {
        name: "find_restaurants",
        description: "Finds dining spots based on party size, date, time, and location",
      },
    ],
    is_official: true,
    stars: 2800,
    downloads: 110000,
  },
];

async function main() {
  console.log("==================================================================");
  console.log("🧩 AI Plugins Registry Harvester -> CockroachDB");
  console.log("==================================================================");

  let saved = 0;
  for (const p of PLUGINS_REGISTRY) {
    await sql`
      INSERT INTO plugins (
        id, slug, name, description, category, author_handle,
        version, manifest, openapi_spec, auth_type, tools,
        is_official, stars, downloads, created_at, updated_at
      ) VALUES (
        ${p.id},
        ${p.slug},
        ${p.name},
        ${p.description},
        ${p.category},
        ${p.author_handle},
        ${p.version},
        ${sql.json(p.manifest as postgres.JSONValue)},
        ${sql.json(p.openapi_spec as postgres.JSONValue)},
        ${p.auth_type},
        ${sql.json(p.tools as postgres.JSONValue)},
        ${p.is_official},
        ${p.stars},
        ${p.downloads},
        now(),
        now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        manifest = EXCLUDED.manifest,
        openapi_spec = EXCLUDED.openapi_spec,
        tools = EXCLUDED.tools,
        stars = EXCLUDED.stars,
        downloads = EXCLUDED.downloads,
        updated_at = now();
    `;
    saved++;
  }

  console.log(`✅ Ingested ${saved} verified Plugins into CockroachDB!`);

  const [total] = await sql`SELECT count(*) as count FROM plugins;`;
  console.log(`📊 Total Plugins in database: ${total.count}`);

  await sql.end();
}

void main();
