import postgres from "postgres";

const sql = postgres(
  process.env.COCKROACH_DATABASE_URL ??
    "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full",
  { ssl: { rejectUnauthorized: false } },
);

async function main() {
  console.log("================================================================");
  console.log("🪸 CORALNEST — DATABASE ROW COUNTS VERIFICATION");
  console.log("================================================================");
  for (const t of ["skills", "loops", "graphs", "mcp_servers", "connectors", "plugins"]) {
    const r = await sql`SELECT count(*) AS c FROM ${sql(t)}`;
    console.log(`   ${t.padEnd(16)}: ${r[0].c} rows`);
  }
  console.log("================================================================");
  await sql.end();
}

void main();
