/**
 * CORALNEST — Glama MCP Servers Ingestion
 *
 * Fetches ALL MCP servers from glama.ai/api/mcp/v1/servers using cursor pagination.
 * For each server:
 *   1. Fetches the README.md from the GitHub repo (real content)
 *   2. Builds a complete mcp-server.json (tools, env vars, install commands, readme)
 *   3. Uploads README.md + mcp-server.json to Backblaze B2
 *   4. Inserts lean metadata row into CockroachDB
 *
 * Source: https://glama.ai/mcp/servers
 * API:    https://glama.ai/api/mcp/v1/servers?first=100&after=<cursor>
 */
import {
  sql,
  b2Upload,
  fetchJSON,
  fetchGitHubReadme,
  computeQuality,
  extractTags,
  inferCategory,
  parseGitHubRepo,
  slug,
  sleep,
} from "./lib/ingest-utils.ts";

// ── Types ────────────────────────────────────────────────────────────────────

interface GlamaServer {
  id: string;
  slug: string;
  name: string;
  namespace: string;
  description: string;
  repository: { url: string } | null;
  spdxLicense: { name: string; url: string } | null;
  attributes: string[]; // e.g. ["hosting:remote-capable"]
  tools: { name: string; description: string; inputSchema?: object }[];
  environmentVariablesJsonSchema: {
    type: string;
    properties: Record<string, { description: string; type: string; default?: string }>;
    required: string[];
  };
  url: string;
}

interface GlamaResponse {
  pageInfo: { endCursor: string; hasNextPage: boolean; startCursor: string };
  servers: GlamaServer[];
}

// ── Core ─────────────────────────────────────────────────────────────────────

