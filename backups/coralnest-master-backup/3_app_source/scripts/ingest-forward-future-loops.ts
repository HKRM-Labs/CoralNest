/**
 * CORALNEST — Forward Future & Custom Loops Ingestion
 *
 * Fetches feedback loop specifications from Forward Future catalog and seeds curated engineering loops.
 * For each loop:
 *   - Builds a complete, formatted LOOP.md specification (exit conditions, steps, convergence rules)
 *   - Uploads LOOP.md to Backblaze B2 (loops/<slug>/LOOP.md)
 *   - Inserts lean metadata row into CockroachDB
 *
 * Sources: https://signals.forwardfuture.com/loop-library/catalog.json + Curated Engineering Loops
 */
import {
  sql,
  b2Upload,
  fetchJSON,
  computeQuality,
  extractTags,
  inferCategory,
  slug,
} from "./lib/ingest-utils.ts";

interface LoopCatalogItem {
  id: string;
  name: string;
  description: string;
  loop_kind?: string;
  max_iterations?: number;
  exit_criteria: string;
  step_count?: number;
  category?: string;
  tags?: string[];
  steps?: Array<{ title: string; prompt: string; verifier?: string }>;
}

const CURATED_ENGINEERING_LOOPS: LoopCatalogItem[] = [
  {
    id: "sub-50ms-page-load",
    name: "Sub-50ms Page Load Optimization Loop",
    description:
      "Iteratively profiles bundle sizes, dynamic imports, server response times, and DOM layout shifts until TTFB < 50ms and LCP < 200ms.",
    loop_kind: "optimization-loop",
    max_iterations: 15,
    exit_criteria:
      "All Core Web Vitals pass: TTFB < 50ms, LCP < 200ms, CLS < 0.01 across 5 consecutive benchmark runs.",
    step_count: 4,
    category: "engineering",
    tags: ["performance", "web-vitals", "optimization", "frontend"],
    steps: [
      {
        title: "Profile Metrics",
        prompt: "Run Lighthouse & WebVitals audit script. Output exact TTFB, FCP, LCP, CLS values.",
        verifier: "check_metrics_json",
      },
      {
        title: "Identify Bottlenecks",
        prompt:
          "Locate largest bundle chunks, unoptimized images, blocking JS, and slow DB queries.",
        verifier: "list_bottlenecks",
      },
      {
        title: "Apply Optimization",
        prompt: "Apply code splits, image compression, memoization, edge caching, or SQL indexing.",
        verifier: "build_and_test",
      },
      {
        title: "Validate Benchmark",
        prompt: "Re-run benchmark suite to confirm latency drop and ensure zero regression.",
        verifier: "compare_benchmarks",
      },
    ],
  },
  {
    id: "100-percent-test-coverage",
    name: "100% Branch Coverage Repair Loop",
    description:
      "Analyzes Vitest/Istanbul coverage reports, identifies uncovered branches, and auto-generates unit and edge-case test suites.",
    loop_kind: "eval-loop",
    max_iterations: 10,
    exit_criteria:
      "Istanbul coverage report outputs 100% statement, branch, function, and line coverage with 0 failing assertions.",
    step_count: 3,
    category: "engineering",
    tags: ["testing", "coverage", "vitest", "unit-tests", "quality"],
    steps: [
      {
        title: "Analyze Uncovered Branches",
        prompt:
          "Parse coverage/lcov.info to extract precise uncovered line ranges and conditional branches.",
        verifier: "parse_lcov",
      },
      {
        title: "Generate Target Tests",
        prompt:
          "Write minimal, focused test cases exercising uncovered logic paths and edge cases.",
        verifier: "run_vitest",
      },
      {
        title: "Verify Coverage Increase",
        prompt: "Re-run test runner with coverage flag and assert branch metric increases.",
        verifier: "check_coverage_threshold",
      },
    ],
  },
  {
    id: "zero-vulnerability-sec-audit",
    name: "Zero-Vulnerability Security Remediation Loop",
    description:
      "Scans dependencies and AST for CVEs, secret leaks, and OWASP Top 10 vulnerabilities, automatically generating patch PRs.",
    loop_kind: "step-verifier",
    max_iterations: 8,
    exit_criteria:
      "Trivy, Semgrep, and npm audit pass with 0 Critical, 0 High, and 0 Medium findings.",
    step_count: 4,
    category: "security",
    tags: ["security", "owasp", "cve", "semgrep", "audit"],
    steps: [
      {
        title: "Run AST & Dependency Scanners",
        prompt: "Execute Semgrep SAST, Trivy container audit, and bun audit.",
        verifier: "parse_sarif",
      },
      {
        title: "Triage Findings",
        prompt: "Categorize security findings by severity and impact on system trust boundary.",
        verifier: "classify_findings",
      },
      {
        title: "Generate Remediations",
        prompt: "Upgrade vulnerable packages, sanitize inputs, and apply security headers.",
        verifier: "apply_patches",
      },
      {
        title: "Re-audit",
        prompt: "Run security scanner suite again to confirm clean report.",
        verifier: "verify_clean_scan",
      },
    ],
  },
  {
    id: "zero-downtime-schema-migration",
    name: "Zero-Downtime Database Migration Loop",
    description:
      "Executes widen-migrate-narrow database migration patterns safely against live production traffic without lock conflicts.",
    loop_kind: "feedback-loop",
    max_iterations: 6,
    exit_criteria:
      "Old column/table dropped safely after dual-write verification passes 100% integrity audit for 24h window.",
    step_count: 4,
    category: "database",
    tags: ["database", "migration", "cockroachdb", "convex", "zero-downtime"],
    steps: [
      {
        title: "Widen Phase",
        prompt:
          "Add new column/table as optional or nullable without breaking existing app queries.",
        verifier: "deploy_schema_widen",
      },
      {
        title: "Dual-Write Phase",
        prompt: "Deploy app code that writes to both old and new schema locations simultaneously.",
        verifier: "check_dual_write_health",
      },
      {
        title: "Backfill Data",
        prompt:
          "Execute batch background backfill for historical rows with content hash verification.",
        verifier: "verify_backfill_completion",
      },
      {
        title: "Narrow Phase",
        prompt: "Switch readers to new schema, verify stability, and drop deprecated column/table.",
        verifier: "deploy_schema_narrow",
      },
    ],
  },
  {
    id: "sre-incident-auto-triage",
    name: "SRE Incident Detection & Triage Loop",
    description:
      "Monitors OpenTelemetry error rates, analyzes stack traces, correlates log anomalies, and drafts root-cause incident reports.",
    loop_kind: "feedback-loop",
    max_iterations: 12,
    exit_criteria:
      "Root cause identified with high confidence (>90%), mitigating patch applied, and error rate drops below baseline threshold.",
    step_count: 4,
    category: "operations",
    tags: ["sre", "incident-response", "opentelemetry", "logs", "monitoring"],
    steps: [
      {
        title: "Ingest Telemetry Alerts",
        prompt:
          "Poll Axiom / CloudWatch metrics for error spikes, 5xx responses, or unhandled exceptions.",
        verifier: "check_error_rate",
      },
      {
        title: "Form Hypotheses",
        prompt:
          "Analyze recent deploys, stack traces, and log correlations to isolate failing subsystem.",
        verifier: "generate_hypotheses",
      },
      {
        title: "Execute Safe Probe",
        prompt:
          "Run non-destructive diagnostic queries or feature-flag toggles to confirm root cause.",
        verifier: "run_probe",
      },
      {
        title: "Publish Incident Brief",
        prompt:
          "Generate markdown incident post-mortem with timeline, root cause, and remediation.",
        verifier: "publish_report",
      },
    ],
  },
];

