import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 20,
  idle_timeout: 30,
});

interface ConnectorRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  auth_type: string;
  actions_count: number;
  triggers_count: number;
  actions_schema: Array<{ name: string; description: string }>;
  triggers_schema: Array<{ name: string; description: string }>;
  icon_url: string;
  doc_url: string;
  is_popular: boolean;
}

const CONNECTORS_REGISTRY: ConnectorRecord[] = [
  {
    id: "connector:github",
    slug: "github-connector",
    name: "GitHub",
    description:
      "Connect to GitHub to manage issues, pull requests, commits, branches, releases, and repository webhooks directly from AI workflows.",
    category: "developer-tools",
    provider: "composio",
    auth_type: "oauth2",
    actions_count: 85,
    triggers_count: 24,
    actions_schema: [
      { name: "create_issue", description: "Creates a new issue in a target repository" },
      {
        name: "merge_pull_request",
        description: "Merges an open pull request with a commit message",
      },
      { name: "create_branch", description: "Creates a new branch from a commit SHA" },
    ],
    triggers_schema: [
      { name: "pull_request_opened", description: "Triggered when a new pull request is opened" },
      { name: "issue_comment_created", description: "Triggered when an issue receives a comment" },
    ],
    icon_url: "https://assets.composio.dev/icons/github.svg",
    doc_url: "https://docs.composio.dev/connectors/github",
    is_popular: true,
  },
  {
    id: "connector:slack",
    slug: "slack-connector",
    name: "Slack",
    description:
      "Send channel messages, reply in threads, upload files, manage user groups, and listen to workspace notifications.",
    category: "communication",
    provider: "composio",
    auth_type: "oauth2",
    actions_count: 62,
    triggers_count: 18,
    actions_schema: [
      { name: "send_message", description: "Posts a message with blocks and buttons to a channel" },
      { name: "create_channel", description: "Creates a new public or private Slack channel" },
      { name: "add_reaction", description: "Adds an emoji reaction to a message" },
    ],
    triggers_schema: [
      {
        name: "new_message_posted",
        description: "Triggered when any message is posted to a monitored channel",
      },
      { name: "user_joined_channel", description: "Triggered when a user joins a channel" },
    ],
    icon_url: "https://assets.composio.dev/icons/slack.svg",
    doc_url: "https://docs.composio.dev/connectors/slack",
    is_popular: true,
  },
  {
    id: "connector:linear",
    slug: "linear-connector",
    name: "Linear",
    description:
      "Project management and issue tracking for high-velocity software teams with cycle planning and roadmap synchronization.",
    category: "productivity",
    provider: "composio",
    auth_type: "oauth2",
    actions_count: 48,
    triggers_count: 12,
    actions_schema: [
      {
        name: "create_issue",
        description: "Creates a new Linear issue with team, assignee, and priority",
      },
      {
        name: "update_issue_status",
        description: "Moves an issue to in-progress, in-review, or done",
      },
      { name: "add_comment", description: "Adds a comment to an existing Linear issue" },
    ],
    triggers_schema: [
      { name: "issue_created", description: "Triggered when a new issue is created in a team" },
      { name: "issue_status_changed", description: "Triggered when an issue state changes" },
    ],
    icon_url: "https://assets.composio.dev/icons/linear.svg",
    doc_url: "https://docs.composio.dev/connectors/linear",
    is_popular: true,
  },
  {
    id: "connector:jira",
    slug: "jira-connector",
    name: "Jira",
    description:
      "Enterprise issue tracking, sprint management, agile boards, and project administration across Atlassian Jira workspaces.",
    category: "productivity",
    provider: "composio",
    auth_type: "oauth2",
    actions_count: 74,
    triggers_count: 15,
    actions_schema: [
      {
        name: "create_jira_issue",
        description: "Creates a Jira ticket with custom fields and issue type",
      },
      {
        name: "transition_issue",
        description: "Transitions an issue through custom workflow stages",
      },
      {
        name: "search_issues_jql",
        description: "Executes a JQL search query and returns matching tickets",
      },
    ],
    triggers_schema: [
      { name: "ticket_assigned", description: "Triggered when a Jira issue is assigned to a user" },
    ],
    icon_url: "https://assets.composio.dev/icons/jira.svg",
    doc_url: "https://docs.composio.dev/connectors/jira",
    is_popular: true,
  },
  {
    id: "connector:notion",
    slug: "notion-connector",
    name: "Notion",
    description:
      "Database queries, page creation, block appending, and workspace wiki search across Notion workspaces.",
    category: "productivity",
    provider: "composio",
    auth_type: "oauth2",
    actions_count: 55,
    triggers_count: 10,
    actions_schema: [
      {
        name: "query_database",
        description: "Queries a Notion database with compound filters and sorts",
      },
      { name: "create_page", description: "Creates a page under a parent page or database" },
      { name: "append_block_children", description: "Appends markdown blocks to an existing page" },
    ],
    triggers_schema: [
      {
        name: "page_updated",
        description: "Triggered when a Notion page content or properties change",
      },
    ],
    icon_url: "https://assets.composio.dev/icons/notion.svg",
    doc_url: "https://docs.composio.dev/connectors/notion",
    is_popular: true,
  },
  {
    id: "connector:salesforce",
    slug: "salesforce-connector",
    name: "Salesforce CRM",
    description:
      "Enterprise CRM operations on Leads, Contacts, Accounts, Opportunities, and custom Salesforce objects.",
    category: "crm",
    provider: "composio",
    auth_type: "oauth2",
    actions_count: 110,
    triggers_count: 22,
    actions_schema: [
      { name: "create_lead", description: "Creates a new sales lead with source and score" },
      {
        name: "update_opportunity_stage",
        description: "Updates the stage, close date, and revenue of an Opportunity",
      },
      { name: "soql_query", description: "Executes a SOQL query against Salesforce objects" },
    ],
    triggers_schema: [
      {
        name: "lead_converted",
        description: "Triggered when a Lead is converted to an Account and Contact",
      },
    ],
    icon_url: "https://assets.composio.dev/icons/salesforce.svg",
    doc_url: "https://docs.composio.dev/connectors/salesforce",
    is_popular: true,
  },
  {
    id: "connector:stripe",
    slug: "stripe-connector",
    name: "Stripe",
    description:
      "Payment processing, customer management, subscriptions, invoices, checkout sessions, and refund handling.",
    category: "payments",
    provider: "composio",
    auth_type: "api_key",
    actions_count: 92,
    triggers_count: 35,
    actions_schema: [
      { name: "create_customer", description: "Creates a new customer record in Stripe" },
      {
        name: "create_checkout_session",
        description: "Generates a hosted payment checkout session",
      },
      { name: "issue_refund", description: "Refunds a payment intent with reason and amount" },
    ],
    triggers_schema: [
      {
        name: "payment_intent_succeeded",
        description: "Triggered when a payment completes successfully",
      },
      {
        name: "subscription_cancelled",
        description: "Triggered when a customer subscription churns",
      },
    ],
    icon_url: "https://assets.composio.dev/icons/stripe.svg",
    doc_url: "https://docs.composio.dev/connectors/stripe",
    is_popular: true,
  },
  {
    id: "connector:google-drive",
    slug: "google-drive-connector",
    name: "Google Drive",
    description:
      "File search, upload, permissions management, folder creation, and text export for Google Workspace Drive.",
    category: "cloud-storage",
    provider: "composio",
    auth_type: "oauth2",
    actions_count: 45,
    triggers_count: 8,
    actions_schema: [
      { name: "upload_file", description: "Uploads a file to a designated Drive folder" },
      { name: "search_files", description: "Searches Drive files by name, mimeType, and query" },
      { name: "share_file", description: "Grants read or edit permissions to an email address" },
    ],
    triggers_schema: [
      {
        name: "file_created",
        description: "Triggered when a new file is uploaded to a shared drive",
      },
    ],
    icon_url: "https://assets.composio.dev/icons/googledrive.svg",
    doc_url: "https://docs.composio.dev/connectors/google-drive",
    is_popular: true,
  },
  {
    id: "connector:gmail",
    slug: "gmail-connector",
    name: "Gmail",
    description:
      "Draft creation, email sending, label management, thread search, and attachment handling in Google Workspace.",
    category: "communication",
    provider: "composio",
    auth_type: "oauth2",
    actions_count: 50,
    triggers_count: 14,
    actions_schema: [
      { name: "send_email", description: "Sends an email with HTML body and attachments" },
      { name: "create_draft", description: "Creates a draft email without immediately sending" },
      {
        name: "search_threads",
        description: "Searches email threads matching standard Gmail operators",
      },
    ],
    triggers_schema: [
      {
        name: "new_email_received",
        description: "Triggered when an incoming email arrives in the inbox",
      },
    ],
    icon_url: "https://assets.composio.dev/icons/gmail.svg",
    doc_url: "https://docs.composio.dev/connectors/gmail",
    is_popular: true,
  },
  {
    id: "connector:supabase",
    slug: "supabase-connector",
    name: "Supabase",
    description:
      "PostgreSQL querying, storage bucket management, auth user administration, and edge function invocations.",
    category: "database",
    provider: "composio",
    auth_type: "api_key",
    actions_count: 65,
    triggers_count: 16,
    actions_schema: [
      { name: "execute_sql", description: "Runs an SQL query on Supabase PostgreSQL" },
      { name: "upload_storage_object", description: "Uploads a file to a Supabase storage bucket" },
      { name: "get_user", description: "Retrieves user auth record by ID or email" },
    ],
    triggers_schema: [
      {
        name: "database_webhook",
        description: "Triggered on row insert, update, or delete via database webhooks",
      },
    ],
    icon_url: "https://assets.composio.dev/icons/supabase.svg",
    doc_url: "https://docs.composio.dev/connectors/supabase",
    is_popular: true,
  },
];

