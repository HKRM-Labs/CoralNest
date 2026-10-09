/**
 * CORALNEST — ClawHub Plugins Ingestion
 *
 * Fetches ALL plugins from clawhub.ai/v1/feeds/plugins JSON feed.
 * For each plugin:
 *   - Builds full manifest.json (install rules, publisher, integrity, metadata)
 *   - Fetches GitHub README.md if candidate sourceRef is public-github
 *   - Uploads manifest.json + README.md to Backblaze B2
 *   - Inserts lean metadata row into CockroachDB
 *
 * Source: https://clawhub.ai/v1/feeds/plugins
 * Files:  plugins/<publisher>/<slug>/manifest.json
 *         plugins/<publisher>/<slug>/README.md (if available)
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

interface ClawHubPluginEntry {
  type: string;
  id: string; // "@openclaw/slack"
  title: string;
  description: string;
  version: string;
  state: string;
  featured: boolean;
  featuredAt?: number;
  icon?: string;
  publisher: { id: string; trust: string };
  install: {
    candidates: Array<{
      sourceRef: string;
      package: string;
      version: string;
      integrity?: string;
      github?: {
        repo: string;
        path?: string;
        commit: string;
        contentHash?: string;
      };
    }>;
  };
}

interface ClawHubPluginFeed {
  schemaVersion: number;
  id: string;
  generatedAt: string;
  sequence: number;
  entries: ClawHubPluginEntry[];
}

function inferPluginCategory(id: string, title: string, description: string): string {
  const text = (id + " " + title + " " + description).toLowerCase();
  if (
    /channel|slack|discord|matrix|telegram|whatsapp|line|teams|feishu|qq|zalo|irc|sms|signal|bluebubbles/.test(
      text,
    )
  )
    return "channel";
  if (
    /provider|mantle|bedrock|vertex|cerebras|chutes|cohere|deepinfra|deepseek|fireworks|groq|kimi|moonshot|qwen|venice|zai/.test(
      text,
    )
  )
    return "provider";
  if (/memory|lancedb|vector|mem0|recall/.test(text)) return "memory";
  if (/speech|tts|onnx|gradium|inworld|voice/.test(text)) return "speech";
  if (/diff|viewer|render|formatting/.test(text)) return "tool";
  if (/runtime|acpx|copilot|harness|sandbox|openshell/.test(text)) return "runtime";
  if (/search|brave|exa|firecrawl|perplexity|searxng|tavily|parallel/.test(text)) return "search";
  return inferCategory(title, description, []);
}

async function processPlugin(entry: ClawHubPluginEntry, idx: number, total: number): Promise<void> {
  if (entry.state !== "available") return;

  const candidate = entry.install?.candidates?.[0];
  if (!candidate) return;

  const publisherId = entry.publisher?.id || "community";
  const pluginSlug = slug(entry.id.replace(/^@[^/]+\//, ""));
  const b2Prefix = `plugins/${publisherId}/${pluginSlug}`;

  let readmeMd: string | null = null;
  let repoUrl: string | null = null;

  if (candidate.sourceRef === "public-github" && candidate.github) {
    const { repo } = candidate.github;
    repoUrl = `https://github.com/${repo}`;
    const parts = repo.split("/");
    if (parts.length === 2) {
      readmeMd = await fetchGitHubReadme(parts[0], parts[1]);
    }
    await sleep(100);
  }

  const manifest = {
    id: `plugin:${entry.id}`,
    package: candidate.package,
    title: entry.title,
    description: entry.description ?? "",
    version: entry.version,
    publisher: entry.publisher,
    state: entry.state,
    featured: entry.featured,
    icon: entry.icon ?? null,
    install: entry.install,
    readme: readmeMd ?? null,
    repo_url: repoUrl,
    clawhub_url: `https://clawhub.ai/plugins/${encodeURIComponent(entry.id)}`,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);

  const {
    bytes,
    hash,
    url: storageUrl,
  } = await b2Upload(`${b2Prefix}/manifest.json`, manifestJson, "application/json");

  if (readmeMd) {
    await b2Upload(`${b2Prefix}/README.md`, readmeMd, "text/markdown; charset=utf-8");
  }

  const tags = extractTags(entry.description ?? [], []);
  const category = inferPluginCategory(entry.id, entry.title, entry.description ?? "");

  const qualityScore = computeQuality({
    hasDescription: !!entry.description && entry.description.length > 20,
    descriptionLength: entry.description?.length ?? 0,
    hasTags: tags.length >= 1,
    tagCount: tags.length,
    hasLicense: false,
    hasIcon: !!entry.icon,
    hasSourceRepo: !!repoUrl,
    hasReadme: !!readmeMd,
    trust: entry.publisher?.trust,
  });

  await sql`
    INSERT INTO plugins (
      id, slug, name,
      source, source_id, external_url,
      publisher, publisher_trust, integrity,
      version, category, tags,
      summary, icon_url, repo_url,
      quality_score, security_score,
      is_official, is_featured,
      storage_path, storage_url, content_hash, file_size_bytes,
      last_synced_at
    ) VALUES (
      ${"plugin:" + entry.id},
      ${pluginSlug},
      ${entry.title},
      ${"clawhub"}, ${entry.id}, ${"https://clawhub.ai/plugins/" + encodeURIComponent(entry.id)},
      ${publisherId}, ${entry.publisher?.trust ?? "community"}, ${candidate.integrity ?? null},
      ${entry.version}, ${category}, ${tags},
      ${(entry.description ?? "").slice(0, 500)}, ${entry.icon ?? null}, ${repoUrl},
      ${qualityScore}, ${50},
      ${entry.publisher?.trust === "official"}, ${entry.featured ?? false},
      ${b2Prefix + "/manifest.json"}, ${storageUrl}, ${hash}, ${bytes},
      ${new Date().toISOString()}
    )
    ON CONFLICT (slug) DO UPDATE SET
      version = EXCLUDED.version,
      quality_score = EXCLUDED.quality_score,
      storage_url = EXCLUDED.storage_url,
      content_hash = EXCLUDED.content_hash,
      file_size_bytes = EXCLUDED.file_size_bytes,
      last_synced_at = EXCLUDED.last_synced_at
  `;

  process.stdout.write(
    `   [${String(idx).padStart(4)}/${total}] ✅ ${(publisherId + "/" + entry.title).slice(0, 50).padEnd(50)}\r`,
  );
}

async function main() {
  console.log("================================================================");
  console.log("🔌 CLAWHUB PLUGINS INGESTION");
  console.log("   Source: https://clawhub.ai/v1/feeds/plugins");
  console.log("   Saving: plugins/<publisher>/<slug>/manifest.json + README.md → B2");
  console.log("================================================================");

  const feed = await fetchJSON<ClawHubPluginFeed>("https://clawhub.ai/v1/feeds/plugins");
  if (!feed?.entries) {
    console.error("❌ Failed to fetch ClawHub plugins feed");
    process.exit(1);
  }

  const entries = feed.entries.filter((e) => e.type === "plugin" || e.install?.candidates?.length);
  console.log(`   Feed sequence: ${feed.sequence}`);
  console.log(`   Total plugins:  ${entries.length}`);

  let idx = 0;
  let errors = 0;

  for (const entry of entries) {
    idx++;
    try {
      await processPlugin(entry, idx, entries.length);
    } catch (e: any) {
      errors++;
    }
  }

  const dbCount = await sql`SELECT count(*) AS c FROM plugins WHERE source = 'clawhub'`;

  console.log("\n\n================================================================");
  console.log("✅ CLAWHUB PLUGINS INGESTION COMPLETE");
  console.log(`   Processed: ${idx} plugins`);
  console.log(`   Errors:    ${errors}`);
  console.log(`   DB rows:   ${dbCount[0].c} (clawhub source)`);
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
