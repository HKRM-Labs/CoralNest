/**
 * CORALNEST — ForwardFuture Loop Library Harvester
 *
 * Extracts ALL 85 loops from https://signals.forwardfuture.com/loop-library/catalog.json
 * For each loop:
 *   - Uploads LOOP.md + loop.json to Backblaze B2 (loops/forwardfuture/<slug>/...)
 *   - Inserts clean metadata into CockroachDB `loops` table (Zero Redundancy)
 */
import { sql, b2Upload, computeQuality, extractTags, slug, sleep } from "./lib/ingest-utils.ts";

interface LoopVerification {
  title: string;
  detail?: string;
}

interface LoopRelated {
  slug: string;
  title: string;
  url: string;
}

interface CatalogLoop {
  number: string;
  slug: string;
  title: string;
  url: string;
  category: { slug: string; label: string };
  author: string;
  published: string;
  modified: string;
  description: string;
  useWhen: string;
  prompt: string;
  verification: LoopVerification;
  steps: string[];
  why: string;
  implementationNote?: string;
  keywords: string[];
  related: LoopRelated[];
}

interface Catalog {
  schemaVersion: number;
  name: string;
  publisher: string;
  description: string;
  url: string;
  loopCount: number;
  loops: CatalogLoop[];
}

function inferLoopKind(title: string, keywords: string[]): string {
  const all = (title + " " + keywords.join(" ")).toLowerCase();
  if (all.includes("eval") || all.includes("quality") || all.includes("test")) return "eval-loop";
  if (all.includes("sweep") || all.includes("nightly") || all.includes("scheduled"))
    return "feedback-loop";
  if (all.includes("optim") || all.includes("speed") || all.includes("performance"))
    return "optimization-loop";
  if (all.includes("verif") || all.includes("proof") || all.includes("check"))
    return "step-verifier";
  return "feedback-loop";
}

function inferConvergenceStrategy(steps: string[], prompt: string): string {
  const all = (steps.join(" ") + " " + prompt).toLowerCase();
  if (all.includes("threshold") || all.includes("target") || all.includes("100%"))
    return "threshold";
  if (all.includes("consensus") || all.includes("agree") || all.includes("converge"))
    return "consensus";
  if (all.includes("timeout") || all.includes("max iter") || all.includes("iteration cap"))
    return "timeout";
  if (all.includes("oracle") || all.includes("judge") || all.includes("scorecard")) return "oracle";
  return "threshold";
}

function inferCategory(categorySlug: string): string {
  const map: Record<string, string> = {
    engineering: "engineering",
    evaluation: "evaluation",
    operations: "operations",
    content: "research",
    design: "engineering",
  };
  return map[categorySlug] || "engineering";
}

