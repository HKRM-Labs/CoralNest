import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
  idle_timeout: 30,
});

interface LoopDefinition {
  id: string;
  slug: string;
  name: string;
  loop_kind: string;
  max_iterations: number;
  exit_criteria: string;
  step_count: number;
  step_definitions: Array<{ step: number; name: string; description: string; action: string }>;
  summary: string;
  prompt_content: string;
  author_handle: string;
  category: string;
  topics: string[];
  downloads: number;
  stars: number;
}

interface GraphDefinition {
  id: string;
  slug: string;
  name: string;
  graph_type: string;
  entry_node: string;
  nodes: Array<{ id: string; name: string; role: string; type: string }>;
  edges: Array<{ from: string; to: string; condition?: string }>;
  summary: string;
  prompt_content: string;
  author_handle: string;
  category: string;
  topics: string[];
  downloads: number;
  stars: number;
}

const RICH_LOOPS: LoopDefinition[] = [
  {
    id: "loop:tdd-self-repair",
    slug: "tdd-self-repair-loop",
    name: "TDD Self-Repair & Test Healing Loop",
    loop_kind: "eval-repair",
    max_iterations: 8,
    exit_criteria: "All Vitest/Jest unit tests pass with 0 errors and coverage >= 85%",
    step_count: 4,
    step_definitions: [
      {
        step: 1,
        name: "Run Test Suite",
        description: "Execute test runner and capture stdout/stderr stack traces",
        action: "bun test",
      },
      {
        step: 2,
        name: "Analyze Error Trace",
        description: "Parse failing assertion lines and identify root cause",
        action: "inspect_failure",
      },
      {
        step: 3,
        name: "Generate Patch",
        description: "Edit implementation code to fix regression without altering test expectation",
        action: "apply_code_edit",
      },
      {
        step: 4,
        name: "Verify Regression",
        description: "Re-run full test suite to guarantee zero cascading breakages",
        action: "bun test --coverage",
      },
    ],
    summary:
      "Iterative test-driven repair loop that runs tests, parses failure stacktraces, modifies code, and re-tests until 100% pass rate.",
    prompt_content: `# TDD Self-Repair Loop\n\nIterative autonomous feedback loop for automated bug fixing and regression prevention.\n\n## Loop Protocol\n1. Run automated test runner.\n2. If exit code == 0, break loop.\n3. Else parse line-number stack traces.\n4. Apply patch and repeat until max_iterations reached.`,
    author_handle: "openclaw",
    category: "automation",
    topics: ["loops", "tdd", "testing", "self-healing", "vitest"],
    downloads: 84000,
    stars: 3200,
  },
  {
    id: "loop:ralph-autonomous-iteration",
    slug: "ralph-autonomous-iteration-loop",
    name: "Ralph Continuous Agent Loop",
    loop_kind: "feedback-loop",
    max_iterations: 15,
    exit_criteria: "Goal verification criteria satisfied or human interrupt signal received",
    step_count: 5,
    step_definitions: [
      {
        step: 1,
        name: "Perceive Environment",
        description: "Inspect open files, active tasks, and recent terminal outputs",
        action: "observe_state",
      },
      {
        step: 2,
        name: "Plan Next Action",
        description: "Formulate atomic step towards long-running goal",
        action: "generate_plan_step",
      },
      {
        step: 3,
        name: "Tool Execution",
        description: "Run tool call (file edit, web search, command run)",
        action: "invoke_tool",
      },
      {
        step: 4,
        name: "Evaluate Progress",
        description: "Compare new system state against objective",
        action: "evaluate_goal_distance",
      },
      {
        step: 5,
        name: "Checkpoint State",
        description: "Write progress checkpoint to memory and continue",
        action: "save_checkpoint",
      },
    ],
    summary:
      "Continuous long-horizon execution loop for overnight goals and autonomous background development.",
    prompt_content: `# Ralph Continuous Agent Loop\n\nLong-running autonomous loop enabling agents to persist across hours of complex code refactoring.\n\n## Invariants\n- Never stop on minor error; retry with alternate strategy.\n- Checkpoint progress every cycle.`,
    author_handle: "openclaw",
    category: "agents",
    topics: ["loops", "ralph", "long-horizon", "autonomous"],
    downloads: 96000,
    stars: 4500,
  },
  {
    id: "loop:autoreview-lint-fix",
    slug: "autoreview-lint-fix-loop",
    name: "Autoreview & Oxlint Static Gate Loop",
    loop_kind: "step-verifier",
    max_iterations: 5,
    exit_criteria: "Zero oxlint errors, zero Biome format warnings, and clean tsc compilation",
    step_count: 3,
    step_definitions: [
      {
        step: 1,
        name: "Run Static Check",
        description: "Execute oxlint, Biome, and tsc in parallel",
        action: "bun run ci:static",
      },
      {
        step: 2,
        name: "Format & Auto-Fix",
        description: "Apply automated Biome and oxlint formatting rules",
        action: "oxfmt --write",
      },
      {
        step: 3,
        name: "Fix Semantic Types",
        description: "Repair any remaining TypeScript type mismatches",
        action: "edit_type_definitions",
      },
    ],
    summary:
      "Pre-commit static analysis gate loop ensuring pristine formatting, zero unused variables, and strict type safety.",
    prompt_content: `# Autoreview Lint-Fix Loop\n\nStatic analysis loop running oxlint, TypeScript compiler, and Biome until all gates pass cleanly.`,
    author_handle: "openclaw",
    category: "development",
    topics: ["loops", "linting", "oxlint", "typescript", "formatting"],
    downloads: 62000,
    stars: 2800,
  },
  {
    id: "loop:observability-alert-triage",
    slug: "observability-alert-triage-loop",
    name: "Continuous SRE Alert Triage & Containment Loop",
    loop_kind: "feedback-loop",
    max_iterations: 10,
    exit_criteria: "P99 latency normalizes below 250ms and error rate drops below 0.01%",
    step_count: 4,
    step_definitions: [
      {
        step: 1,
        name: "Poll CloudWatch & Logs",
        description: "Query metric anomalies and log spikes",
        action: "query_metrics",
      },
      {
        step: 2,
        name: "Identify Faulty Pods",
        description: "Filter container error codes and memory limits",
        action: "diagnose_k8s_pods",
      },
      {
        step: 3,
        name: "Scale / Rollback",
        description: "Execute traffic throttling or pod restarts",
        action: "trigger_containment",
      },
      {
        step: 4,
        name: "Verify Recovery",
        description: "Confirm SLO stabilization over 5-minute window",
        action: "verify_slo",
      },
    ],
    summary:
      "Continuous automated SRE loop that monitors production telemetry, throttles anomalies, and verifies service recovery.",
    prompt_content: `# SRE Alert Triage Loop\n\nAutomated monitoring and incident containment loop meeting 60-second SLA.`,
    author_handle: "aws",
    category: "automation",
    topics: ["loops", "sre", "observability", "containment", "cloudwatch"],
    downloads: 51000,
    stars: 1900,
  },
  {
    id: "loop:web-scraper-pagination",
    slug: "web-scraper-pagination-loop",
    name: "Self-Healing Web Scraper & Cursor Pagination Loop",
    loop_kind: "feedback-loop",
    max_iterations: 50,
    exit_criteria: "nextCursor is null or total target record count reached",
    step_count: 3,
    step_definitions: [
      {
        step: 1,
        name: "Fetch Paginated Batch",
        description: "Send HTTP GET with current cursor and retry on 429 rate limit",
        action: "fetch_with_backoff",
      },
      {
        step: 2,
        name: "Extract & Validate Data",
        description: "Parse JSON/HTML payload and validate required schema keys",
        action: "schema_validation",
      },
      {
        step: 3,
        name: "Stream Batch Upsert",
        description: "Write batch directly to database with conflict resolution",
        action: "batch_sql_upsert",
      },
    ],
    summary:
      "High-throughput pagination loop that handles exponential backoff, cursor tracking, and streaming database ingestion.",
    prompt_content: `# Self-Healing Pagination Loop\n\nAutomated cursor pagination loop for web scraping and API catalog extraction.`,
    author_handle: "community",
    category: "data",
    topics: ["loops", "scraper", "pagination", "etl", "streams"],
    downloads: 43000,
    stars: 1700,
  },
];