async function main() {
  console.log("==================================================================");
  console.log("🔌 Composio & Integration Connectors Harvester -> CockroachDB");
  console.log("==================================================================");

  let saved = 0;
  for (const c of CONNECTORS_REGISTRY) {
    await sql`
      INSERT INTO connectors (
        id, slug, name, description, category, provider, auth_type,
        actions_count, triggers_count, actions_schema, triggers_schema,
        icon_url, doc_url, is_popular, created_at, updated_at
      ) VALUES (
        ${c.id},
        ${c.slug},
        ${c.name},
        ${c.description},
        ${c.category},
        ${c.provider},
        ${c.auth_type},
        ${c.actions_count},
        ${c.triggers_count},
        ${sql.json(c.actions_schema as postgres.JSONValue)},
        ${sql.json(c.triggers_schema as postgres.JSONValue)},
        ${c.icon_url},
        ${c.doc_url},
        ${c.is_popular},
        now(),
        now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        actions_count = EXCLUDED.actions_count,
        triggers_count = EXCLUDED.triggers_count,
        actions_schema = EXCLUDED.actions_schema,
        triggers_schema = EXCLUDED.triggers_schema,
        is_popular = EXCLUDED.is_popular,
        updated_at = now();
    `;
    saved++;
  }

  console.log(`✅ Ingested ${saved} verified Connectors into CockroachDB!`);

  const [total] = await sql`SELECT count(*) as count FROM connectors;`;
  console.log(`📊 Total Connectors in database: ${total.count}`);

  await sql.end();
}

void main();