function buildLoopMd(loop: CatalogLoop): string {
  return `# ${loop.title}

> **Category**: ${loop.category.label}  
> **Author**: ${loop.author}  
> **Published**: ${loop.published}  
> **Modified**: ${loop.modified}  
> **Source**: [${loop.url}](${loop.url})

## Description

${loop.description}

## When to Use

${loop.useWhen}

## Prompt

\`\`\`
${loop.prompt}
\`\`\`

## Steps

${loop.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Verification

**${loop.verification.title}**

${loop.verification.detail || ""}

## Why This Works

${loop.why}

${loop.implementationNote ? `## Implementation Notes\n\n${loop.implementationNote}` : ""}

## Keywords

${loop.keywords.join(", ")}

## Related Loops

${loop.related.map((r) => `- [${r.title}](${r.url})`).join("\n")}
`;
}

async function main() {
  console.log("================================================================");
  console.log("⚡ CORALNEST — FORWARDFUTURE LOOP LIBRARY HARVESTER");
  console.log("   Source: https://signals.forwardfuture.com/loop-library/catalog.json");
  console.log("   Target: All 85 loops → B2 + CockroachDB");
  console.log("================================================================\n");

  // Fetch the official catalog.json
  console.log("1. Fetching ForwardFuture Loop Library catalog...");
  const res = await fetch("https://signals.forwardfuture.com/loop-library/catalog.json");
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching catalog.json`);
  const catalog: Catalog = await res.json();
  console.log(`   ✅ Loaded catalog: ${catalog.loopCount} loops from "${catalog.name}"\n`);

  let processed = 0;
  let errors = 0;

  for (const loop of catalog.loops) {
    try {
      const loopSlug = slug(`forwardfuture-${loop.slug}`);
      const b2Prefix = `loops/forwardfuture/${loopSlug}`;
      const loopId = `loop:forwardfuture:${loop.number}:${loop.slug}`;

      const loopMd = buildLoopMd(loop);
      const loopJson = JSON.stringify(
        {
          id: loopId,
          slug: loopSlug,
          source: "forwardfuture",
          number: loop.number,
          title: loop.title,
          author: loop.author,
          published: loop.published,
          modified: loop.modified,
          category: loop.category,
          description: loop.description,
          useWhen: loop.useWhen,
          prompt: loop.prompt,
          verification: loop.verification,
          steps: loop.steps,
          why: loop.why,
          implementationNote: loop.implementationNote || null,
          keywords: loop.keywords,
          related: loop.related,
          url: loop.url,
        },
        null,
        2,
      );

      // Upload to B2
      const {
        bytes,
        hash,
        url: storageUrl,
      } = await b2Upload(`${b2Prefix}/loop.json`, loopJson, "application/json");
      await b2Upload(`${b2Prefix}/LOOP.md`, loopMd, "text/markdown; charset=utf-8");

      const tags = extractTags(loop.description, [...loop.keywords, loop.category.slug]);
      const loopKind = inferLoopKind(loop.title, loop.keywords);
      const convergenceStrategy = inferConvergenceStrategy(loop.steps, loop.prompt);
      const category = inferCategory(loop.category.slug);

      const qualityScore = computeQuality({
        hasDescription: !!loop.description,
        descriptionLength: loop.description.length,
        hasTags: tags.length >= 3,
        tagCount: tags.length,
        hasLicense: true,
        hasIcon: false,
        hasSourceRepo: false,
        hasReadme: true,
        trust: "verified",
      });

      // Upsert into CockroachDB
      await sql`
        INSERT INTO loops (
          id, slug, name,
          source, source_id, external_url,
          loop_kind, max_iterations, exit_criteria, step_count, convergence_strategy,
          category, subcategory, tags, compatibility, use_cases, difficulty,
          summary, author, license,
          quality_score, security_score, is_verified, is_featured, is_deprecated,
          downloads, stars,
          storage_path, storage_url, content_hash, file_size_bytes,
          last_synced_at
        ) VALUES (
          ${loopId}, ${loopSlug}, ${loop.title},
          ${"forwardfuture"}, ${loop.number}, ${loop.url},
          ${loopKind}, ${10}, ${loop.verification.title}, ${loop.steps.length}, ${convergenceStrategy},
          ${category}, ${loop.category.label.toLowerCase()}, ${tags},
          ${["claude", "codex", "openai", "cursor", "any"]},
          ${[category, "agent-workflow", "repeatable-loop"]},
          ${"intermediate"},
          ${loop.description.slice(0, 500)}, ${loop.author}, ${"CC-BY"},
          ${qualityScore}, ${90}, ${true}, ${parseInt(loop.number) <= 20}, ${false},
          ${0}, ${0},
          ${b2Prefix + "/loop.json"}, ${storageUrl}, ${hash}, ${bytes},
          ${new Date().toISOString()}
        )
        ON CONFLICT (slug) DO UPDATE SET
          quality_score = EXCLUDED.quality_score,
          storage_url = EXCLUDED.storage_url,
          content_hash = EXCLUDED.content_hash,
          last_synced_at = EXCLUDED.last_synced_at
      `;

      processed++;
      process.stdout.write(
        `   [${String(processed).padStart(3)}/${catalog.loops.length}] ✅ ${loop.title.slice(0, 60).padEnd(60)}\r`,
      );
    } catch (e: any) {
      errors++;
      console.error(`\n   ❌ Error on loop ${loop.slug}: ${e.message}`);
    }
    await sleep(30);
  }

  const dbCount = await sql`SELECT count(*) AS c FROM loops`;

  console.log("\n\n================================================================");
  console.log("🎉 FORWARDFUTURE LOOP LIBRARY HARVEST COMPLETE");
  console.log(`   Loops Processed:  ${processed}/${catalog.loops.length}`);
  console.log(`   Errors:           ${errors}`);
  console.log(`   Total DB Loops:   ${dbCount[0].c} rows in CockroachDB`);
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
