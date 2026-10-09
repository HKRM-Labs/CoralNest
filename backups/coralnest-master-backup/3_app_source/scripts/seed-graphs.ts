/**
 * CORALNEST — Multi-Agent Graphs Seeding Script
 *
 * Authored production DAG topologies and state machine definitions for AI agent coordination.
 * For each graph:
 *   - Builds a complete, valid graph.json definition (nodes, edges, router logic, entry node, framework)
 *   - Uploads graph.json to Backblaze B2 (graphs/<slug>/graph.json)
 *   - Inserts lean metadata row into CockroachDB
 */
import { sql, b2Upload, computeQuality } from "./lib/ingest-utils.ts";

interface GraphDefinition {
  id: string;
  slug: string;
  name: string;
  graph_type: "dag" | "state-machine" | "router" | "pipeline";
  framework: "langgraph" | "crewai" | "autogen" | "custom";
  category: string;
  tags: string[];
  summary: string;
  entry_node: string;
  supports_streaming: boolean;
  supports_human_in_loop: boolean;
  nodes: Array<{
    id: string;
    role: string;
    description: string;
    skills?: string[];
    mcp_tools?: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    condition?: string;
  }>;
}

const PRODUCTION_GRAPHS: GraphDefinition[] = [
  {
    id: "graph:supervisor-worker-research",
    slug: "supervisor-worker-research",
    name: "Supervisor-Worker Research & Synthesis Graph",
    graph_type: "dag",
    framework: "langgraph",
    category: "research",
    tags: ["multi-agent", "langgraph", "research", "supervisor", "synthesis"],
    summary:
      "Orchestrator graph that delegates sub-topics to parallel researcher agents, collects findings, and runs a synthesizer node to compile structured intelligence reports.",
    entry_node: "supervisor_router",
    supports_streaming: true,
    supports_human_in_loop: true,
    nodes: [
      {
        id: "supervisor_router",
        role: "Orchestrator",
        description: "Decomposes user query into sub-research tasks and assigns worker agents.",
        skills: ["@aws/agents-build"],
      },
      {
        id: "web_researcher",
        role: "Worker",
        description: "Executes web search & scraping for external web intelligence.",
        skills: ["@apify/apify-ultimate-scraper"],
      },
      {
        id: "code_analyzer",
        role: "Worker",
        description: "Inspects AST, dependencies, and git commits for codebase context.",
        skills: ["@aws/agents-debug"],
      },
      {
        id: "synthesizer",
        role: "Aggregator",
        description: "Merges outputs into markdown artifact with citations and validation checks.",
        skills: ["@aws/analyzing-release-readiness"],
      },
      {
        id: "evaluator",
        role: "Quality Gate",
        description: "Evaluates report against relevance and accuracy score thresholds.",
        skills: ["@aws/agents-optimize"],
      },
    ],
    edges: [
      { from: "supervisor_router", to: "web_researcher", condition: "needs_web_data" },
      { from: "supervisor_router", to: "code_analyzer", condition: "needs_code_data" },
      { from: "web_researcher", to: "synthesizer" },
      { from: "code_analyzer", to: "synthesizer" },
      { from: "synthesizer", to: "evaluator" },
      { from: "evaluator", to: "supervisor_router", condition: "score < 80 (retry)" },
    ],
  },
  {
    id: "graph:sre-incident-auto-remediation",
    slug: "sre-incident-auto-remediation",
    name: "SRE Incident Detection & Self-Healing State Machine",
    graph_type: "state-machine",
    framework: "langgraph",
    category: "operations",
    tags: ["sre", "incident-response", "self-healing", "devops", "opentelemetry"],
    summary:
      "State machine for automated incident detection, telemetry log triage, sandbox patch testing, and automated PR generation with human-in-the-loop approval gate.",
    entry_node: "telemetry_listener",
    supports_streaming: true,
    supports_human_in_loop: true,
    nodes: [
      {
        id: "telemetry_listener",
        role: "Monitor",
        description: "Polls OpenTelemetry traces and CloudWatch logs for error spikes.",
        mcp_tools: ["evalgate-mcp"],
      },
      {
        id: "triage_agent",
        role: "Diagnostician",
        description: "Correlates logs, trace spans, and git commit diffs to find root cause.",
        skills: ["@aws/agents-debug"],
      },
      {
        id: "sandbox_tester",
        role: "Verifier",
        description: "Applies patch in isolated OpenShell container and verifies fix.",
        skills: ["@openclaw/openshell-sandbox"],
      },
      {
        id: "approval_gate",
        role: "Human-in-the-loop",
        description: "Requests staff approval before production merge.",
        skills: ["@openclaw/lobster"],
      },
    ],
    edges: [
      { from: "telemetry_listener", to: "triage_agent", condition: "anomaly_detected" },
      { from: "triage_agent", to: "sandbox_tester" },
      { from: "sandbox_tester", to: "approval_gate", condition: "test_passed" },
      { from: "sandbox_tester", to: "triage_agent", condition: "test_failed (re-diagnose)" },
    ],
  },
  {
    id: "graph:fullstack-feature-builder",
    slug: "fullstack-feature-builder",
    name: "Fullstack Feature Engineering Pipeline",
    graph_type: "pipeline",
    framework: "crewai",
    category: "engineering",
    tags: ["fullstack", "crewai", "code-generation", "react", "convex"],
    summary:
      "End-to-end multi-agent pipeline: Schema Designer -> Backend Developer -> Frontend Developer -> QA Tester -> Docs Author.",
    entry_node: "schema_architect",
    supports_streaming: true,
    supports_human_in_loop: false,
    nodes: [
      {
        id: "schema_architect",
        role: "Architect",
        description: "Designs Convex/CockroachDB schema definitions and DDL.",
        skills: ["@aws/amazon-aurora-postgresql"],
      },
      {
        id: "backend_dev",
        role: "Engineer",
        description: "Implements queries, mutations, HTTP endpoints, and auth rules.",
        skills: ["@aws/aws-blocks"],
      },
      {
        id: "frontend_dev",
        role: "UI Engineer",
        description: "Builds responsive Carapace React components and Tailwind styling.",
        skills: ["@aws/aws-amplify"],
      },
      {
        id: "qa_tester",
        role: "QA Engineer",
        description: "Runs Vitest unit tests and Playwright smoke tests.",
        skills: ["@aws/analyzing-release-readiness"],
      },
    ],
    edges: [
      { from: "schema_architect", to: "backend_dev" },
      { from: "backend_dev", to: "frontend_dev" },
      { from: "frontend_dev", to: "qa_tester" },
    ],
  },
];

