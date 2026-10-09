import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("🔍 Verifying CockroachDB live records...");

  const [total] = await sql`SELECT count(*) as total FROM flows;`;
  console.log(`✅ Total verified rows in flows table: ${total.total}`);

  // Fetch sample from skills.sh
  const skillsShSample = await sql`
    SELECT id, slug, name, provider, category, downloads, stars, length(prompt_content) as prompt_len
    FROM flows
    WHERE provider = 'skills.sh'
    ORDER BY downloads DESC
    LIMIT 3;
  `;
  console.log("\n📦 Sample Skills from Skills.sh:");
  console.table(skillsShSample);

  // Fetch sample from ClawHub
  const clawhubSample = await sql`
    SELECT id, slug, name, provider, category, downloads, stars, length(prompt_content) as prompt_len
    FROM flows
    WHERE provider = 'clawhub'
    ORDER BY downloads DESC
    LIMIT 3;
  `;
  console.log("\n📦 Sample Skills from ClawHub:");
  console.table(clawhubSample);

  await sql.end();
}

void main();
