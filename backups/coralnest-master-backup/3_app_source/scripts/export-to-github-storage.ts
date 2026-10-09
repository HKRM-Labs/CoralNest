import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
});

const ROOT_STORAGE = join(process.cwd(), "storage");
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/AstralLink/CoralNest/main/storage";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function main() {
  console.log("==================================================================");
  console.log("🐙 GITHUB SUBFOLDER BUCKET EXPORTER & COCKROACHDB SYNC ENGINE");
  console.log("==================================================================");

  const startTime = Date.now();

  // 1. Ensure Schema Columns in CockroachDB
  console.log("1. Adding storage reference columns to CockroachDB tables...");
  const tables = [
    "flow_skills",
    "flow_loops",
    "flow_graphs",
    "mcp_servers",
    "connectors",
    "plugins",
  ];
  for (const t of tables) {
    await sql`
      ALTER TABLE ${sql(t)} 
      ADD COLUMN IF NOT EXISTS storage_path STRING,
      ADD COLUMN IF NOT EXISTS content_hash STRING,
      ADD COLUMN IF NOT EXISTS file_size_bytes INT8,
      ADD COLUMN IF NOT EXISTS storage_url STRING;
    `;
  }
  console.log("   ✅ Storage columns active on all 6 tables!");

  // 2. Create Base Directories
  console.log("2. Creating storage folder structure...");
  await mkdir(join(ROOT_STORAGE, "skills"), { recursive: true });
  await mkdir(join(ROOT_STORAGE, "loops"), { recursive: true });
  await mkdir(join(ROOT_STORAGE, "graphs"), { recursive: true });
  await mkdir(join(ROOT_STORAGE, "mcp"), { recursive: true });
  await mkdir(join(ROOT_STORAGE, "connectors"), { recursive: true });
  await mkdir(join(ROOT_STORAGE, "plugins"), { recursive: true });

  // ---------------------------------------------------------------------------
  // 3. Export Flow Skills -> storage/skills/<author>/<slug>/SKILL.md
  // ---------------------------------------------------------------------------
  console.log("\n3. Exporting Skills to `storage/skills/<author>/<slug>/SKILL.md`...");
  const skills =
    await sql`SELECT id, slug, author_handle, prompt_content, name, category, summary FROM flow_skills;`;
  let skillCount = 0;

  for (const s of skills) {
    const author = (s.author_handle || "community").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const slug = (s.slug || "skill").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const skillDir = join(ROOT_STORAGE, "skills", author, slug);
    await mkdir(skillDir, { recursive: true });

    const filePath = join(skillDir, "SKILL.md");
    const relPath = `storage/skills/${author}/${slug}/SKILL.md`;
    const content = s.prompt_content || `# ${s.name}\n\n${s.summary || ""}`;
    const hash = sha256(content);
    const byteSize = Buffer.byteLength(content, "utf8");

    await writeFile(filePath, content, "utf8");

    await sql`
      UPDATE flow_skills SET
        storage_path = ${relPath},
        content_hash = ${hash},
        file_size_bytes = ${byteSize},
        storage_url = ${`${GITHUB_RAW_BASE}/skills/${author}/${slug}/SKILL.md`}
      WHERE id = ${s.id};
    `;
    skillCount++;
    if (skillCount % 500 === 0 || skillCount === skills.length) {
      process.stdout.write(`   ⚡ Processed: ${skillCount}/${skills.length} skills...\r`);
    }
  }
  console.log(`\n   ✅ Exported ${skillCount} Skills to GitHub storage!`);

  // ---------------------------------------------------------------------------
  // 4. Export Flow Loops -> storage/loops/<slug>/LOOP.md
  // ---------------------------------------------------------------------------
  console.log("\n4. Exporting Feedback Loops to `storage/loops/<slug>/LOOP.md`...");
  const loops =
    await sql`SELECT id, slug, name, prompt_content, step_definitions, exit_criteria FROM flow_loops;`;
  let loopCount = 0;

  for (const l of loops) {
    const slug = l.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const loopDir = join(ROOT_STORAGE, "loops", slug);
    await mkdir(loopDir, { recursive: true });

    const filePath = join(loopDir, "LOOP.md");
    const relPath = `storage/loops/${slug}/LOOP.md`;
    const content =
      l.prompt_content ||
      `# ${l.name}\n\n**Exit Criteria**: ${l.exit_criteria}\n\n## Steps\n${JSON.stringify(l.step_definitions, null, 2)}`;
    const hash = sha256(content);
    const byteSize = Buffer.byteLength(content, "utf8");

    await writeFile(filePath, content, "utf8");

    await sql`
      UPDATE flow_loops SET
        storage_path = ${relPath},
        content_hash = ${hash},
        file_size_bytes = ${byteSize},
        storage_url = ${`${GITHUB_RAW_BASE}/loops/${slug}/LOOP.md`}
      WHERE id = ${l.id};
    `;
    loopCount++;
  }
  console.log(`   ✅ Exported ${loopCount} Loops to GitHub storage!`);

  // ---------------------------------------------------------------------------
  // 5. Export Flow Graphs -> storage/graphs/<slug>/graph.json
  // ---------------------------------------------------------------------------
  console.log("\n5. Exporting Multi-Agent Graphs to `storage/graphs/<slug>/graph.json`...");
  const graphs = await sql`SELECT id, slug, name, nodes, edges, prompt_content FROM flow_graphs;`;
  let graphCount = 0;

  for (const g of graphs) {
    const slug = g.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const graphDir = join(ROOT_STORAGE, "graphs", slug);
    await mkdir(graphDir, { recursive: true });

    const filePath = join(graphDir, "graph.json");
    const relPath = `storage/graphs/${slug}/graph.json`;
    const payload = JSON.stringify(
      { name: g.name, nodes: g.nodes, edges: g.edges, prompt: g.prompt_content },
      null,
      2,
    );
    const hash = sha256(payload);
    const byteSize = Buffer.byteLength(payload, "utf8");

    await writeFile(filePath, payload, "utf8");

    await sql`
      UPDATE flow_graphs SET
        storage_path = ${relPath},
        content_hash = ${hash},
        file_size_bytes = ${byteSize},
        storage_url = ${`${GITHUB_RAW_BASE}/graphs/${slug}/graph.json`}
      WHERE id = ${g.id};
    `;
    graphCount++;
  }
  console.log(`   ✅ Exported ${graphCount} Graphs to GitHub storage!`);

  // ---------------------------------------------------------------------------
  // 6. Export MCP Servers -> storage/mcp/<slug>/mcp-server.json
  // ---------------------------------------------------------------------------
  console.log("\n6. Exporting MCP Servers to `storage/mcp/<slug>/mcp-server.json`...");
  const mcps = await sql`SELECT id, slug, name, tools, raw_config, command FROM mcp_servers;`;
  let mcpCount = 0;

  for (const m of mcps) {
    const slug = m.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const mcpDir = join(ROOT_STORAGE, "mcp", slug);
    await mkdir(mcpDir, { recursive: true });

    const filePath = join(mcpDir, "mcp-server.json");
    const relPath = `storage/mcp/${slug}/mcp-server.json`;
    const payload = JSON.stringify(
      { name: m.name, command: m.command, tools: m.tools, config: m.raw_config },
      null,
      2,
    );
    const hash = sha256(payload);
    const byteSize = Buffer.byteLength(payload, "utf8");

    await writeFile(filePath, payload, "utf8");

    await sql`
      UPDATE mcp_servers SET
        storage_path = ${relPath},
        content_hash = ${hash},
        file_size_bytes = ${byteSize},
        storage_url = ${`${GITHUB_RAW_BASE}/mcp/${slug}/mcp-server.json`}
      WHERE id = ${m.id};
    `;
    mcpCount++;
  }
  console.log(`   ✅ Exported ${mcpCount} MCP Servers to GitHub storage!`);

  // ---------------------------------------------------------------------------
  // 7. Export Connectors -> storage/connectors/<slug>/openapi.json
  // ---------------------------------------------------------------------------
  console.log("\n7. Exporting Composio Connectors to `storage/connectors/<slug>/openapi.json`...");
  const connectors = await sql`SELECT id, slug, name, actions_schema, category FROM connectors;`;
  let connectorCount = 0;

  for (const c of connectors) {
    const slug = c.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const connDir = join(ROOT_STORAGE, "connectors", slug);
    await mkdir(connDir, { recursive: true });

    const filePath = join(connDir, "openapi.json");
    const relPath = `storage/connectors/${slug}/openapi.json`;
    const payload = JSON.stringify(
      { name: c.name, category: c.category, actions: c.actions_schema },
      null,
      2,
    );
    const hash = sha256(payload);
    const byteSize = Buffer.byteLength(payload, "utf8");

    await writeFile(filePath, payload, "utf8");

    await sql`
      UPDATE connectors SET
        storage_path = ${relPath},
        content_hash = ${hash},
        file_size_bytes = ${byteSize},
        storage_url = ${`${GITHUB_RAW_BASE}/connectors/${slug}/openapi.json`}
      WHERE id = ${c.id};
    `;
    connectorCount++;
  }
  console.log(`   ✅ Exported ${connectorCount} Connectors to GitHub storage!`);

  // ---------------------------------------------------------------------------
  // 8. Export Plugins -> storage/plugins/<slug>/manifest.json
  // ---------------------------------------------------------------------------
  console.log("\n8. Exporting ClawHub Plugins to `storage/plugins/<slug>/manifest.json`...");
  const plugins = await sql`SELECT id, slug, name, package_manifest, version FROM plugins;`;
  let pluginCount = 0;

  for (const p of plugins) {
    const slug = p.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const pluginDir = join(ROOT_STORAGE, "plugins", slug);
    await mkdir(pluginDir, { recursive: true });

    const filePath = join(pluginDir, "manifest.json");
    const relPath = `storage/plugins/${slug}/manifest.json`;
    const payload = JSON.stringify(
      { name: p.name, version: p.version, manifest: p.package_manifest },
      null,
      2,
    );
    const hash = sha256(payload);
    const byteSize = Buffer.byteLength(payload, "utf8");

    await writeFile(filePath, payload, "utf8");

    await sql`
      UPDATE plugins SET
        storage_path = ${relPath},
        content_hash = ${hash},
        file_size_bytes = ${byteSize},
        storage_url = ${`${GITHUB_RAW_BASE}/plugins/${slug}/manifest.json`}
      WHERE id = ${p.id};
    `;
    pluginCount++;
  }
  console.log(`   ✅ Exported ${pluginCount} Plugins to GitHub storage!`);

  console.log("\n==================================================================");
  console.log("🎉 GITHUB SUBFOLDER STORAGE EXPORT COMPLETE!");
  console.log(`• Total Skills Exported:       ${skillCount}`);
  console.log(`• Total Loops Exported:        ${loopCount}`);
  console.log(`• Total Graphs Exported:       ${graphCount}`);
  console.log(`• Total MCP Servers Exported:  ${mcpCount}`);
  console.log(`• Total Connectors Exported:   ${connectorCount}`);
  console.log(`• Total Plugins Exported:      ${pluginCount}`);
  console.log(`• Elapsed Time:                ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log("==================================================================");

  await sql.end();
}

void main();
