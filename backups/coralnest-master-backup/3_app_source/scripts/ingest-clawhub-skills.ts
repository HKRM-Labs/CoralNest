/**
 * CORALNEST — ClawHub Skills Ingestion
 *
 * Fetches ALL skills from clawhub.ai/v1/feeds/skills JSON feed.
 * For each skill:
 *   - If source is "public-github": fetches the REAL SKILL.md from GitHub at exact commit
 *   - If source is "public-clawhub": builds a complete SKILL.md from description + metadata
 *   - Uploads SKILL.md + (if GitHub) README.md to Backblaze B2
 *   - Inserts lean metadata row into CockroachDB
 *
 * Source: https://clawhub.ai/v1/feeds/skills
 * Files:  skills/<publisher>/<slug>/SKILL.md
 *         skills/<publisher>/<slug>/README.md (if available)
 */
import {
  sql,
  b2Upload,
  fetchJSON,
  fetchGitHubReadme,
  fetchGitHubFile,
  computeQuality,
  extractTags,
  inferCategory,
  slug,
  sleep,
  GITHUB_TOKEN,
} from "./lib/ingest-utils.ts";

// ── Types ────────────────────────────────────────────────────────────────────

interface ClawHubEntry {
  type: string;
  id: string; // "@aws/amazon-bedrock"
  title: string;
  description: string;
  version: string;
  state: string;
  featured: boolean;
  featuredAt?: number;
  publisher: { id: string; trust: string };
  install: {
    candidates: Array<{
      sourceRef: string; // "public-github" | "public-clawhub"
      package: string;
      version: string;
      integrity?: string;
      github?: {
        repo: string; // "aws/agent-toolkit-for-aws"
        path: string; // "skills/core-skills/amazon-bedrock"
        commit: string;
        contentHash: string;
      };
    }>;
  };
}

interface ClawHubFeed {
  schemaVersion: number;
  id: string;
  generatedAt: string;
  sequence: number;
  entries: ClawHubEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  aws: "cloud",
  gcp: "cloud",
  azure: "cloud",
  cloudflare: "cloud",
  vercel: "cloud",
  anthropic: "ai",
  openai: "ai",
  mistral: "ai",
  cohere: "ai",
  alipay: "finance",
  stripe: "finance",
  paypal: "finance",
  github: "devops",
  gitlab: "devops",
  bitbucket: "devops",
  slack: "communication",
  discord: "communication",
  telegram: "communication",
  apify: "web",
  firecrawl: "web",
  openclaw: "agents",
  mem0: "ai",
};

function deriveCategoryFromPublisher(
  publisherId: string,
  name: string,
  desc: string,
  tags: string[],
): string {
  const pub = publisherId.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    if (pub.includes(k)) return v;
  }
  return inferCategory(name, desc, tags);
}

/** Build a SKILL.md from ClawHub description + metadata when no GitHub source exists. */
function buildSkillMd(
  entry: ClawHubEntry,
  candidate: ClawHubEntry["install"]["candidates"][0],
): string {
  return `# ${entry.title}

> **Package**: \`${candidate.package}\`  
> **Publisher**: \`${entry.publisher.id}\` (${entry.publisher.trust})  
> **Version**: \`${entry.version}\`  
> **Source**: ClawHub Registry  

## Description

${entry.description}

## Installation

\`\`\`bash
# Via ClawHub CLI
clawhub install ${candidate.package}

# Via OpenClaw
claude skill install ${candidate.package}
\`\`\`

## Package Details

- **ID**: \`${entry.id}\`
- **State**: \`${entry.state}\`
- **Integrity**: \`${candidate.integrity ?? "N/A"}\`
- **Source Reference**: \`${candidate.sourceRef}\`

---

*This skill was sourced from the ClawHub official registry.*
`;
}

// ── Core ──────────────────────────────────────────────────────────────────────