function buildLoopMd(item: LoopCatalogItem): string {
  const stepsMd = (item.steps ?? [])
    .map(
      (s, i) => `### Step ${i + 1}: ${s.title}
- **Prompt**: ${s.prompt}
- **Verifier**: \`${s.verifier ?? "manual_check"}\`
`,
    )
    .join("\n");

  return `# ${item.name}

> **Kind**: \`${item.loop_kind ?? "feedback-loop"}\`  
> **Category**: \`${item.category ?? "engineering"}\`  
> **Max Iterations**: \`${item.max_iterations ?? 10}\`  

## 🎯 Exit Criteria

> ${item.exit_criteria}

## 📋 Loop Description

${item.description}

## 🔄 Iteration Execution Protocol

${stepsMd || "*Custom protocol defined at runtime.*"}

---
*CoralNest Loop Specification — ${item.name}*
`;
}

async function processLoop(item: LoopCatalogItem, sourceName: string): Promise<void> {
  const loopSlug = slug(item.id || item.name);
  const b2Prefix = `loops/${loopSlug}`;
  const loopMd = buildLoopMd(item);

  const {
    bytes,
    hash,
    url: storageUrl,
  } = await b2Upload(`${b2Prefix}/LOOP.md`, loopMd, "text/markdown; charset=utf-8");

  const tags = extractTags(item.description, item.tags ?? []);
  const category = item.category ?? inferCategory(item.name, item.description, tags);

  const qualityScore = computeQuality({
    hasDescription: true,
    descriptionLength: item.description.length,
    hasTags: tags.length >= 2,
    tagCount: tags.length,
    hasLicense: true,
    hasIcon: false,
    hasSourceRepo: true,
    hasReadme: true,
    trust: "official",
  });

  await sql`
    INSERT INTO loops (
      id, slug, name,
      source, source_id,
      loop_kind, max_iterations, exit_criteria, step_count,
      category, tags,
      summary, author,
      quality_score, security_score, is_verified, is_featured,
      storage_path, storage_url, content_hash, file_size_bytes,
      last_synced_at
    ) VALUES (
      ${"loop:" + loopSlug},
      ${loopSlug},
      ${item.name},
      ${sourceName}, ${item.id},
      ${item.loop_kind ?? "feedback-loop"}, ${item.max_iterations ?? 10}, ${item.exit_criteria}, ${(item.steps ?? []).length || 1},
      ${category}, ${tags},
      ${item.description.slice(0, 500)}, ${"coralnest-engineering"},
      ${qualityScore}, ${80}, ${true}, ${true},
      ${b2Prefix + "/LOOP.md"}, ${storageUrl}, ${hash}, ${bytes},
      ${new Date().toISOString()}
    )
    ON CONFLICT (slug) DO UPDATE SET
      loop_kind = EXCLUDED.loop_kind,
      exit_criteria = EXCLUDED.exit_criteria,
      quality_score = EXCLUDED.quality_score,
      storage_url = EXCLUDED.storage_url,
      content_hash = EXCLUDED.content_hash,
      file_size_bytes = EXCLUDED.file_size_bytes,
      last_synced_at = EXCLUDED.last_synced_at
  `;

  console.log(`   ✅ Seeded loop: ${loopSlug}`);
}