async function main() {
  console.log("================================================================");
  console.log("🕸️ CORALNEST GRAPHS SEEDING");
  console.log("   Saving: graphs/<slug>/graph.json → B2");
  console.log("================================================================");

  for (const graph of PRODUCTION_GRAPHS) {
    const graphSlug = graph.slug;
    const b2Prefix = `graphs/${graphSlug}`;
    const graphJson = JSON.stringify(graph, null, 2);

    const {
      bytes,
      hash,
      url: storageUrl,
    } = await b2Upload(`${b2Prefix}/graph.json`, graphJson, "application/json");

    const qualityScore = computeQuality({
      hasDescription: true,
      descriptionLength: graph.summary.length,
      hasTags: graph.tags.length >= 2,
      tagCount: graph.tags.length,
      hasLicense: true,
      hasIcon: false,
      hasSourceRepo: true,
      hasReadme: true,
      hasTools: graph.nodes.some((n) => n.mcp_tools?.length),
      trust: "official",
    });

    await sql`
      INSERT INTO graphs (
        id, slug, name,
        source, source_id,
        graph_type, entry_node, node_count, edge_count, framework,
        supports_streaming, supports_human_in_loop,
        category, tags,
        summary, author,
        quality_score, security_score, is_verified, is_featured,
        storage_path, storage_url, content_hash, file_size_bytes,
        last_synced_at
      ) VALUES (
        ${graph.id},
        ${graphSlug},
        ${graph.name},
        ${"custom"}, ${graph.id},
        ${graph.graph_type}, ${graph.entry_node}, ${graph.nodes.length}, ${graph.edges.length}, ${graph.framework},
        ${graph.supports_streaming}, ${graph.supports_human_in_loop},
        ${graph.category}, ${graph.tags},
        ${graph.summary.slice(0, 500)}, ${"coralnest-engineering"},
        ${qualityScore}, ${85}, ${true}, ${true},
        ${b2Prefix + "/graph.json"}, ${storageUrl}, ${hash}, ${bytes},
        ${new Date().toISOString()}
      )
      ON CONFLICT (slug) DO UPDATE SET
        node_count = EXCLUDED.node_count,
        edge_count = EXCLUDED.edge_count,
        quality_score = EXCLUDED.quality_score,
        storage_url = EXCLUDED.storage_url,
        content_hash = EXCLUDED.content_hash,
        file_size_bytes = EXCLUDED.file_size_bytes,
        last_synced_at = EXCLUDED.last_synced_at
    `;

    console.log(
      `   ✅ Seeded graph: ${graphSlug} (${graph.nodes.length} nodes, ${graph.edges.length} edges)`,
    );
  }

  const dbCount = await sql`SELECT count(*) AS c FROM graphs`;

  console.log("\n================================================================");
  console.log("✅ GRAPHS SEEDING COMPLETE");
  console.log(`   Total graphs in DB: ${dbCount[0].c}`);
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
