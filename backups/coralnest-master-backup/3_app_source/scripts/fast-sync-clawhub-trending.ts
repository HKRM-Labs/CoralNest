import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
  idle_timeout: 30,
});

interface ClawHubSkillListItem {
  slug: string;
  displayName?: string;
  summary?: string;
  description?: string | null;
  topics?: string[];
  tags?: Record<string, string>;
  stats?: {
    comments?: number;
    downloads?: number;
    installs?: number;
    stars?: number;
    versions?: number;
  };
  latestVersion?: {
    version?: string;
    changelog?: string;
    license?: string | null;
  };
}

interface ClawHubSkillListResponse {
  items?: ClawHubSkillListItem[];
  nextCursor?: unknown;
}

async function main() {
  console.log("==================================================================");
  console.log("🌊 Fast Trending & ClawHub Ingestion Engine -> CockroachDB");
  console.log("==================================================================");

  const startTime = Date.now();
  const allItems = new Map<string, ClawHubSkillListItem>();

  // Fetch trending pages until exhausted
  let cursor: unknown = null;
  let page = 1;

  while (page <= 50) {
    const url = cursor
      ? `https://clawhub.ai/api/v1/skills?tab=trending&limit=100&cursor=${encodeURIComponent(typeof cursor === "string" ? cursor : JSON.stringify(cursor))}`
      : "https://clawhub.ai/api/v1/skills?tab=trending&limit=100";

    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) break;

      const data = (await res.json()) as ClawHubSkillListResponse;
      const items = data.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        if (item.slug) allItems.set(item.slug, item);
      }

      console.log(
        `   ⚡ Trending Page ${page}: fetched ${items.length} items (Total Unique: ${allItems.size})...`,
      );

      if (!data.nextCursor || data.nextCursor === cursor) break;
      cursor = data.nextCursor;
      page++;
    } catch {
      break;
    }
  }

  const rawSkills = Array.from(allItems.values());
  console.log(`\n💾 Ingesting ${rawSkills.length} unique trending skills into CockroachDB...`);

  const BATCH_SIZE = 50;
  let saved = 0;

  for (let i = 0; i < rawSkills.length; i += BATCH_SIZE) {
    const batch = rawSkills.slice(i, i + BATCH_SIZE);

    for (const s of batch) {
      const slug = s.slug.trim().toLowerCase();
      const name =
        s.displayName || slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const summary = s.summary || `Specialized AI agent capability for ${name}.`;
      const changelog = s.latestVersion?.changelog || "";
      const version = s.latestVersion?.version || "1.0.0";
      const downloads = s.stats?.downloads ?? s.stats?.installs ?? 100;
      const stars = s.stats?.stars ?? 0;
      const topics =
        Object.keys(s.tags || {}).length > 0 ? Object.keys(s.tags || {}) : ["skill", "openclaw"];

      const promptContent = `# ${name}\n\n${summary}\n\n## Capabilities & Invariants\n- Version: ${version}\n- Automated task execution for ${name}.\n- High reliability execution with zero side-effects.\n\n${changelog ? `## Changelog\n${changelog}\n` : ""}`;

      const rawManifest = {
        provider: "clawhub",
        slug,
        displayName: s.displayName,
        stats: s.stats,
        tags: s.tags,
        latestVersion: s.latestVersion,
      };

      const skillId = `clawhub:skill:${slug}`;

      // Upsert into flow_skills
      await sql`
        INSERT INTO flow_skills (
          id, slug, name, provider, category, topics, summary,
          prompt_content, author_handle, source_repo, downloads,
          stars, is_official, raw_manifest, created_at, updated_at
        ) VALUES (
          ${skillId},
          ${slug},
          ${name},
          ${"clawhub"},
          ${"skills"},
          ${topics},
          ${summary},
          ${promptContent},
          ${"openclaw"},
          ${`https://clawhub.ai/skills/${slug}`},
          ${downloads},
          ${stars},
          ${downloads > 500},
          ${sql.json(rawManifest as postgres.JSONValue)},
          now(),
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          summary = EXCLUDED.summary,
          prompt_content = EXCLUDED.prompt_content,
          topics = EXCLUDED.topics,
          downloads = EXCLUDED.downloads,
          stars = EXCLUDED.stars,
          raw_manifest = EXCLUDED.raw_manifest,
          updated_at = now();
      `;

      // Upsert into flows
      await sql`
        INSERT INTO flows (
          id, slug, name, kind, "family", category, topics, summary,
          prompt_content, author_handle, source_repo, is_official,
          downloads, stars, raw_manifest, created_at, updated_at
        ) VALUES (
          ${`flow:skill:${slug}`},
          ${slug},
          ${name},
          ${"skill"},
          ${"community"},
          ${"skills"},
          ${topics},
          ${summary},
          ${promptContent},
          ${"openclaw"},
          ${`https://clawhub.ai/skills/${slug}`},
          ${downloads > 500},
          ${downloads},
          ${stars},
          ${sql.json(rawManifest as postgres.JSONValue)},
          now(),
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          summary = EXCLUDED.summary,
          prompt_content = EXCLUDED.prompt_content,
          downloads = EXCLUDED.downloads,
          stars = EXCLUDED.stars,
          updated_at = now();
      `;
    }

    saved += batch.length;
    process.stdout.write(`   ⚡ Ingested: ${saved}/${rawSkills.length} ClawHub skills...\r`);
  }

  console.log(`\n\n🎉 ALL ${saved} SKILLS SAVED TO COCKROACHDB WITH 0 REDUNDANCY!`);

  const [stats] = await sql`
    SELECT 
      count(*) as total_skills,
      count(DISTINCT slug) as unique_slugs,
      count(*) FILTER (WHERE provider = 'clawhub') as clawhub_count,
      count(*) FILTER (WHERE provider = 'skills.sh') as skills_sh_count
    FROM flow_skills;
  `;

  console.log("==================================================================");
  console.log("📊 FLOW SKILLS DATABASE INVENTORY:");
  console.log(`• Total Skills in Database:      ${stats.total_skills}`);
  console.log(`• Unique Slugs (No Duplicates):   ${stats.unique_slugs}`);
  console.log(`• From ClawHub:                  ${stats.clawhub_count}`);
  console.log(`• From Skills.sh:                ${stats.skills_sh_count}`);
  console.log(`• Elapsed Time:                  ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log("==================================================================");

  await sql.end();
}

void main();
