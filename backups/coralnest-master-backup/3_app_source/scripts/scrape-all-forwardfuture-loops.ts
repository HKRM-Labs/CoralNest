import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
  idle_timeout: 30,
});

interface LoopCatalogItem {
  number?: string;
  slug: string;
  title: string;
  url: string;
  category?: {
    slug?: string;
    label?: string;
  };
  author?: string;
  published?: string;
  modified?: string;
  description: string;
  useWhen?: string;
  prompt: string;
  verification?: {
    title?: string;
    detail?: string;
  };
  steps?: string[];
  why?: string;
  implementationNote?: string;
  keywords?: string[];
  related?: Array<{
    slug: string;
    title: string;
    url: string;
  }>;
}

async function main() {
  console.log("==================================================================");
  console.log("🔄 Forward Future Loop Library Harvester -> CockroachDB `flow_loops`");
  console.log("==================================================================");

  const startTime = Date.now();
  console.log(
    "🌐 Fetching catalog from https://signals.forwardfuture.com/loop-library/catalog.json...",
  );

  const res = await fetch("https://signals.forwardfuture.com/loop-library/catalog.json");
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog.json: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as any;
  const loopList: LoopCatalogItem[] = Array.isArray(data)
    ? data
    : data.itemListElement || data.items || data.loops || [];

  console.log(`📋 Found ${loopList.length} loop definitions in catalog.`);

  let inserted = 0;
  for (const loop of loopList) {
    const slug = loop.slug.trim().toLowerCase();
    const name = loop.title || slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const category = loop.category?.slug || loop.category?.label || "operations";
    const loopKind = category.includes("eval") ? "step-verifier" : "feedback-loop";
    const maxIterations = 10;
    const exitCriteria =
      loop.verification?.title ||
      loop.verification?.detail ||
      "Target state reached and all verification checks pass with zero errors.";

    const steps = (loop.steps || []).map((s, idx) => ({
      step: idx + 1,
      instruction: s,
      action: "agent_step",
      verifier: idx === (loop.steps?.length || 1) - 1 ? "convergence_check" : "in_progress",
    }));

    const rawManifest = {
      source: "forwardfuture",
      number: loop.number,
      author: loop.author,
      published: loop.published,
      description: loop.description,
      useWhen: loop.useWhen,
      why: loop.why,
      implementationNote: loop.implementationNote,
      keywords: loop.keywords,
      related: loop.related,
      prompt: loop.prompt,
      verification: loop.verification,
      url: loop.url,
    };

    const flowId = `flow:loop:${slug}`;

    // 1. Insert into flows parent table
    await sql`
      INSERT INTO flows (
        id, slug, name, kind, "family", category, topics, summary,
        prompt_content, author_handle, source_repo, is_official,
        downloads, stars, raw_manifest, created_at, updated_at
      ) VALUES (
        ${flowId},
        ${slug},
        ${name},
        ${"loop"},
        ${category},
        ${"loops"},
        ${loop.keywords || ["feedback-loop", "forwardfuture"]},
        ${loop.description},
        ${loop.prompt},
        ${loop.author || "forwardfuture"},
        ${loop.url},
        ${true},
        ${500},
        ${50},
        ${sql.json(rawManifest as postgres.JSONValue)},
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        summary = EXCLUDED.summary,
        prompt_content = EXCLUDED.prompt_content,
        raw_manifest = EXCLUDED.raw_manifest,
        updated_at = now();
    `;

    // 2. Insert into flow_loops specialized tier table
    await sql`
      INSERT INTO flow_loops (
        id, slug, name, loop_kind, max_iterations, exit_criteria,
        step_count, step_definitions, summary, prompt_content,
        author_handle, category, topics, downloads, stars, updated_at
      ) VALUES (
        ${`loop:${slug}`},
        ${slug},
        ${name},
        ${loopKind},
        ${maxIterations},
        ${exitCriteria},
        ${steps.length || 1},
        ${sql.json(steps as postgres.JSONValue)},
        ${loop.description},
        ${loop.prompt},
        ${loop.author || "forwardfuture"},
        ${category},
        ${loop.keywords || ["feedback-loop", "forwardfuture"]},
        ${500},
        ${50},
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        loop_kind = EXCLUDED.loop_kind,
        max_iterations = EXCLUDED.max_iterations,
        exit_criteria = EXCLUDED.exit_criteria,
        step_count = EXCLUDED.step_count,
        step_definitions = EXCLUDED.step_definitions,
        summary = EXCLUDED.summary,
        prompt_content = EXCLUDED.prompt_content,
        author_handle = EXCLUDED.author_handle,
        category = EXCLUDED.category,
        topics = EXCLUDED.topics,
        updated_at = now();
    `;

    inserted++;
  }

  console.log(`\n🎉 Ingested ${inserted} Forward Future loops into CockroachDB!`);

  const [stats] = await sql`
    SELECT 
      count(*) as total_loops,
      count(DISTINCT slug) as unique_slugs
    FROM flow_loops;
  `;

  console.log("==================================================================");
  console.log("📊 FLOW LOOPS SUMMARY:");
  console.log(`• Total Loops in flow_loops:     ${stats.total_loops}`);
  console.log(`• Unique Slugs (No Duplicates):  ${stats.unique_slugs}`);
  console.log(`• Elapsed Time:                 ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log("==================================================================");

  await sql.end();
}

void main();