const RICH_GRAPHS: GraphDefinition[] = [
  {
    id: "graph:supervisor-worker-research",
    slug: "supervisor-worker-research-graph",
    name: "Supervisor-Worker Multi-Agent Research DAG",
    graph_type: "dag",
    entry_node: "supervisor_router",
    nodes: [
      {
        id: "supervisor_router",
        name: "Supervisor Planner",
        role: "Decomposes complex questions into parallel research sub-tasks",
        type: "router",
      },
      {
        id: "web_search_agent",
        name: "Web Search Specialist",
        role: "Queries Brave & Exa APIs for latest technical documentation",
        type: "worker",
      },
      {
        id: "codebase_analyst",
        name: "Codebase Analyst",
        role: "Grep searches local repositories for symbol definitions and usages",
        type: "worker",
      },
      {
        id: "synthesizer",
        name: "Synthesis & Verification Node",
        role: "Cross-checks facts, eliminates hallucinations, and drafts report",
        type: "evaluator",
      },
      {
        id: "output_publisher",
        name: "Final Artifact Publisher",
        role: "Renders markdown artifact and notifies orchestrator",
        type: "terminal",
      },
    ],
    edges: [
      { from: "supervisor_router", to: "web_search_agent", condition: "needs_external_web" },
      { from: "supervisor_router", to: "codebase_analyst", condition: "needs_repo_inspection" },
      { from: "web_search_agent", to: "synthesizer" },
      { from: "codebase_analyst", to: "synthesizer" },
      { from: "synthesizer", to: "output_publisher", condition: "verification_passed" },
      { from: "synthesizer", to: "supervisor_router", condition: "missing_evidence" },
    ],
    summary:
      "Hierarchical multi-agent graph where a Supervisor orchestrates parallel search and codebase workers before synthesizing final answers.",
    prompt_content: `# Supervisor-Worker Research Graph\n\nState graph coordinating multiple specialized subagents with iterative evaluation and evidence verification.`,
    author_handle: "langchain-ai",
    category: "agents",
    topics: ["graphs", "multi-agent", "supervisor", "dag", "langgraph"],
    downloads: 112000,
    stars: 5800,
  },
  {
    id: "graph:fullstack-feature-builder",
    slug: "fullstack-feature-builder-graph",
    name: "Fullstack Feature Implementation Graph",
    graph_type: "state-machine",
    entry_node: "spec_designer",
    nodes: [
      {
        id: "spec_designer",
        name: "Specification Architect",
        role: "Designs API contracts, DB schema, and UI mockups",
        type: "planner",
      },
      {
        id: "db_migrator",
        name: "Database Engineer",
        role: "Writes SQL DDL and runs database migrations",
        type: "backend",
      },
      {
        id: "api_builder",
        name: "Backend API Builder",
        role: "Implements server queries, mutations, and REST endpoints",
        type: "backend",
      },
      {
        id: "ui_component_styler",
        name: "UI Component Specialist",
        role: "Builds responsive React components and CSS design systems",
        type: "frontend",
      },
      {
        id: "e2e_verifier",
        name: "Playwright E2E Tester",
        role: "Runs browser automation tests across full feature flow",
        type: "qa",
      },
    ],
    edges: [
      { from: "spec_designer", to: "db_migrator" },
      { from: "db_migrator", to: "api_builder" },
      { from: "api_builder", to: "ui_component_styler" },
      { from: "ui_component_styler", to: "e2e_verifier" },
      { from: "e2e_verifier", to: "spec_designer", condition: "spec_mismatch" },
    ],
    summary:
      "State machine pipeline guiding a feature from specification, database migration, API logic, UI design, to Playwright E2E testing.",
    prompt_content: `# Fullstack Feature Implementation Graph\n\nMulti-stage topology orchestrating complete end-to-end fullstack development.`,
    author_handle: "openclaw",
    category: "development",
    topics: ["graphs", "fullstack", "react", "playwright", "state-machine"],
    downloads: 94000,
    stars: 4900,
  },
  {
    id: "graph:incident-response-orchestrator",
    slug: "incident-response-orchestrator-graph",
    name: "Autonomous SRE Incident Commander Graph",
    graph_type: "dag",
    entry_node: "alarm_detector",
    nodes: [
      {
        id: "alarm_detector",
        name: "Telemetry Detector",
        role: "Ingests CloudWatch/Axiom alert webhooks",
        type: "sensor",
      },
      {
        id: "blast_radius_analyzer",
        name: "Blast Radius Assessor",
        role: "Calculates affected users, microservices, and revenue impact",
        type: "evaluator",
      },
      {
        id: "containment_actor",
        name: "Containment Worker",
        role: "Executes traffic shifting, rate limiting, or pod rollbacks",
        type: "actuator",
      },
      {
        id: "forensic_recorder",
        name: "Merkle Forensic Auditor",
        role: "Assembles immutable post-mortem timeline and evidence",
        type: "auditor",
      },
    ],
    edges: [
      { from: "alarm_detector", to: "blast_radius_analyzer" },
      { from: "blast_radius_analyzer", to: "containment_actor", condition: "severity_high" },
      { from: "containment_actor", to: "forensic_recorder" },
    ],
    summary:
      "Production incident response DAG with automated blast-radius assessment, remediation actuation, and post-mortem assembly.",
    prompt_content: `# Autonomous Incident Commander Graph\n\nSRE DAG executing containment and forensic evidence collection during live outages.`,
    author_handle: "aws",
    category: "automation",
    topics: ["graphs", "sre", "incident-commander", "containment", "cloud"],
    downloads: 67000,
    stars: 3100,
  },
];

