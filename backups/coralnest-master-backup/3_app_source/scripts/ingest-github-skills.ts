/**
 * CORALNEST — GitHub Mass Skills Harvester
 *
 * Harvests ALL GitHub repositories that are OpenClaw/Claude/Codex skills
 * by searching across all relevant topic tags and code search.
 *
 * Topics covered:
 *   - topic:openclaw-skill     → ~868 repos
 *   - topic:openclaw-skills    → ~699 repos
 *   - topic:claude-skill       → ~4,267 repos
 *   - topic:claude-code-skill  → ~2,127 repos
 *   - topic:codex-skill        → ~2,676 repos
 *   - topic:agent-skill        → additional repos
 *   Total unique repos: ~10,000+
 *
 * For each repo:
 *   1. Finds all SKILL.md files in the repo (supports multi-skill repos)
 *   2. Uploads each SKILL.md to B2: skills/github/<owner>/<repo>/<skill>/SKILL.md
 *   3. Upserts clean metadata row to CockroachDB skills table
 */
import {
  sql,
  b2Upload,
  fetchGitHubReadme,
  fetchGitHubFile,
  computeQuality,
  extractTags,
  inferCategory,
  slug,
  sleep,
  GITHUB_TOKEN,
} from "./lib/ingest-utils.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const TOPICS = [
  "openclaw-skill",
  "openclaw-skills",
  "claude-skill",
  "claude-code-skill",
  "codex-skill",
  "agent-skill",
  "ai-skill",
  "claude-skills",
  "codex-skills",
];

const PER_PAGE = 100;
const BATCH_SIZE = 10;

// ── GitHub helpers ─────────────────────────────────────────────────────────────

async function ghFetch<T>(path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (r.status === 403 || r.status === 429) {
      const reset = r.headers.get("x-ratelimit-reset");
      const wait = reset ? Math.max(0, parseInt(reset) * 1000 - Date.now()) + 1000 : 30000;
      console.warn(`\n   ⏳ Rate limited — waiting ${Math.round(wait / 1000)}s...`);
      await sleep(Math.min(wait, 60000));
      continue;
    }
    if (!r.ok) return null;
    return r.json() as Promise<T>;
  }
  return null;
}

interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  topics: string[];
  language: string | null;
  license: { spdx_id: string } | null;
  pushed_at: string;
}

interface GHSearchResult {
  total_count: number;
  items: GHRepo[];
}

interface GHTree {
  tree: { path: string; type: string; sha: string }[];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================");
  console.log("🔭 CORALNEST — GITHUB MASS SKILLS HARVESTER");
  console.log(`   Topics: ${TOPICS.join(", ")}`);
  console.log("   Target: 50,000+ unique GitHub skill repos → B2 + CockroachDB");
  console.log("================================================================\n");

  // Step 1: Collect all unique repos from all topic searches
  const repoMap = new Map<string, GHRepo>();

  for (const topic of TOPICS) {
    process.stdout.write(`   🔍 Fetching topic:${topic}...`);
    let page = 1;
    let topicCount = 0;

    while (true) {
      const data = await ghFetch<GHSearchResult>(
        `/search/repositories?q=topic:${topic}&sort=updated&order=desc&per_page=${PER_PAGE}&page=${page}`,
      );
      if (!data?.items?.length) break;

      for (const repo of data.items) {
        if (!repoMap.has(repo.full_name)) {
          repoMap.set(repo.full_name, repo);
          topicCount++;
        }
      }

      const totalPages = Math.ceil((data.total_count || 0) / PER_PAGE);
      if (page >= totalPages || page >= 10) break; // GitHub caps at 1000 results (10 pages)
      page++;
      await sleep(500);
    }

    console.log(` ${topicCount} new repos`);
  }

  console.log(`\n📦 Total Unique GitHub Skill Repos Collected: ${repoMap.size}\n`);
  console.log("3. Ingesting: scanning repo trees + uploading SKILL.md files to B2...\n");

  const allRepos = Array.from(repoMap.values());
  let totalSkillsProcessed = 0;
  let reposProcessed = 0;
  let errors = 0;