async function main() {
  console.log("================================================================");
  console.log("🔄 CORALNEST LOOPS INGESTION");
  console.log("   Saving: loops/<slug>/LOOP.md → B2");
  console.log("================================================================");

  let total = 0;

  // 1. Process curated engineering loops
  console.log("\n1. Seeding Curated Production Engineering Loops...");
  for (const item of CURATED_ENGINEERING_LOOPS) {
    await processLoop(item, "custom");
    total++;
  }

  // 2. Fetch Forward Future catalog if accessible
  console.log("\n2. Probing Forward Future Loop Library catalog...");
  const ffCatalog = await fetchJSON<LoopCatalogItem[]>(
    "https://signals.forwardfuture.com/loop-library/catalog.json",
  );
  if (Array.isArray(ffCatalog)) {
    console.log(`   Found ${ffCatalog.length} loops in catalog`);
    for (const item of ffCatalog) {
      try {
        await processLoop(item, "forwardfuture");
        total++;
      } catch (e: any) {
        console.error(`   ⚠️  Error processing loop ${item.id}:`, e.message);
      }
    }
  } else {
    console.log(
      "   ℹ️  Forward Future online catalog currently empty/unavailable, curated loops active.",
    );
  }

  const dbCount = await sql`SELECT count(*) AS c FROM loops`;

  console.log("\n================================================================");
  console.log("✅ LOOPS INGESTION COMPLETE");
  console.log(`   Total loops in DB: ${dbCount[0].c}`);
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
