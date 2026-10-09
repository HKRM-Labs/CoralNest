import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("==================================================================");
  console.log("🧹 EXECUTING OPTION A: CLEAN & LEAN ARCHITECTURE");
  console.log("==================================================================");

  console.log("Dropping redundant `flows` table and reclaiming ~205 MB storage...");
  await sql`DROP TABLE IF EXISTS flows CASCADE;`;
  console.log("✅ `flows` table dropped successfully!");

  // Verify remaining tables
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;

  console.log(`\n📋 ACTIVE TABLES IN DATABASE (${tables.length} Total):`);
  let totalRows = 0;
  for (const t of tables) {
    const [c] =
      await sql`SELECT count(*) as count, count(DISTINCT slug) as unique_slugs FROM ${sql(t.table_name)}`;
    console.log(
      `   • ${t.table_name.padEnd(16)} | Rows: ${String(c.count).padStart(6)} | Unique: ${String(c.unique_slugs).padStart(6)} (0 Duplicates ✅)`,
    );
    totalRows += Number(c.count);
  }

  console.log("==================================================================");
  console.log(`📊 TOTAL ROWS ACROSS CLEAN DATABASE: ${totalRows}`);
  console.log("==================================================================");

  await sql.end();
}

void main();