  for (let i = 0; i < allRepos.length; i += BATCH_SIZE) {
    const batch = allRepos.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (repo) => {
        try {
          const owner = repo.owner.login;
          const repoName = repo.name;
          const branch = repo.default_branch || "main";

          // Get repo file tree to find all SKILL.md files
          const tree = await ghFetch<GHTree>(
            `/repos/${repo.full_name}/git/trees/${branch}?recursive=1`,
          );

          let skillPaths: string[] = [];
          if (tree?.tree) {
            skillPaths = tree.tree
              .filter((f) => f.type === "blob" && f.path.toUpperCase().endsWith("SKILL.MD"))
              .map((f) => f.path);
          }

          // Fallback: if no tree or no SKILL.md found, try root
          if (!skillPaths.length) {
            skillPaths = ["SKILL.md"];
          }

          const readmeMd = await fetchGitHubReadme(owner, repoName);

          for (const skillFilePath of skillPaths) {
            let skillMd = await fetchGitHubFile(repo.full_name, skillFilePath, branch);

            // Extract skill name from path
            const pathParts = skillFilePath.split("/");
            const skillDir = pathParts.length > 1 ? pathParts[pathParts.length - 2] : repoName;
            const rawSkillName = skillDir === repoName ? repoName : skillDir;

            const skillSlug = slug(`${owner}-${repoName}-${rawSkillName}`);
            const b2Prefix = `skills/github/${owner}/${repoName}/${rawSkillName}`;

            if (!skillMd || skillMd.length < 20) {
              skillMd = `# ${rawSkillName}\n\n> **Repo**: \`github.com/${repo.full_name}\`\n\n${repo.description || "OpenClaw/Claude agent skill."}\n\n## Install\n\n\`\`\`bash\nnpx skills add https://github.com/${repo.full_name}\n\`\`\`\n`;
            }

            // Upload to B2
            const {
              bytes,
              hash,
              url: storageUrl,
            } = await b2Upload(`${b2Prefix}/SKILL.md`, skillMd, "text/markdown; charset=utf-8");
            if (readmeMd) {
              await b2Upload(`${b2Prefix}/README.md`, readmeMd, "text/markdown; charset=utf-8");
            }

            // Compute quality
            const allTopics = [...(repo.topics || []), rawSkillName];
            const tags = extractTags(repo.description || rawSkillName, allTopics);
            const category = inferCategory(rawSkillName, repo.description || "", tags);

            const qualityScore = computeQuality({
              hasDescription: !!repo.description,
              descriptionLength: repo.description?.length ?? 0,
              hasTags: tags.length >= 2,
              tagCount: tags.length,
              hasLicense: !!repo.license,
              hasIcon: false,
              hasSourceRepo: true,
              hasReadme: !!readmeMd,
              trust: "community",
            });

            const starBonus = Math.min(20, Math.floor((repo.stargazers_count || 0) / 50));
            const finalQuality = Math.min(100, qualityScore + starBonus);

            await sql`
              INSERT INTO skills (
                id, slug, name,
                source, source_id, source_ref,
                external_url, source_repo, source_path,
                publisher, publisher_trust,
                category, tags,
                summary, version,
                quality_score, security_score,
                is_official, is_featured,
                storage_path, storage_url, content_hash, file_size_bytes,
                last_synced_at
              ) VALUES (
                ${"skill:github:" + repo.full_name + ":" + rawSkillName},
                ${skillSlug},
                ${rawSkillName},
                ${"github"}, ${repo.full_name + ":" + rawSkillName}, ${"github-topic-search"},
                ${"https://github.com/" + repo.full_name},
                ${"https://github.com/" + repo.full_name},
                ${skillFilePath},
                ${owner}, ${"community"},
                ${category}, ${tags},
                ${(repo.description || rawSkillName).slice(0, 500)}, ${"1.0.0"},
                ${finalQuality}, ${45},
                ${false}, ${(repo.stargazers_count || 0) > 500},
                ${b2Prefix + "/SKILL.md"}, ${storageUrl}, ${hash}, ${bytes},
                ${new Date().toISOString()}
              )
              ON CONFLICT (slug) DO UPDATE SET
                quality_score = GREATEST(skills.quality_score, EXCLUDED.quality_score),
                storage_url = EXCLUDED.storage_url,
                content_hash = EXCLUDED.content_hash,
                last_synced_at = EXCLUDED.last_synced_at
            `;

            totalSkillsProcessed++;
          }

          reposProcessed++;
          process.stdout.write(
            `   [repo ${String(reposProcessed).padStart(5)}/${allRepos.length}] ✅ ${repo.full_name.slice(0, 50).padEnd(50)} (+${skillPaths.length} skills)\r`,
          );
        } catch (e: any) {
          errors++;
        }
        await sleep(60);
      }),
    );

    if (i + BATCH_SIZE < allRepos.length) await sleep(200);
  }

  // Final DB audit
  const dbCount = await sql`SELECT count(*) AS c FROM skills`;

  console.log("\n\n================================================================");
  console.log("🎉 GITHUB MASS SKILLS HARVEST COMPLETE");
  console.log(`   Repos Scanned:        ${reposProcessed}`);
  console.log(`   Skills Ingested:      ${totalSkillsProcessed}`);
  console.log(`   Errors:               ${errors}`);
  console.log(`   Total DB Skills:      ${dbCount[0].c}`);
  console.log("   Zero Redundancy: ON CONFLICT (slug) upsert guaranteed");
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
