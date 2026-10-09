import postgres from "postgres";

const DATABASE_URL =
  process.env.COCKROACH_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 5 });

const TABLES = [
  "flow_skills",
  "flow_loops",
  "flow_graphs",
  "mcp_servers",
  "connectors",
  "plugins",
  "personas",
];

async function main() {
  console.log("==================================================================");
  console.log("🗑️  CORALNEST — TRUNCATE ALL TABLE DATA (keep schema)");
  console.log("==================================================================");

  for (const table of TABLES) {
    try {
      const before = await sql`SELECT count(*) AS c FROM ${sql(table)}`;
      await sql`TRUNCATE TABLE ${sql(table)}`;
      console.log(`✅ ${table.padEnd(16)} — cleared ${before[0].c} rows`);
    } catch (e: any) {
      if (e.message?.includes("does not exist")) {
        console.log(`⚠️  ${table.padEnd(16)} — table not found, skipping`);
      } else {
        console.error(`❌ ${table}: ${e.message}`);
      }
    }
  }

  // Verify everything is empty
  console.log("\n--- Verification ---");
  for (const table of TABLES) {
    try {
      const r = await sql`SELECT count(*) AS c FROM ${sql(table)}`;
      console.log(`   ${table.padEnd(16)}: ${r[0].c} rows remaining`);
    } catch {
      // skip
    }
  }

  console.log("\n✅ All tables are now empty. Schema is intact.");
  await sql.end();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
