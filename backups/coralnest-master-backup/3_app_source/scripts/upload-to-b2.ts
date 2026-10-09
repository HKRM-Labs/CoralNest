import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import postgres from "postgres";

// ---------------------------------------------------------------------------
// Config — loaded from env
// ---------------------------------------------------------------------------
const B2_KEY_ID = process.env.B2_KEY_ID!;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY!;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME ?? "coralnest-assets";
const B2_BUCKET_ENDPOINT =
  process.env.B2_BUCKET_ENDPOINT ?? "https://s3.us-west-004.backblazeb2.com";
const DATABASE_URL =
  process.env.COCKROACH_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
  console.error("❌ Missing B2_KEY_ID or B2_APPLICATION_KEY in environment!");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const s3 = new S3Client({
  endpoint: B2_BUCKET_ENDPOINT,
  region: "us-west-004",
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
  },
  forcePathStyle: true, // Required for Backblaze B2 S3-compatible API
});

const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 10,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function b2PublicUrl(key: string): string {
  // Private bucket — we serve files via signed URL in prod
  // This is the canonical object path we store as storage_url
  return `b2://${B2_BUCKET_NAME}/${key}`;
}

async function upload(key: string, body: string, contentType = "text/plain; charset=utf-8") {
  const buf = Buffer.from(body, "utf8");
  await s3.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: contentType,
      ContentLength: buf.length,
    }),
  );
  return buf.length;
}

// ---------------------------------------------------------------------------
// Ensure storage columns exist
// ---------------------------------------------------------------------------
async function ensureColumns() {
  const tables = [
    "flow_skills",
    "flow_loops",
    "flow_graphs",
    "mcp_servers",
    "connectors",
    "plugins",
  ];
  for (const t of tables) {
    await sql`ALTER TABLE ${sql(t)}
      ADD COLUMN IF NOT EXISTS storage_path STRING,
      ADD COLUMN IF NOT EXISTS content_hash STRING,
      ADD COLUMN IF NOT EXISTS file_size_bytes INT8,
      ADD COLUMN IF NOT EXISTS storage_url STRING;`;
  }
  console.log("   ✅ Storage columns confirmed on all 6 tables");
}

// ---------------------------------------------------------------------------
// 1. Upload Flow Skills
// ---------------------------------------------------------------------------
async function uploadSkills() {
  console.log("\n📚 Uploading Skills → skills/<author>/<slug>/SKILL.md");
  const rows = await sql<
    {
      id: string;
      slug: string;
      author_handle: string;
      prompt_content: string;
      name: string;
      summary: string;
    }[]
  >`SELECT id, slug, author_handle, prompt_content, name, summary FROM flow_skills WHERE storage_url IS NULL OR storage_url = '' ORDER BY id`;

  let done = 0;
  const total = rows.length;
  for (const r of rows) {
    const author = (r.author_handle ?? "community").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const slug = (r.slug ?? "skill").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const key = `skills/${author}/${slug}/SKILL.md`;
    const content = r.prompt_content || `# ${r.name}\n\n${r.summary ?? ""}`;
    const hash = sha256(content);

    const bytes = await upload(key, content, "text/markdown; charset=utf-8");
    await sql`UPDATE flow_skills SET
      storage_path = ${key},
      content_hash = ${hash},
      file_size_bytes = ${bytes},
      storage_url = ${b2PublicUrl(key)}
    WHERE id = ${r.id}`;

    done++;
    if (done % 500 === 0 || done === total) {
      process.stdout.write(`   ⚡ ${done}/${total} skills uploaded...\r`);
    }
  }
  console.log(`\n   ✅ ${done} Skills uploaded to B2`);
}

// ---------------------------------------------------------------------------
// 2. Upload Flow Loops
// ---------------------------------------------------------------------------
async function uploadLoops() {
  console.log("\n🔁 Uploading Loops → loops/<slug>/LOOP.md");
  const rows = await sql<
    {
      id: string;
      slug: string;
      name: string;
      prompt_content: string;
      step_definitions: unknown;
      exit_criteria: string;
    }[]
  >`SELECT id, slug, name, prompt_content, step_definitions, exit_criteria FROM flow_loops WHERE storage_url IS NULL OR storage_url = ''`;

  let done = 0;
  for (const r of rows) {
    const slug = r.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const key = `loops/${slug}/LOOP.md`;
    const content =
      r.prompt_content ||
      `# ${r.name}\n\n**Exit Criteria**: ${r.exit_criteria}\n\n## Steps\n\`\`\`json\n${JSON.stringify(r.step_definitions, null, 2)}\n\`\`\``;
    const hash = sha256(content);
    const bytes = await upload(key, content, "text/markdown; charset=utf-8");
    await sql`UPDATE flow_loops SET
      storage_path = ${key},
      content_hash = ${hash},
      file_size_bytes = ${bytes},
      storage_url = ${b2PublicUrl(key)}
    WHERE id = ${r.id}`;
    done++;
  }
  console.log(`   ✅ ${done} Loops uploaded to B2`);
}