async function processServer(server: GlamaServer): Promise<void> {
  const serverSlug = slug(server.slug || server.name);
  const repoUrl = server.repository?.url ?? null;
  const ghRepo = repoUrl ? parseGitHubRepo(repoUrl) : null;

  // 1. Fetch README from GitHub
  let readme: string | null = null;
  if (ghRepo) {
    readme = await fetchGitHubReadme(ghRepo.owner, ghRepo.repo);
    await sleep(80); // respect GitHub rate limit
  }

  // 2. Determine hosting / transport
  const hosting = server.attributes.includes("hosting:remote-capable")
    ? "remote-capable"
    : server.attributes.includes("hosting:hybrid")
      ? "hybrid"
      : "local-only";
  const transport = hosting === "remote-capable" ? "http" : "stdio";

  // 3. Build env vars list
  const envProps = server.environmentVariablesJsonSchema?.properties ?? {};
  const envVars = Object.entries(envProps).map(([key, val]) => ({
    name: key,
    description: val.description,
    required: (server.environmentVariablesJsonSchema.required ?? []).includes(key),
    default: val.default ?? null,
    type: val.type,
  }));

  // 4. Generate install commands
  const npmPkg = server.namespace ? `@${server.namespace}/${serverSlug}` : serverSlug;
  const installCommands = {
    npx: `npx -y ${npmPkg}`,
    claude_mcp_add_stdio: `claude mcp add ${serverSlug} -- npx -y ${npmPkg}`,
    ...(hosting === "remote-capable" && repoUrl
      ? { claude_mcp_add_remote: `claude mcp add ${serverSlug} --transport http <SERVER_URL>` }
      : {}),
  };

  // 5. Build complete mcp-server.json
  const mcpDoc = {
    id: `mcp:glama:${server.id}`,
    slug: serverSlug,
    name: server.name,
    namespace: server.namespace,
    description: server.description ?? "",
    source: "glama",
    source_id: server.id,
    external_url: server.url,
    repo_url: repoUrl,
    transport,
    hosting,
    license: server.spdxLicense?.name ?? null,
    tools: server.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema ?? { type: "object", properties: {} },
    })),
    tools_count: server.tools.length,
    env_vars: envVars,
    env_vars_count: envVars.length,
    requires_auth: envVars.some((e) => e.required),
    install: installCommands,
    readme: readme ?? null,
    glama_url: server.url,
  };

  const mcpJson = JSON.stringify(mcpDoc, null, 2);
  const b2Prefix = `mcp/glama/${serverSlug}`;

  // 6. Upload to B2
  const {
    bytes,
    hash,
    url: storageUrl,
  } = await b2Upload(`${b2Prefix}/mcp-server.json`, mcpJson, "application/json");

  if (readme) {
    await b2Upload(`${b2Prefix}/README.md`, readme, "text/markdown; charset=utf-8");
  }

  // 7. Compute quality score
  const tags = extractTags(server.description ?? "", []);
  const category = inferCategory(server.name, server.description ?? "", tags);
  const qualityScore = computeQuality({
    hasDescription: !!server.description && server.description.length > 30,
    descriptionLength: server.description?.length ?? 0,
    hasTags: tags.length >= 2,
    tagCount: tags.length,
    hasLicense: !!server.spdxLicense,
    hasIcon: false,
    hasSourceRepo: !!repoUrl,
    hasReadme: !!readme,
    hasTools: server.tools.length > 0,
    trust: "community",
  });

  // 8. Upsert into CockroachDB
  await sql`
    INSERT INTO mcp_servers (
      id, slug, name,
      source, source_id, external_url, repo_url, namespace,
      transport, hosting,
      command,
      tools_count, requires_auth, env_vars_count,
      category, tags,
      summary, license,
      quality_score, security_score,
      storage_path, storage_url, content_hash, file_size_bytes,
      last_synced_at
    ) VALUES (
      ${"mcp:glama:" + server.id},
      ${serverSlug},
      ${server.name},
      ${"glama"}, ${server.id}, ${server.url}, ${repoUrl}, ${server.namespace ?? null},
      ${transport}, ${hosting},
      ${installCommands.npx},
      ${server.tools.length}, ${envVars.some((e) => e.required)}, ${envVars.length},
      ${category}, ${tags},
      ${(server.description ?? "").slice(0, 500)}, ${server.spdxLicense?.name ?? null},
      ${qualityScore}, ${50},
      ${b2Prefix + "/mcp-server.json"}, ${storageUrl}, ${hash}, ${bytes},
      ${new Date().toISOString()}
    )
    ON CONFLICT (slug) DO UPDATE SET
      tools_count = EXCLUDED.tools_count,
      requires_auth = EXCLUDED.requires_auth,
      quality_score = EXCLUDED.quality_score,
      storage_url = EXCLUDED.storage_url,
      content_hash = EXCLUDED.content_hash,
      file_size_bytes = EXCLUDED.file_size_bytes,
      last_synced_at = EXCLUDED.last_synced_at
  `;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================");
  console.log("🔌 GLAMA MCP SERVERS INGESTION");
  console.log("   Source: https://glama.ai/api/mcp/v1/servers");
  console.log("   Saving: mcp/glama/<slug>/mcp-server.json + README.md → B2");
  console.log("================================================================");

  let total = 0;
  let errors = 0;
  let cursor: string | undefined;
  let page = 1;

  do {
    const url = cursor
      ? `https://glama.ai/api/mcp/v1/servers?first=100&after=${encodeURIComponent(cursor)}`
      : `https://glama.ai/api/mcp/v1/servers?first=100`;

    console.log(`\n📄 Fetching page ${page} (cursor: ${cursor?.slice(0, 20) ?? "start"})...`);

    const data = await fetchJSON<GlamaResponse>(url);
    if (!data) {
      console.error("❌ Failed to fetch page, stopping.");
      break;
    }

    console.log(`   Found ${data.servers.length} servers on this page`);

    for (const server of data.servers) {
      try {
        await processServer(server);
        total++;
        process.stdout.write(`   ✅ ${total} | ${server.name.slice(0, 50).padEnd(50)}\r`);
      } catch (e: any) {
        errors++;
        console.error(`\n   ❌ Failed: ${server.slug} — ${e.message}`);
      }
      await sleep(50); // small delay between B2 uploads
    }

    cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : undefined;
    page++;

    // Rate limit courtesy pause between pages
    if (cursor) await sleep(300);
  } while (cursor);

  const dbCount = await sql`SELECT count(*) AS c FROM mcp_servers WHERE source = 'glama'`;

  console.log("\n================================================================");
  console.log("✅ GLAMA MCP INGESTION COMPLETE");
  console.log(`   Processed: ${total} servers`);
  console.log(`   Errors:    ${errors}`);
  console.log(`   DB rows:   ${dbCount[0].c} (glama source)`);
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
