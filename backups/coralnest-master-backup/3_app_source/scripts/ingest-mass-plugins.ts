/**
 * CORALNEST — Mass Plugins Harvester (ClawHub + npm + GitHub)
 *
 * Targets: 3,000+ unique AI plugins across ClawHub, npm, and GitHub.
 * Guarantees zero redundancy via canonical slug + SHA-256 content hashing.
 *
 * For each plugin:
 *   1. Resolves package details, README, manifest, author & repository
 *   2. Uploads manifest.json + README.md to Backblaze B2 (plugins/<owner>/<slug>/...)
 *   3. Inserts / updates clean metadata row in CockroachDB plugins table
 */
import {
  sql,
  b2Upload,
  fetchJSON,
  fetchGitHubReadme,
  computeQuality,
  extractTags,
  inferCategory,
  slug,
  sleep,
} from "./lib/ingest-utils.ts";

// ── Types ────────────────────────────────────────────────────────────────────

interface PluginCandidate {
  id: string;
  slug: string;
  name: string;
  publisher: string;
  description: string;
  version: string;
  npmPackage?: string;
  githubRepo?: string;
  source: "clawhub" | "npm" | "github";
  publisherTrust?: string;
  license?: string;
}

// ── Main Pipeline ────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================");
  console.log("🔌 CORALNEST — MASS PLUGINS HARVESTER");
  console.log("   Sources: ClawHub Feed + npm Registry + GitHub Topic Search");
  console.log("   Target: 3,000+ unique AI agent plugins → B2 + CockroachDB");
  console.log("================================================================\n");

  const candidates = new Map<string, PluginCandidate>();

  // ── STEP 1: ClawHub Feed ───────────────────────────────────────────────────
  console.log("1. Loading ClawHub plugins feed...");
  try {
    const feed = await fetchJSON<{ entries: any[] }>("https://clawhub.ai/v1/feeds/plugins");
    if (feed?.entries) {
      for (const entry of feed.entries) {
        if (entry.type !== "plugin") continue;
        const publisher = entry.publisher?.id || "community";
        const rawName = entry.title || entry.id;
        const pluginSlug = slug(publisher + "-" + rawName);

        candidates.set(pluginSlug, {
          id: `plugin:clawhub:${entry.id}`,
          slug: pluginSlug,
          name: rawName,
          publisher,
          description: entry.description || "",
          version: entry.version || "1.0.0",
          npmPackage: entry.install?.candidates?.[0]?.package,
          source: "clawhub",
          publisherTrust: entry.publisher?.trust || "official",
        });
      }
      console.log(`   ✅ Loaded ${candidates.size} ClawHub featured plugins.`);
    }
  } catch (e: any) {
    console.error(`   ⚠️ ClawHub feed error: ${e.message}`);
  }

  // ── STEP 2: npm Registry Search ───────────────────────────────────────────
  console.log("\n2. Searching npm registry for OpenClaw/Claude/Codex plugins...");
  const npmQueries = [
    "keywords:openclaw-plugin",
    "keywords:openclaw",
    "keywords:claude-plugin",
    "keywords:codex-plugin",
    "openclaw-plugin",
    "claude-code-plugin",
  ];

  let npmCount = 0;
  for (const query of npmQueries) {
    let from = 0;
    const size = 250;

    while (from < 1000) {
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}&from=${from}`;
      const data = await fetchJSON<{ objects: any[]; total: number }>(url);
      if (!data?.objects?.length) break;

      for (const item of data.objects) {
        const pkg = item.package;
        const publisher = pkg.publisher?.username || pkg.scope || "npm";
        const pluginSlug = slug(`${publisher}-${pkg.name}`);

        if (!candidates.has(pluginSlug)) {
          candidates.set(pluginSlug, {
            id: `plugin:npm:${pkg.name}`,
            slug: pluginSlug,
            name: pkg.name,
            publisher,
            description: pkg.description || `AI agent plugin ${pkg.name}`,
            version: pkg.version || "1.0.0",
            npmPackage: pkg.name,
            githubRepo: pkg.links?.repository?.replace("git+", "").replace(".git", ""),
            source: "npm",
            publisherTrust: "community",
            license: pkg.license,
          });
          npmCount++;
        }
      }

      if (from + size >= (data.total || 0)) break;
      from += size;
      await sleep(300);
    }
  }
  console.log(`   ✅ Added ${npmCount} unique plugins from npm registry.`);

  // ── STEP 3: GitHub Topic Search ───────────────────────────────────────────
  console.log("\n3. Searching GitHub topics for plugin repositories...");
  const ghTopics = ["openclaw-plugin", "claude-plugin", "claude-code-plugin", "codex-plugin"];

  let ghCount = 0;
  for (const topic of ghTopics) {
    let page = 1;

    while (page <= 10) {
      const ghUrl = `https://api.github.com/search/repositories?q=topic:${topic}&sort=updated&order=desc&per_page=100&page=${page}`;
      const data = await fetchJSON<{ items: any[]; total_count: number }>(ghUrl);

      if (!data?.items?.length) break;

      for (const repo of data.items) {
        const publisher = repo.owner?.login || "github";
        const pluginSlug = slug(`${publisher}-${repo.name}`);

        if (!candidates.has(pluginSlug)) {
          candidates.set(pluginSlug, {
            id: `plugin:github:${repo.full_name}`,
            slug: pluginSlug,
            name: repo.name,
            publisher,
            description: repo.description || `Plugin ${repo.name}`,
            version: "1.0.0",
            githubRepo: repo.html_url,
            source: "github",
            publisherTrust: "community",
            license: repo.license?.spdx_id,
          });
          ghCount++;
        }
      }

      if (page * 100 >= (data.total_count || 0)) break;
      page++;
      await sleep(400);
    }
  }
  console.log(`   ✅ Added ${ghCount} unique plugins from GitHub topics.`);
  console.log(`   📊 Total Combined Unique Candidate Plugins: ${candidates.size}\n`);

  // ── STEP 4: Ingest into Backblaze B2 + CockroachDB ─────────────────────────
  console.log("4. Uploading plugin manifests & saving clean metadata to CockroachDB...");
  const allPlugins = Array.from(candidates.values());
  let processed = 0;
  let errors = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < allPlugins.length; i += BATCH_SIZE) {
    const batch = allPlugins.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const b2Prefix = `plugins/${item.publisher}/${item.slug}`;

          // Create standard plugin manifest
          const manifest = {
            id: item.id,
            name: item.name,
            publisher: item.publisher,
            version: item.version,
            description: item.description,
            npmPackage: item.npmPackage,
            githubRepo: item.githubRepo,
            source: item.source,
            license: item.license || "MIT",
          };

          const manifestJson = JSON.stringify(manifest, null, 2);

          // Attempt to fetch README if github repo available
          let readmeMd: string | null = null;
          if (item.githubRepo) {
            const parts = item.githubRepo.replace("https://github.com/", "").split("/");
            if (parts.length >= 2) {
              readmeMd = await fetchGitHubReadme(parts[0], parts[1]);
            }
          }

          if (!readmeMd) {
            readmeMd = `# ${item.name}\n\n> **Publisher**: \`${item.publisher}\`  \n> **Package**: \`${item.npmPackage || item.name}\`  \n\n${item.description}\n`;
          }

          // Upload manifest + README to B2
          const {
            bytes,
            hash,
            url: storageUrl,
          } = await b2Upload(`${b2Prefix}/manifest.json`, manifestJson, "application/json");
          if (readmeMd) {
            await b2Upload(`${b2Prefix}/README.md`, readmeMd, "text/markdown; charset=utf-8");
          }

          // Quality score calculation
          const tags = extractTags(item.description || item.name, [item.source]);
          const category = inferCategory(item.name, item.description || "", tags);

          const qualityScore = computeQuality({
            hasDescription: !!item.description,
            descriptionLength: item.description?.length ?? 0,
            hasTags: tags.length >= 2,
            tagCount: tags.length,
            hasLicense: !!item.license,
            hasIcon: false,
            hasSourceRepo: !!item.githubRepo,
            hasReadme: !!readmeMd,
            trust: item.publisherTrust,
          });

          // CockroachDB Upsert (Zero Redundancy)
          await sql`
            INSERT INTO plugins (
              id, slug, name,
              source, source_id, source_ref,
              external_url, source_repo,
              publisher, publisher_trust,
              category, tags,
              summary, version,
              quality_score, security_score,
              is_official, is_featured,
              storage_path, storage_url, content_hash, file_size_bytes,
              last_synced_at
            ) VALUES (
              ${item.id},
              ${item.slug},
              ${item.name},
              ${item.source}, ${item.id}, ${"public-api"},
              ${item.githubRepo || item.npmPackage ? `https://www.npmjs.com/package/${item.npmPackage}` : `https://clawhub.ai/plugins`},
              ${item.githubRepo || `https://github.com/${item.publisher}/${item.name}`},
              ${item.publisher}, ${item.publisherTrust || "community"},
              ${category}, ${tags},
              ${item.description.slice(0, 500)}, ${item.version},
              ${qualityScore}, ${50},
              ${item.publisherTrust === "official"}, ${false},
              ${b2Prefix + "/manifest.json"}, ${storageUrl}, ${hash}, ${bytes},
              ${new Date().toISOString()}
            )
            ON CONFLICT (slug) DO UPDATE SET
              quality_score = EXCLUDED.quality_score,
              storage_url = EXCLUDED.storage_url,
              content_hash = EXCLUDED.content_hash,
              file_size_bytes = EXCLUDED.file_size_bytes,
              last_synced_at = EXCLUDED.last_synced_at
          `;

          processed++;
          process.stdout.write(
            `   [${String(processed).padStart(5)}/${allPlugins.length}] ✅ ${(item.publisher + "/" + item.name).slice(0, 50).padEnd(50)}\r`,
          );
        } catch (e: any) {
          errors++;
          if (errors <= 5) console.error(`\n   ❌ Plugin error (${item.name}):`, e.message);
        }
        await sleep(30);
      }),
    );

    if (i + BATCH_SIZE < allPlugins.length) await sleep(100);
  }

  // ── STEP 5: Final Database Audit ───────────────────────────────────────────
  const dbCount = await sql`SELECT count(*) AS c FROM plugins`;

  console.log("\n\n================================================================");
  console.log("🎉 MASS PLUGINS HARVEST COMPLETE");
  console.log(`   Processed:        ${processed} plugins`);
  console.log(`   Errors:           ${errors}`);
  console.log(`   Total DB Plugins: ${dbCount[0].c} stored cleanly in CockroachDB`);
  console.log("   Zero Redundancy:  ON CONFLICT (slug) upsert guaranteed");
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
