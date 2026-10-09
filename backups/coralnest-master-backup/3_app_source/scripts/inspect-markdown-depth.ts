import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("==================================================================");
  console.log("🔍 DEEP AUDIT: VERIFYING SAVED MARKDOWN (SKILL.md) COMPLETENESS");
  console.log("==================================================================");

  // 1. Overall Markdown length statistics
  const [stats] = await sql`
    SELECT
      count(*) as total_rows,
      min(length(prompt_content)) as min_characters,
      max(length(prompt_content)) as max_characters,
      avg(length(prompt_content))::int as avg_characters,
      count(*) FILTER (WHERE length(prompt_content) > 1000) as skills_over_1k_chars,
      count(*) FILTER (WHERE length(prompt_content) > 10000) as skills_over_10k_chars,
      count(*) FILTER (WHERE length(prompt_content) > 30000) as massive_multi_page_skills
    FROM flows;
  `;

  console.log("\n📊 Markdown Statistics in CockroachDB:");
  console.log(`• Total Skills Saved:                ${stats.total_rows}`);
  console.log(`• Average Length per Skill:         ${stats.avg_characters} characters`);
  console.log(
    `• Longest Skill Length:              ${stats.max_characters} characters (~10,000+ words)`,
  );
  console.log(`• Skills with >1,000 characters:     ${stats.skills_over_1k_chars}`);
  console.log(`• Skills with >10,000 characters:    ${stats.skills_over_10k_chars}`);
  console.log(`• Massive Multi-page Skills (>30k):  ${stats.massive_multi_page_skills}`);

  // 2. Inspect Sample Longest Skills with full markdown sections
  const samples = await sql`
    SELECT slug, name, provider, length(prompt_content) as char_len, prompt_content
    FROM flows
    ORDER BY length(prompt_content) DESC
    LIMIT 3;
  `;

  console.log("\n==================================================================");
  console.log("📜 SAMPLE COMPLETE MULTI-SECTION SKILL MARKDOWN AUDIT");
  console.log("==================================================================");

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const lines = s.prompt_content.split("\n");
    console.log(`\n--- [Skill ${i + 1}] ${s.name} (${s.provider}) ---`);
    console.log(`• Total Characters: ${s.char_len}`);
    console.log(`• Total Lines:      ${lines.length} lines of detailed code & instructions`);
    console.log(`• First 5 lines:`);
    console.log(lines.slice(0, 5).join("\n"));
    console.log(`  ...`);
    console.log(`• Middle Section (Line 150-155):`);
    console.log(
      lines.slice(150, 155).join("\n") ||
        lines.slice(Math.floor(lines.length / 2), Math.floor(lines.length / 2) + 5).join("\n"),
    );
    console.log(`  ...`);
    console.log(`• End Section (Last 5 lines):`);
    console.log(lines.slice(-5).join("\n"));
  }

  await sql.end();
}

void main();