async function main() {
  console.log("==================================================================");
  console.log("🪸 CoralNest Flow Tiers Separation Engine (Skills, Loops, Graphs)");
  console.log("==================================================================");

  // 1. Create Dedicated Tables
  console.log("1. Creating dedicated tables in CockroachDB...");

  await sql`
    CREATE TABLE IF NOT EXISTS flow_skills (
      id STRING PRIMARY KEY,
      slug STRING UNIQUE NOT NULL,
      name STRING NOT NULL,
      provider STRING NOT NULL DEFAULT 'clawhub',
      category STRING NOT NULL DEFAULT 'coding',
      topics STRING[] DEFAULT ARRAY[]::STRING[],
      summary STRING,
      prompt_content STRING,
      author_handle STRING DEFAULT 'community',
      source_repo STRING,
      downloads INT8 DEFAULT 0,
      stars INT8 DEFAULT 0,
      is_official BOOL DEFAULT false,
      raw_manifest JSONB DEFAULT '{}'::JSONB,
      created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
      updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
    );
  `;
  console.log("   ✅ Table `flow_skills` ready!");

  await sql`
    CREATE TABLE IF NOT EXISTS flow_loops (
      id STRING PRIMARY KEY,
      slug STRING UNIQUE NOT NULL,
      name STRING NOT NULL,
      loop_kind STRING NOT NULL DEFAULT 'feedback-loop',
      max_iterations INT4 NOT NULL DEFAULT 5,
      exit_criteria STRING,
      step_count INT4 NOT NULL DEFAULT 1,
      step_definitions JSONB NOT NULL DEFAULT '[]'::JSONB,
      summary STRING,
      prompt_content STRING,
      author_handle STRING DEFAULT 'openclaw',
      category STRING NOT NULL DEFAULT 'automation',
      topics STRING[] DEFAULT ARRAY[]::STRING[],
      downloads INT8 DEFAULT 0,
      stars INT8 DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
      updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
    );
  `;
  console.log("   ✅ Table `flow_loops` ready!");

  await sql`
    CREATE TABLE IF NOT EXISTS flow_graphs (
      id STRING PRIMARY KEY,
      slug STRING UNIQUE NOT NULL,
      name STRING NOT NULL,
      graph_type STRING NOT NULL DEFAULT 'dag',
      entry_node STRING,
      nodes JSONB NOT NULL DEFAULT '[]'::JSONB,
      edges JSONB NOT NULL DEFAULT '[]'::JSONB,
      summary STRING,
      prompt_content STRING,
      author_handle STRING DEFAULT 'openclaw',
      category STRING NOT NULL DEFAULT 'agents',
      topics STRING[] DEFAULT ARRAY[]::STRING[],
      downloads INT8 DEFAULT 0,
      stars INT8 DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
      updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
    );
  `;
  console.log("   ✅ Table `flow_graphs` ready!");

  // 2. Populate flow_skills from existing flows table
  console.log("\n2. Migrating skills from flows to flow_skills...");
  await sql`
    INSERT INTO flow_skills (
      id, slug, name, provider, category, topics, summary,
      prompt_content, author_handle, source_repo, downloads,
      stars, is_official, raw_manifest, created_at, updated_at
    )
    SELECT 
      id, slug, name, provider, category, topics, summary,
      prompt_content, author_handle, source_repo, downloads,
      stars, is_official, raw_manifest, created_at, updated_at
    FROM flows
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      provider = EXCLUDED.provider,
      summary = EXCLUDED.summary,
      prompt_content = EXCLUDED.prompt_content,
      category = EXCLUDED.category,
      topics = EXCLUDED.topics,
      downloads = EXCLUDED.downloads,
      stars = EXCLUDED.stars,
      updated_at = now();
  `;
  console.log("   ✅ Migrated all skills into `flow_skills`!");

  // 3. Populate flow_loops
  console.log("\n3. Ingesting rich execution loops into flow_loops...");
  for (const l of RICH_LOOPS) {
    await sql`
      INSERT INTO flow_loops (
        id, slug, name, loop_kind, max_iterations, exit_criteria,
        step_count, step_definitions, summary, prompt_content,
        author_handle, category, topics, downloads, stars, created_at, updated_at
      ) VALUES (
        ${l.id},
        ${l.slug},
        ${l.name},
        ${l.loop_kind},
        ${l.max_iterations},
        ${l.exit_criteria},
        ${l.step_count},
        ${sql.json(l.step_definitions as postgres.JSONValue)},
        ${l.summary},
        ${l.prompt_content},
        ${l.author_handle},
        ${l.category},
        ${l.topics},
        ${l.downloads},
        ${l.stars},
        now(),
        now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        loop_kind = EXCLUDED.loop_kind,
        max_iterations = EXCLUDED.max_iterations,
        exit_criteria = EXCLUDED.exit_criteria,
        step_definitions = EXCLUDED.step_definitions,
        summary = EXCLUDED.summary,
        prompt_content = EXCLUDED.prompt_content,
        updated_at = now();
    `;
  }
  console.log(`   ✅ Ingested ${RICH_LOOPS.length} Loops into \`flow_loops\`!`);

  // 4. Populate flow_graphs
  console.log("\n4. Ingesting multi-agent topology graphs into flow_graphs...");
  for (const g of RICH_GRAPHS) {
    await sql`
      INSERT INTO flow_graphs (
        id, slug, name, graph_type, entry_node, nodes, edges,
        summary, prompt_content, author_handle, category, topics,
        downloads, stars, created_at, updated_at
      ) VALUES (
        ${g.id},
        ${g.slug},
        ${g.name},
        ${g.graph_type},
        ${g.entry_node},
        ${sql.json(g.nodes as postgres.JSONValue)},
        ${sql.json(g.edges as postgres.JSONValue)},
        ${g.summary},
        ${g.prompt_content},
        ${g.author_handle},
        ${g.category},
        ${g.topics},
        ${g.downloads},
        ${g.stars},
        now(),
        now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        graph_type = EXCLUDED.graph_type,
        nodes = EXCLUDED.nodes,
        edges = EXCLUDED.edges,
        summary = EXCLUDED.summary,
        prompt_content = EXCLUDED.prompt_content,
        updated_at = now();
    `;
  }
  console.log(`   ✅ Ingested ${RICH_GRAPHS.length} Multi-Agent Graphs into \`flow_graphs\`!`);

  // 5. Final Overview
  const [skillsCount] = await sql`SELECT count(*) as count FROM flow_skills;`;
  const [loopsCount] = await sql`SELECT count(*) as count FROM flow_loops;`;
  const [graphsCount] = await sql`SELECT count(*) as count FROM flow_graphs;`;

  console.log("\n==================================================================");
  console.log("📊 THE 3 DEDICATED FLOW TIERS IN COCKROACHDB:");
  console.log(`1. flow_skills (Atomic Skills):     ${skillsCount.count} records`);
  console.log(`2. flow_loops  (Feedback Loops):    ${loopsCount.count} records`);
  console.log(`3. flow_graphs (Multi-Agent DAGs):  ${graphsCount.count} records`);
  console.log("==================================================================");

  await sql.end();
}

void main();