// ---------------------------------------------------------------------------
// 3. Upload Flow Graphs
// ---------------------------------------------------------------------------
async function uploadGraphs() {
  console.log("\n🕸️  Uploading Graphs → graphs/<slug>/graph.json");
  const rows = await sql<
    {
      id: string;
      slug: string;
      name: string;
      nodes: unknown;
      edges: unknown;
      prompt_content: string;
    }[]
  >`SELECT id, slug, name, nodes, edges, prompt_content FROM flow_graphs WHERE storage_url IS NULL OR storage_url = ''`;

  let done = 0;
  for (const r of rows) {
    const slug = r.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const key = `graphs/${slug}/graph.json`;
    const payload = JSON.stringify(
      { name: r.name, nodes: r.nodes, edges: r.edges, prompt: r.prompt_content },
      null,
      2,
    );
    const hash = sha256(payload);
    const bytes = await upload(key, payload, "application/json");
    await sql`UPDATE flow_graphs SET
      storage_path = ${key},
      content_hash = ${hash},
      file_size_bytes = ${bytes},
      storage_url = ${b2PublicUrl(key)}
    WHERE id = ${r.id}`;
    done++;
  }
  console.log(`   ✅ ${done} Graphs uploaded to B2`);
}

// ---------------------------------------------------------------------------
// 4. Upload MCP Servers
// ---------------------------------------------------------------------------
async function uploadMcpServers() {
  console.log("\n🔌 Uploading MCP Servers → mcp/<slug>/mcp-server.json");
  const rows = await sql<
    {
      id: string;
      slug: string;
      name: string;
      tools_manifest: unknown;
      command: string;
      transport: string;
    }[]
  >`SELECT id, slug, name, tools_manifest, command, transport FROM mcp_servers WHERE storage_url IS NULL OR storage_url = ''`;

  let done = 0;
  for (const r of rows) {
    const slug = r.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const key = `mcp/${slug}/mcp-server.json`;
    const payload = JSON.stringify(
      { name: r.name, transport: r.transport, command: r.command, tools: r.tools_manifest },
      null,
      2,
    );
    const hash = sha256(payload);
    const bytes = await upload(key, payload, "application/json");
    await sql`UPDATE mcp_servers SET
      storage_path = ${key},
      content_hash = ${hash},
      file_size_bytes = ${bytes},
      storage_url = ${b2PublicUrl(key)}
    WHERE id = ${r.id}`;
    done++;
  }
  console.log(`   ✅ ${done} MCP Servers uploaded to B2`);
}

// ---------------------------------------------------------------------------
// 5. Upload Connectors
// ---------------------------------------------------------------------------
async function uploadConnectors() {
  console.log("\n🔗 Uploading Connectors → connectors/<slug>/openapi.json");
  const rows = await sql<
    { id: string; slug: string; name: string; category: string; actions_schema: unknown }[]
  >`SELECT id, slug, name, category, actions_schema FROM connectors WHERE storage_url IS NULL OR storage_url = ''`;

  let done = 0;
  const total = rows.length;
  for (const r of rows) {
    const slug = r.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const key = `connectors/${slug}/openapi.json`;
    const payload = JSON.stringify(
      { name: r.name, category: r.category, actions: r.actions_schema },
      null,
      2,
    );
    const hash = sha256(payload);
    const bytes = await upload(key, payload, "application/json");
    await sql`UPDATE connectors SET
      storage_path = ${key},
      content_hash = ${hash},
      file_size_bytes = ${bytes},
      storage_url = ${b2PublicUrl(key)}
    WHERE id = ${r.id}`;
    done++;
    if (done % 100 === 0 || done === total) {
      process.stdout.write(`   ⚡ ${done}/${total} connectors uploaded...\r`);
    }
  }
  console.log(`\n   ✅ ${done} Connectors uploaded to B2`);
}

// ---------------------------------------------------------------------------
// 6. Upload Plugins
// ---------------------------------------------------------------------------
async function uploadPlugins() {
  console.log("\n🧩 Uploading Plugins → plugins/<slug>/manifest.json");
  const rows = await sql<
    { id: string; slug: string; name: string; version: string; package_manifest: unknown }[]
  >`SELECT id, slug, name, version, package_manifest FROM plugins WHERE storage_url IS NULL OR storage_url = ''`;

  let done = 0;
  const total = rows.length;
  for (const r of rows) {
    const slug = r.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const key = `plugins/${slug}/manifest.json`;
    const payload = JSON.stringify(
      { name: r.name, version: r.version, manifest: r.package_manifest },
      null,
      2,
    );
    const hash = sha256(payload);
    const bytes = await upload(key, payload, "application/json");
    await sql`UPDATE plugins SET
      storage_path = ${key},
      content_hash = ${hash},
      file_size_bytes = ${bytes},
      storage_url = ${b2PublicUrl(key)}
    WHERE id = ${r.id}`;
    done++;
    if (done % 200 === 0 || done === total) {
      process.stdout.write(`   ⚡ ${done}/${total} plugins uploaded...\r`);
    }
  }
  console.log(`\n   ✅ ${done} Plugins uploaded to B2`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const start = Date.now();
  console.log("==================================================================");
  console.log("🪣  CORALNEST → BACKBLAZE B2 UPLOAD PIPELINE");
  console.log(`   Bucket : ${B2_BUCKET_NAME}`);
  console.log(`   Region : us-west-004`);
  console.log(`   KeyID  : ${B2_KEY_ID.slice(0, 8)}...`);
  console.log("==================================================================");

  await ensureColumns();
  await uploadSkills();
  await uploadLoops();
  await uploadGraphs();
  await uploadMcpServers();
  await uploadConnectors();
  await uploadPlugins();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("\n==================================================================");
  console.log("🎉 ALL FILES UPLOADED TO BACKBLAZE B2!");
  console.log(`⏱️  Total time: ${elapsed}s`);
  console.log("📦  CockroachDB rows now carry: storage_path + content_hash + storage_url");
  console.log("==================================================================");

  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Upload failed:", e);
  process.exit(1);
});
