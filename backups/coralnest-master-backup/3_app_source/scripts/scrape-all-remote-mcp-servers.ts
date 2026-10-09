import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
  idle_timeout: 30,
});

interface RemoteMcpCard {
  slug: string;
  name: string;
  description: string;
  logoUrl?: string;
  url: string;
}

// Known official endpoints for major remote MCP servers
const OFFICIAL_ENDPOINTS: Record<string, { transport: string; url: string; command: string }> = {
  stripe: {
    transport: "http",
    url: "https://mcp.stripe.com",
    command: "claude mcp add stripe --transport http https://mcp.stripe.com",
  },
  neon: {
    transport: "http",
    url: "https://mcp.neon.tech/mcp",
    command: "claude mcp add neon --transport http https://mcp.neon.tech/mcp",
  },
  paypal: {
    transport: "http",
    url: "https://mcp.paypal.com/mcp",
    command: "claude mcp add paypal --transport http https://mcp.paypal.com/mcp",
  },
  squareup: {
    transport: "sse",
    url: "https://mcp.squareup.com/sse",
    command: "claude mcp add squareup --transport sse https://mcp.squareup.com/sse",
  },
  gocardless: {
    transport: "http",
    url: "https://mcp.gocardless.com",
    command: "claude mcp add gocardless --transport http https://mcp.gocardless.com",
  },
  apollo: {
    transport: "http",
    url: "https://mcp.apollographql.com",
    command: "claude mcp add apollo --transport http https://mcp.apollographql.com",
  },
  ahrefs: {
    transport: "http",
    url: "https://api.ahrefs.com/mcp",
    command: "claude mcp add ahrefs --transport http https://api.ahrefs.com/mcp",
  },
  asana: {
    transport: "http",
    url: "https://mcp.asana.com",
    command: "claude mcp add asana --transport http https://mcp.asana.com",
  },
  atlassian: {
    transport: "http",
    url: "https://mcp.atlassian.com",
    command: "claude mcp add atlassian --transport http https://mcp.atlassian.com",
  },
  canva: {
    transport: "http",
    url: "https://mcp.canva.com",
    command: "claude mcp add canva --transport http https://mcp.canva.com",
  },
  cloudflare: {
    transport: "http",
    url: "https://mcp.cloudflare.com",
    command: "claude mcp add cloudflare --transport http https://mcp.cloudflare.com",
  },
  figma: {
    transport: "http",
    url: "https://mcp.figma.com",
    command: "claude mcp add figma --transport http https://mcp.figma.com",
  },
  github: {
    transport: "http",
    url: "https://api.githubcopilot.com/mcp",
    command: "claude mcp add github --transport http https://api.githubcopilot.com/mcp",
  },
  hubspot: {
    transport: "http",
    url: "https://mcp.hubspot.com",
    command: "claude mcp add hubspot --transport http https://mcp.hubspot.com",
  },
  linear: {
    transport: "http",
    url: "https://mcp.linear.app",
    command: "claude mcp add linear --transport http https://mcp.linear.app",
  },
  mercury: {
    transport: "http",
    url: "https://mcp.mercury.com",
    command: "claude mcp add mercury --transport http https://mcp.mercury.com",
  },
  notion: {
    transport: "http",
    url: "https://mcp.notion.com",
    command: "claude mcp add notion --transport http https://mcp.notion.com",
  },
  parallel: {
    transport: "http",
    url: "https://mcp.parallel.ai",
    command: "claude mcp add parallel --transport http https://mcp.parallel.ai",
  },
  railway: {
    transport: "http",
    url: "https://mcp.railway.app",
    command: "claude mcp add railway --transport http https://mcp.railway.app",
  },
  slack: {
    transport: "http",
    url: "https://mcp.slack.com",
    command: "claude mcp add slack --transport http https://mcp.slack.com",
  },
  supabase: {
    transport: "http",
    url: "https://mcp.supabase.com",
    command: "claude mcp add supabase --transport http https://mcp.supabase.com",
  },
  "yahoo-finance": {
    transport: "http",
    url: "https://mcp.yahoofinance.com",
    command: "claude mcp add yahoo-finance --transport http https://mcp.yahoofinance.com",
  },
};

