import { createHash } from "node:crypto";
/**
 * Shared B2 + DB utilities for all CoralNest ingestion scripts.
 * Import this from any scraper script.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import postgres from "postgres";

// ── Clients ──────────────────────────────────────────────────────────────────

export const s3 = new S3Client({
  endpoint: process.env.B2_BUCKET_ENDPOINT ?? "https://s3.us-west-004.backblazeb2.com",
  region: "us-west-004",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
  forcePathStyle: true,
});

export const BUCKET = process.env.B2_BUCKET_NAME ?? "coralnest-assets";

export const sql = postgres(
  process.env.COCKROACH_DATABASE_URL ??
    "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full",
  { ssl: { rejectUnauthorized: false }, max: 8 },
);

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function slug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Upload a string file to B2. Returns bytes written. */
export async function b2Upload(
  key: string,
  content: string,
  contentType = "application/json",
): Promise<{ bytes: number; hash: string; url: string }> {
  const buf = Buffer.from(content, "utf8");
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buf,
      ContentType: contentType,
      ContentLength: buf.length,
    }),
  );
  return {
    bytes: buf.length,
    hash: sha256(content),
    url: `b2://${BUCKET}/${key}`,
  };
}

/** Fetch text from a URL with retries and optional auth. */
export async function fetchText(
  url: string,
  headers: Record<string, string> = {},
  retries = 3,
): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 404) return null;
      if (res.status === 429) {
        const wait = (i + 1) * 5000;
        await sleep(wait);
        continue;
      }
      if (!res.ok) return null;
      return await res.text();
    } catch {
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

/** Fetch JSON with retries. */
export async function fetchJSON<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T | null> {
  const text = await fetchText(url, headers);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Fetch README.md from a GitHub repo using the GitHub Contents API. */
export async function fetchGitHubReadme(owner: string, repo: string): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.raw",
    "User-Agent": "CoralNest-Ingestion/1.0",
  };
  if (GITHUB_TOKEN) headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;

  // Try README.md first, then readme.md, then README
  for (const path of ["README.md", "readme.md", "README", "docs/README.md"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
    const text = await fetchText(url, headers);
    if (text && text.length > 50) return text;
  }
  return null;
}

/** Fetch a raw file from GitHub using the Contents API (supports non-HEAD refs). */
export async function fetchGitHubFile(
  repo: string, // e.g. "aws/agent-toolkit-for-aws"
  path: string, // e.g. "skills/core-skills/amazon-bedrock/SKILL.md"
  commit: string, // e.g. "b4416ddd..."
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;
  const headers: Record<string, string> = {
    "User-Agent": "CoralNest-Ingestion/1.0",
  };
  if (GITHUB_TOKEN) headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  return fetchText(url, headers);
}

/** Auto-compute quality score (0-100) from available metadata. */
export function computeQuality(opts: {
  hasDescription: boolean;
  descriptionLength: number;
  hasTags: boolean;
  tagCount: number;
  hasLicense: boolean;
  hasIcon: boolean;
  hasSourceRepo: boolean;
  hasReadme: boolean;
  hasTools?: boolean;
  hasActions?: boolean;
  trust?: string; // 'official' | 'verified' | 'community'
}): number {
  let score = 0;
  if (opts.hasDescription && opts.descriptionLength > 30) score += 15;
  if (opts.descriptionLength > 150) score += 10;
  if (opts.hasTags && opts.tagCount >= 2) score += 10;
  if (opts.tagCount >= 5) score += 5;
  if (opts.hasLicense) score += 8;
  if (opts.hasIcon) score += 5;
  if (opts.hasSourceRepo) score += 12;
  if (opts.hasReadme) score += 15;
  if (opts.hasTools) score += 10;
  if (opts.hasActions) score += 10;
  if (opts.trust === "official") score += 20;
  else if (opts.trust === "verified") score += 10;
  return Math.min(Math.round(score), 100);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse GitHub owner/repo from a GitHub URL. */
export function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

/** Derive tags from a description string. */
export function extractTags(description: string, existing: string[] = []): string[] {
  const known = [
    "typescript",
    "python",
    "javascript",
    "go",
    "rust",
    "java",
    "react",
    "nextjs",
    "fastapi",
    "langchain",
    "langgraph",
    "autogen",
    "crewai",
    "openai",
    "anthropic",
    "claude",
    "gpt",
    "llm",
    "rag",
    "vector",
    "database",
    "sql",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "github",
    "slack",
    "discord",
    "notion",
    "jira",
    "linear",
    "aws",
    "gcp",
    "azure",
    "cloudflare",
    "vercel",
    "docker",
    "kubernetes",
    "terraform",
    "ci-cd",
    "security",
    "auth",
    "oauth",
    "api",
    "webhook",
    "rest",
    "graphql",
    "search",
    "scraping",
    "email",
    "calendar",
    "file",
    "pdf",
    "mcp",
    "agent",
    "tool",
    "workflow",
    "automation",
  ];
  const lower = description.toLowerCase();
  const found = known.filter((t) => lower.includes(t));
  return [...new Set([...existing, ...found])];
}

/** Derive category from name/description. */
export function inferCategory(name: string, description: string, tags: string[]): string {
  const t = (name + " " + description + " " + tags.join(" ")).toLowerCase();
  if (/database|sql|postgres|mysql|mongo|redis|dynamo/.test(t)) return "database";
  if (/github|git|gitlab|bitbucket|ci.?cd|deploy|build/.test(t)) return "devops";
  if (/slack|discord|teams|telegram|whatsapp|chat|message|email/.test(t)) return "communication";
  if (/search|web|browser|scraping|crawl/.test(t)) return "web";
  if (/file|filesystem|storage|s3|bucket/.test(t)) return "filesystem";
  if (/security|auth|oauth|password|vault|secret/.test(t)) return "security";
  if (/notion|jira|linear|asana|trello|calendar|todo/.test(t)) return "productivity";
  if (/aws|gcp|azure|cloud|docker|kubernetes/.test(t)) return "cloud";
  if (/payment|stripe|paypal|finance|invoice/.test(t)) return "finance";
  if (/ai|llm|openai|anthropic|claude|gpt|embedding|vector|rag/.test(t)) return "ai";
  if (/crm|salesforce|hubspot|customer/.test(t)) return "crm";
  if (/ecommerce|shopify|woocommerce|product/.test(t)) return "ecommerce";
  if (/analytics|data|metric|dashboard|report/.test(t)) return "analytics";
  return "general";
}