async function processSkill(entry: ClawHubEntry, idx: number, total: number): Promise<void> {
  if (entry.state !== "available") return;

  const candidate = entry.install?.candidates?.[0];
  if (!candidate) return;

  const publisherId = entry.publisher.id;
  const skillSlug = slug(entry.id.replace(/^@[^/]+\//, ""));
  const b2Prefix = `skills/${publisherId}/${skillSlug}`;

  let skillMd: string | null = null;
  let readmeMd: string | null = null;
  let sourcePath: string | null = null;
  let sourceRepo: string | null = null;
  let sourceCommit: string | null = null;

  // ── GitHub-sourced skill: fetch real SKILL.md ───────────────────────────────
  if (candidate.sourceRef === "public-github" && candidate.github) {
    const { repo, path, commit } = candidate.github;
    sourceRepo = `https://github.com/${repo}`;
    sourcePath = path;
    sourceCommit = commit;

    // Try SKILL.md at exact commit path
    skillMd = await fetchGitHubFile(repo, `${path}/SKILL.md`, commit);
    if (!skillMd) skillMd = await fetchGitHubFile(repo, `${path}/skill.md`, commit);

    // Also try README.md from the skill folder
    readmeMd = await fetchGitHubFile(repo, `${path}/README.md`, commit);
    if (!readmeMd) readmeMd = await fetchGitHubFile(repo, `${path}/readme.md`, commit);

    // Fallback: fetch the repo root README
    if (!readmeMd) {
      const parts = repo.split("/");
      readmeMd = await fetchGitHubReadme(parts[0], parts[1]);
    }

    // If still no SKILL.md found, build from description
    if (!skillMd) {
      skillMd = buildSkillMd(entry, candidate);
    }

    await sleep(120); // GitHub rate limit: 5000/hr = ~720ms minimum between calls, but we batch
  } else {
    // ClawHub-hosted skill: build from metadata
    skillMd = buildSkillMd(entry, candidate);
  }

  // ── Upload to B2 ─────────────────────────────────────────────────────────
  const {
    bytes,
    hash,
    url: storageUrl,
  } = await b2Upload(`${b2Prefix}/SKILL.md`, skillMd, "text/markdown; charset=utf-8");

  if (readmeMd) {
    await b2Upload(`${b2Prefix}/README.md`, readmeMd, "text/markdown; charset=utf-8");
  }

  // ── Compute metadata ─────────────────────────────────────────────────────
  const tags = extractTags(entry.description ?? "", []);
  const category = deriveCategoryFromPublisher(
    publisherId,
    entry.title,
    entry.description ?? "",
    tags,
  );

  const qualityScore = computeQuality({
    hasDescription: !!entry.description && entry.description.length > 30,
    descriptionLength: entry.description?.length ?? 0,
    hasTags: tags.length >= 2,
    tagCount: tags.length,
    hasLicense: false,
    hasIcon: false,
    hasSourceRepo: candidate.sourceRef === "public-github",
    hasReadme: !!readmeMd,
    trust: entry.publisher.trust,
  });

  // ── Upsert into CockroachDB ──────────────────────────────────────────────
  await sql`
    INSERT INTO skills (
      id, slug, name,
      source, source_id, source_ref,
      external_url, source_repo, source_path, source_commit,
      publisher, publisher_trust, integrity,
      category, tags,
      summary, version,
      quality_score, security_score,
      is_official, is_featured,
      storage_path, storage_url, content_hash, file_size_bytes,
      last_synced_at
    ) VALUES (
      ${"skill:" + entry.id},
      ${skillSlug},
      ${entry.title},
      ${"clawhub"}, ${entry.id}, ${candidate.sourceRef},
      ${"https://clawhub.ai/skills/" + encodeURIComponent(entry.id)},
      ${sourceRepo}, ${sourcePath}, ${sourceCommit},
      ${publisherId}, ${entry.publisher.trust}, ${candidate.integrity ?? null},
      ${category}, ${tags},
      ${(entry.description ?? "").slice(0, 500)}, ${entry.version},
      ${qualityScore}, ${50},
      ${entry.publisher.trust === "official"}, ${entry.featured},
      ${b2Prefix + "/SKILL.md"}, ${storageUrl}, ${hash}, ${bytes},
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
    `   [${String(idx).padStart(6)}/${total}] ✅ ${(entry.publisher.id + "/" + entry.title).slice(0, 55).padEnd(55)}\r`,
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================");
  console.log("🧠 CLAWHUB SKILLS INGESTION");
  console.log("   Source: https://clawhub.ai/v1/feeds/skills");
  console.log(`   GitHub Token: ${GITHUB_TOKEN ? "✅ present" : "⚠️  missing (rate limited)"}`);
  console.log("   Saving: skills/<publisher>/<slug>/SKILL.md + README.md → B2");
  console.log("================================================================");

  console.log("\n📥 Fetching ClawHub skills feed...");
  const feed = await fetchJSON<ClawHubFeed>("https://clawhub.ai/v1/feeds/skills");
  if (!feed?.entries) {
    console.error("❌ Failed to fetch ClawHub feed");
    process.exit(1);
  }

  const entries = feed.entries.filter((e) => e.type === "skill");
  console.log(`   Feed generated: ${feed.generatedAt}`);
  console.log(`   Total entries:  ${entries.length}`);
  console.log(`   Processing now...\n`);

  let idx = 0;
  let errors = 0;

  // Process in batches of 5 concurrent (to respect GitHub rate limit)
  const BATCH_SIZE = 5;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (entry) => {
        try {
          idx++;
          await processSkill(entry, idx, entries.length);
        } catch (e: any) {
          errors++;
          // Don't log per-error to avoid clutter — just count
        }
      }),
    );
    // Pause between batches to manage GitHub API rate
    if (i + BATCH_SIZE < entries.length) await sleep(200);
  }

  const dbCount = await sql`SELECT count(*) AS c FROM skills WHERE source = 'clawhub'`;

  console.log("\n\n================================================================");
  console.log("✅ CLAWHUB SKILLS INGESTION COMPLETE");
  console.log(`   Processed: ${idx} skills`);
  console.log(`   Errors:    ${errors}`);
  console.log(`   DB rows:   ${dbCount[0].c} (clawhub source)`);
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
