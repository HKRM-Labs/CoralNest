import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
  idle_timeout: 30,
});

interface McpServerRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  transport: string;
  command: string;
  args: string[];
  env_vars: Record<string, string>;
  tools: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
  resources: Array<{ uri: string; name: string; mimeType?: string }>;
  prompts: Array<{ name: string; description: string }>;
  author_handle: string;
  source_repo?: string;
  stars: number;
  downloads: number;
  is_verified: boolean;
  raw_config: Record<string, unknown>;
}

const MCP_REGISTRY: McpServerRecord[] = [
  {
    id: "mcp:server:postgres",
    slug: "postgres-mcp-server",
    name: "PostgreSQL MCP Server",
    description:
      "Read-only and read-write SQL query execution, schema inspection, and table analysis for PostgreSQL databases.",
    category: "database",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/db"],
    env_vars: { DATABASE_URL: "postgresql://..." },
    tools: [
      { name: "query", description: "Execute a read-only SQL query against the database" },
      { name: "list_tables", description: "List all tables in the public schema" },
      {
        name: "describe_table",
        description: "Get the column definitions and constraints for a table",
      },
    ],
    resources: [{ uri: "postgres://schema", name: "Database Schema" }],
    prompts: [
      { name: "optimize-query", description: "Analyze and optimize an expensive SQL query" },
    ],
    author_handle: "modelcontextprotocol",
    source_repo: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    stars: 3200,
    downloads: 145000,
    is_verified: true,
    raw_config: {
      transport: "stdio",
      command: "npx",
      package: "@modelcontextprotocol/server-postgres",
    },
  },
  {
    id: "mcp:server:filesystem",
    slug: "filesystem-mcp-server",
    name: "Filesystem MCP Server",
    description:
      "Secure local filesystem operations with configurable allowed directory paths, file reading, writing, and tree listing.",
    category: "filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
    env_vars: {},
    tools: [
      { name: "read_file", description: "Read the full contents of a file" },
      { name: "write_file", description: "Create or overwrite a file with content" },
      {
        name: "list_directory",
        description: "List files and directories within an allowed folder",
      },
      { name: "directory_tree", description: "Generate a recursive tree structure of a directory" },
    ],
    resources: [{ uri: "file://allowed-path", name: "Workspace Root" }],
    prompts: [
      {
        name: "explore-project",
        description: "Inspect directory structure and project architecture",
      },
    ],
    author_handle: "modelcontextprotocol",
    source_repo: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    stars: 4100,
    downloads: 280000,
    is_verified: true,
    raw_config: {
      transport: "stdio",
      command: "npx",
      package: "@modelcontextprotocol/server-filesystem",
    },
  },
  {
    id: "mcp:server:github",
    slug: "github-mcp-server",
    name: "GitHub MCP Server",
    description:
      "Repository exploration, issue triage, pull request management, code search, and branch manipulation via GitHub REST and GraphQL APIs.",
    category: "developer-tools",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env_vars: { GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_..." },
    tools: [
      {
        name: "search_repositories",
        description: "Search for GitHub repositories by name or topic",
      },
      { name: "create_issue", description: "Create a new issue in a GitHub repository" },
      { name: "create_pull_request", description: "Create a pull request from a feature branch" },
      { name: "get_file_contents", description: "Retrieve the contents of a file from any branch" },
    ],
    resources: [{ uri: "github://repo/issues", name: "Repository Issues" }],
    prompts: [{ name: "review-pr", description: "Conduct a comprehensive review of a GitHub PR" }],
    author_handle: "modelcontextprotocol",
    source_repo: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    stars: 5800,
    downloads: 390000,
    is_verified: true,
    raw_config: {
      transport: "stdio",
      command: "npx",
      package: "@modelcontextprotocol/server-github",
    },
  },
  {
    id: "mcp:server:brave-search",
    slug: "brave-search-mcp-server",
    name: "Brave Web Search MCP Server",
    description:
      "Privacy-preserving web search and local location search powered by the Brave Search API.",
    category: "search",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env_vars: { BRAVE_API_KEY: "BSA_..." },
    tools: [
      {
        name: "brave_web_search",
        description: "Execute a web search query and return top ranking results with snippets",
      },
      {
        name: "brave_local_search",
        description: "Search for local businesses, places, and coordinates",
      },
    ],
    resources: [],
    prompts: [
      { name: "deep-research", description: "Perform multi-query deep web research on a topic" },
    ],
    author_handle: "modelcontextprotocol",
    source_repo: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    stars: 2900,
    downloads: 210000,
    is_verified: true,
    raw_config: {
      transport: "stdio",
      command: "npx",
      package: "@modelcontextprotocol/server-brave-search",
    },
  },
  {
    id: "mcp:server:slack",
    slug: "slack-mcp-server",
    name: "Slack Integration MCP Server",
    description:
      "Channel listing, message posting, thread reading, and reaction management for Slack workspaces.",
    category: "communication",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    env_vars: { SLACK_BOT_TOKEN: "xoxb-...", SLACK_TEAM_ID: "T0..." },
    tools: [
      { name: "post_message", description: "Send a formatted message to a Slack channel" },
      {
        name: "list_channels",
        description: "List all public and private channels in the workspace",
      },
      {
        name: "get_channel_history",
        description: "Fetch recent messages and replies from a channel",
      },
    ],
    resources: [{ uri: "slack://channels", name: "Active Channels" }],
    prompts: [
      {
        name: "summarize-channel",
        description: "Summarize the key discussions and action items in a channel",
      },
    ],
    author_handle: "modelcontextprotocol",
    source_repo: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    stars: 2100,
    downloads: 120000,
    is_verified: true,
    raw_config: {
      transport: "stdio",
      command: "npx",
      package: "@modelcontextprotocol/server-slack",
    },
  },
  {
    id: "mcp:server:sqlite",
    slug: "sqlite-mcp-server",
    name: "SQLite Local MCP Server",
    description:
      "Lightweight, zero-config embedded SQL database inspection and query execution on local SQLite files.",
    category: "database",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path", "app.db"],
    env_vars: {},
    tools: [
      { name: "read_query", description: "Execute a SELECT query against the SQLite database" },
      { name: "write_query", description: "Execute an INSERT/UPDATE/DELETE statement" },
      { name: "list_tables", description: "List all tables in the SQLite database" },
    ],
    resources: [{ uri: "sqlite://schema", name: "SQLite Schema" }],
    prompts: [
      {
        name: "schema-inspector",
        description: "Inspect tables and suggest normalization improvements",
      },
    ],
    author_handle: "modelcontextprotocol",
    source_repo: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
    stars: 3400,
    downloads: 195000,
    is_verified: true,
    raw_config: { transport: "stdio", command: "uvx", package: "mcp-server-sqlite" },
  },
  {
    id: "mcp:server:puppeteer",
    slug: "puppeteer-mcp-server",
    name: "Puppeteer Browser Automation MCP Server",
    description:
      "Headless Chrome browser automation for webpage navigation, screenshots, form filling, and DOM evaluation.",
    category: "automation",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    env_vars: {},
    tools: [
      { name: "navigate", description: "Navigate browser to any URL" },
      { name: "screenshot", description: "Capture a full-page or element screenshot" },
      { name: "click", description: "Click an interactive element on the page" },
      { name: "evaluate_script", description: "Run JavaScript in the browser page context" },
    ],
    resources: [],
    prompts: [{ name: "web-testing", description: "Test a web flow and assert DOM elements" }],
    author_handle: "modelcontextprotocol",
    source_repo: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
    stars: 4800,
    downloads: 310000,
    is_verified: true,
    raw_config: {
      transport: "stdio",
      command: "npx",
      package: "@modelcontextprotocol/server-puppeteer",
    },
  },
  {
    id: "mcp:server:docker",
    slug: "docker-mcp-server",
    name: "Docker Container Management MCP Server",
    description:
      "Inspect running Docker containers, stream container logs, manage networks, and trigger build workflows.",
    category: "devops",
    transport: "stdio",
    command: "npx",
    args: ["-y", "mcp-server-docker"],
    env_vars: { DOCKER_HOST: "unix:///var/run/docker.sock" },
    tools: [
      { name: "list_containers", description: "List all active and stopped Docker containers" },
      { name: "get_logs", description: "Fetch stdout/stderr logs from a container" },
      { name: "restart_container", description: "Restart a specified container" },
    ],
    resources: [{ uri: "docker://containers", name: "Running Containers" }],
    prompts: [
      {
        name: "diagnose-container",
        description: "Inspect container logs and diagnose crash loops",
      },
    ],
    author_handle: "docker",
    source_repo: "https://github.com/docker/mcp-server",
    stars: 2600,
    downloads: 160000,
    is_verified: true,
    raw_config: { transport: "stdio", command: "npx", package: "mcp-server-docker" },
  },
  {
    id: "mcp:server:aws",
    slug: "aws-toolkit-mcp-server",
    name: "AWS Toolkit MCP Server",
    description:
      "Interact with AWS CloudWatch logs, ECS services, S3 buckets, and Lambda functions directly from LLMs.",
    category: "cloud",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@aws/mcp-server-aws"],
    env_vars: { AWS_REGION: "us-east-1", AWS_PROFILE: "default" },
    tools: [
      { name: "query_cloudwatch", description: "Run CloudWatch Insights queries on log groups" },
      { name: "list_s3_objects", description: "List keys and metadata in an S3 bucket" },
      { name: "invoke_lambda", description: "Invoke an AWS Lambda function with a JSON payload" },
    ],
    resources: [{ uri: "aws://cloudwatch/logs", name: "CloudWatch Log Streams" }],
    prompts: [
      { name: "triage-alarm", description: "Triage CloudWatch alarm events and recommend fixes" },
    ],
    author_handle: "aws",
    source_repo: "https://github.com/aws/agent-toolkit-for-aws",
    stars: 4200,
    downloads: 240000,
    is_verified: true,
    raw_config: { transport: "stdio", command: "npx", package: "@aws/mcp-server-aws" },
  },
  {
    id: "mcp:server:redis",
    slug: "redis-mcp-server",
    name: "Redis Key-Value MCP Server",
    description:
      "Key-value inspection, TTL management, pub/sub monitoring, and cache clearing for Redis instances.",
    category: "database",
    transport: "stdio",
    command: "npx",
    args: ["-y", "mcp-server-redis", "redis://localhost:6379"],
    env_vars: { REDIS_URL: "redis://localhost:6379" },
    tools: [
      { name: "get_key", description: "Fetch the string, hash, or list value of a key" },
      { name: "set_key", description: "Set a key with an optional TTL expiration" },
      { name: "list_keys", description: "Scan keys matching a pattern" },
    ],
    resources: [{ uri: "redis://keyspace", name: "Keyspace Overview" }],
    prompts: [
      { name: "cache-invalidation", description: "Audit cache TTLs and identify hot keys" },
    ],
    author_handle: "redis",
    source_repo: "https://github.com/redis/mcp-server-redis",
    stars: 1800,
    downloads: 98000,
    is_verified: true,
    raw_config: { transport: "stdio", command: "npx", package: "mcp-server-redis" },
  },
];

async function main() {
  console.log("==================================================================");
  console.log("🔌 Model Context Protocol (MCP) Server Ingestion -> CockroachDB");
  console.log("==================================================================");

  let saved = 0;
  for (const mcp of MCP_REGISTRY) {
    await sql`
      INSERT INTO mcp_servers (
        id, slug, name, description, category, transport, command,
        args, env_vars, tools, resources, prompts, author_handle,
        source_repo, stars, downloads, is_verified, raw_config,
        created_at, updated_at
      ) VALUES (
        ${mcp.id},
        ${mcp.slug},
        ${mcp.name},
        ${mcp.description},
        ${mcp.category},
        ${mcp.transport},
        ${mcp.command},
        ${mcp.args},
        ${sql.json(mcp.env_vars as postgres.JSONValue)},
        ${sql.json(mcp.tools as postgres.JSONValue)},
        ${sql.json(mcp.resources as postgres.JSONValue)},
        ${sql.json(mcp.prompts as postgres.JSONValue)},
        ${mcp.author_handle},
        ${mcp.source_repo ?? null},
        ${mcp.stars},
        ${mcp.downloads},
        ${mcp.is_verified},
        ${sql.json(mcp.raw_config as postgres.JSONValue)},
        now(),
        now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        tools = EXCLUDED.tools,
        resources = EXCLUDED.resources,
        prompts = EXCLUDED.prompts,
        stars = EXCLUDED.stars,
        downloads = EXCLUDED.downloads,
        is_verified = EXCLUDED.is_verified,
        raw_config = EXCLUDED.raw_config,
        updated_at = now();
    `;
    saved++;
  }

  console.log(`✅ Ingested ${saved} verified MCP Servers into CockroachDB!`);

  const [total] = await sql`SELECT count(*) as count FROM mcp_servers;`;
  console.log(`📊 Total MCP Servers in database: ${total.count}`);

  await sql.end();
}

void main();