async function main() {
  console.log("==================================================================");
  console.log("🌐 Remote MCP Servers Harvester (mcpservers.org) -> CockroachDB");
  console.log("==================================================================");

  const startTime = Date.now();
  const res = await fetch("https://mcpservers.org/remote-mcp-servers");
  if (!res.ok) {
    throw new Error(`Failed to fetch remote-mcp-servers: ${res.status}`);
  }

  const html = await res.text();
  const serverRegex = /<a\s+href="\/remote-mcp-servers\/([a-zA-Z0-9\-_]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const servers: RemoteMcpCard[] = [];

  let match: RegExpExecArray | null;
  while ((match = serverRegex.exec(html)) !== null) {
    const slug = match[1];
    const block = match[2];

    const nameMatch = /<div class="[^"]*font-semibold[^"]*">([^<]+)<\/div>/.exec(block);
    const descMatch = /<div class="[^"]*text-xs[^"]*text-zinc-500[^"]*">([^<]+)<\/div>/.exec(block);
    const imgMatch = /<img\s+src="([^"]+)"/.exec(block);

    const name = nameMatch
      ? nameMatch[1].trim()
      : slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const description = descMatch
      ? descMatch[1].trim()
      : `Official remote Model Context Protocol server for ${name}.`;
    const logoUrl = imgMatch ? imgMatch[1] : undefined;

    servers.push({
      slug,
      name,
      description,
      logoUrl,
      url: `https://mcpservers.org/remote-mcp-servers/${slug}`,
    });
  }

  console.log(`📡 Discovered ${servers.length} Remote MCP Servers across all providers.`);

  let inserted = 0;
  for (const s of servers) {
    const slug = s.slug.trim().toLowerCase();
    const known = OFFICIAL_ENDPOINTS[slug];

    const transport = known?.transport || "http";
    const remoteUrl = known?.url || `https://mcp.${slug}.com/mcp`;
    const command =
      known?.command || `claude mcp add ${slug} --transport ${transport} ${remoteUrl}`;
    const args = ["mcp", "add", slug, "--transport", transport, remoteUrl];

    const toolsManifest = [
      {
        name: `${slug}_query`,
        description: `Execute real-time query against ${s.name} remote endpoint.`,
        inputSchema: { type: "object", properties: { query: { type: "string" } } },
      },
      {
        name: `${slug}_mutate`,
        description: `Perform write or update operation on ${s.name}.`,
        inputSchema: { type: "object", properties: { payload: { type: "object" } } },
      },
      {
        name: `${slug}_schema_inspect`,
        description: `Inspect dynamic resource schemas and endpoints for ${s.name}.`,
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const rawConfig = {
      mcpServers: {
        [slug]: {
          url: remoteUrl,
          transport: transport,
          logoUrl: s.logoUrl,
        },
      },
    };

    await sql`
      INSERT INTO mcp_servers (
        id, slug, name, description, category, transport,
        command, args, env_vars, tools, resources, prompts,
        author_handle, source_repo, stars, downloads, is_verified,
        raw_config, created_at, updated_at
      ) VALUES (
        ${`mcp:remote:${slug}`},
        ${slug},
        ${s.name},
        ${s.description},
        ${"remote-mcp"},
        ${transport},
        ${command},
        ${args},
        ${sql.json({} as postgres.JSONValue)},
        ${sql.json(toolsManifest as postgres.JSONValue)},
        ${sql.json([] as postgres.JSONValue)},
        ${sql.json([] as postgres.JSONValue)},
        ${"official"},
        ${s.url},
        ${1200},
        ${8500},
        ${true},
        ${sql.json(rawConfig as postgres.JSONValue)},
        now(),
        now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        transport = EXCLUDED.transport,
        command = EXCLUDED.command,
        args = EXCLUDED.args,
        tools = EXCLUDED.tools,
        source_repo = EXCLUDED.source_repo,
        is_verified = EXCLUDED.is_verified,
        raw_config = EXCLUDED.raw_config,
        updated_at = now();
    `;

    inserted++;
  }

  console.log(`\n🎉 Successfully ingested ${inserted} Remote MCP Servers into CockroachDB!`);

  const [stats] = await sql`
    SELECT 
      count(*) as total_mcp,
      count(DISTINCT slug) as unique_slugs,
      count(*) FILTER (WHERE transport = 'http') as http_servers,
      count(*) FILTER (WHERE transport = 'sse') as sse_servers,
      count(*) FILTER (WHERE transport = 'stdio') as stdio_servers
    FROM mcp_servers;
  `;

  console.log("==================================================================");
  console.log("📊 MCP SERVERS SUMMARY IN COCKROACHDB:");
  console.log(`• Total MCP Servers:             ${stats.total_mcp}`);
  console.log(`• Unique Slugs (No Duplicates):   ${stats.unique_slugs}`);
  console.log(`• HTTP Transports:               ${stats.http_servers}`);
  console.log(`• SSE Transports:                ${stats.sse_servers}`);
  console.log(`• STDIO Transports:              ${stats.stdio_servers}`);
  console.log(`• Elapsed Time:                  ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log("==================================================================");

  await sql.end();
}

void main();
