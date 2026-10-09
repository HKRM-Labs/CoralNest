import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
  idle_timeout: 30,
});

interface ClawHubPluginItem {
  name: string;
  displayName?: string;
  summary?: string;
  categories?: string[];
  channel?: string;
  family?: string;
  icon?: string;
  isOfficial?: boolean;
  latestVersion?: string;
  ownerHandle?: string;
  runtimeId?: string;
  stats?: {
    downloads?: number;
    installs?: number;
    stars?: number;
    versions?: number;
  };
  topics?: string[];
  verificationTier?: string;
}

interface ClawHubPluginResponse {
  items?: ClawHubPluginItem[];
  nextCursor?: string | null;
  totalCount?: number;
}

async function scrapeAllClawHubPlugins(): Promise<ClawHubPluginItem[]> {
  console.log(
    "🌐 Initiating deep pagination across all ClawHub Plugins (https://clawhub.ai/plugins)...",
  );

  const allPlugins: ClawHubPluginItem[] = [];
  let cursor: string | null = null;
  let page = 1;

  while (true) {
    const url = cursor
      ? `https://clawhub.ai/api/v1/plugins?limit=100&cursor=${encodeURIComponent(cursor)}`
      : "https://clawhub.ai/api/v1/plugins?limit=100";

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "CoralNest-PluginHarvester/1.0" },
      });

      if (!res.ok) {
        console.warn(`⚠️ Page ${page} returned HTTP ${res.status}`);
        break;
      }

      const data = (await res.json()) as ClawHubPluginResponse;
      const items = data.items ?? [];

      if (items.length === 0) break;

      allPlugins.push(...items);
      console.log(
        `   ⚡ Page ${page}: fetched ${items.length} plugins (Total collected: ${allPlugins.length}/${data.totalCount ?? "?"})...`,
      );

      if (!data.nextCursor || data.nextCursor === cursor) {
        break;
      }

      cursor = data.nextCursor;
      page++;
    } catch (error) {
      console.error(`❌ Error fetching plugins on page ${page}:`, error);
      break;
    }
  }

  console.log(`\n✅ Extracted ${allPlugins.length} total plugins from ClawHub!`);
  return allPlugins;
}

async function main() {
  console.log("==================================================================");
  console.log("🧩 ClawHub 1.7k Plugins Harvester -> CockroachDB Serverless");
  console.log("==================================================================");

  const startTime = Date.now();

  try {
    const rawPlugins = await scrapeAllClawHubPlugins();

    // Deduplicate in memory by slug
    const pluginMap = new Map<string, ClawHubPluginItem>();
    for (const p of rawPlugins) {
      const rawSlug = (p.runtimeId || p.name)
        .replace(/^@/, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .toLowerCase();
      const slug = `clawhub-plugin-${rawSlug}`;
      pluginMap.set(slug, p);
    }

    const uniquePlugins = Array.from(pluginMap.entries());
    console.log(`\n💾 Upserting ${uniquePlugins.length} deduplicated plugins into CockroachDB...`);

    const BATCH_SIZE = 50;
    let saved = 0;

    for (let i = 0; i < uniquePlugins.length; i += BATCH_SIZE) {
      const batch = uniquePlugins.slice(i, i + BATCH_SIZE);

      for (const [slug, p] of batch) {
        const name = p.displayName || p.name.replace(/^@openclaw\//, "");
        const category = p.categories?.[0] || "productivity";
        const author = p.ownerHandle || "openclaw";
        const version = p.latestVersion || "1.0.0";
        const description = p.summary || `OpenClaw plugin for ${name}.`;
        const downloads = p.stats?.downloads ?? p.stats?.installs ?? 100;
        const stars = p.stats?.stars ?? 0;
        const isOfficial = Boolean(p.isOfficial);

        const manifest = {
          provider: "clawhub",
          name: p.name,
          displayName: p.displayName,
          runtimeId: p.runtimeId,
          family: p.family,
          channel: p.channel,
          icon: p.icon,
          topics: p.topics ?? [],
          verificationTier: p.verificationTier,
          stats: p.stats,
        };

        const tools = [
          { name: `${p.runtimeId || "tool"}_execute`, description: description },
          {
            name: `${p.runtimeId || "tool"}_status`,
            description: `Check runtime status for ${name}`,
          },
        ];

        const openapiSpec = {
          openapi: "3.1.0",
          info: { title: `${name} Plugin API`, version: version },
          paths: {
            [`/api/v1/plugins/${p.runtimeId || "runtime"}/action`]: {
              post: { summary: description, operationId: `${p.runtimeId}_action` },
            },
          },
        };

        await sql`
          INSERT INTO plugins (
            id, slug, name, description, category, author_handle,
            version, manifest, openapi_spec, auth_type, tools,
            is_official, stars, downloads, created_at, updated_at
          ) VALUES (
            ${`clawhub:plugin:${p.runtimeId || slug}`},
            ${slug},
            ${name},
            ${description},
            ${category},
            ${author},
            ${version},
            ${sql.json(manifest as postgres.JSONValue)},
            ${sql.json(openapiSpec as postgres.JSONValue)},
            ${"none"},
            ${sql.json(tools as postgres.JSONValue)},
            ${isOfficial},
            ${stars},
            ${downloads},
            now(),
            now()
          )
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            author_handle = EXCLUDED.author_handle,
            version = EXCLUDED.version,
            manifest = EXCLUDED.manifest,
            openapi_spec = EXCLUDED.openapi_spec,
            tools = EXCLUDED.tools,
            is_official = EXCLUDED.is_official,
            stars = EXCLUDED.stars,
            downloads = EXCLUDED.downloads,
            updated_at = now();
        `;
      }

      saved += batch.length;
      process.stdout.write(`   ⚡ Ingested: ${saved}/${uniquePlugins.length} plugins...\r`);
    }

    console.log(`\n\n🎉 ALL ${saved} CLAWHUB PLUGINS SAVED WITH ZERO REDUNDANCY!`);

    const [stats] = await sql`
      SELECT 
        count(*) as total_plugins,
        count(DISTINCT slug) as unique_slugs,
        count(*) FILTER (WHERE is_official = true) as official_count
      FROM plugins;
    `;

    console.log("==================================================================");
    console.log("📊 PLUGINS TABLE SUMMARY:");
    console.log(`• Total Plugins in Database:   ${stats.total_plugins}`);
    console.log(`• Unique Slugs (No Duplicates): ${stats.unique_slugs}`);
    console.log(`• Official Verified Plugins:   ${stats.official_count}`);
    console.log(`• Elapsed Time:                ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log("==================================================================");
  } catch (error) {
    console.error("❌ Fatal plugin scraper error:", error);
  } finally {
    await sql.end();
  }
}

void main();
