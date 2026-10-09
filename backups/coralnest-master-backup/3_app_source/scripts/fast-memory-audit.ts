import postgres from "postgres";

const databaseUrl =
  process.env.COCKROACH_DATABASE_URL ||
  "postgresql://saksham:zyQbCHoDwsZBgKm0HJ1flg@coralnest-db-19234.jxf.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("==================================================================");
  console.log("🔍 FAST MEMORY & TABLE AUDIT");
  console.log("==================================================================");

  // Sample 50 rows from each table to calculate average row size
  const tables = [
    "flow_skills",
    "flow_loops",
    "flow_graphs",
    "flows",
    "connectors",
    "plugins",
    "mcp_servers",
  ];

  const auditReport: Array<{
    Table: string;
    Rows: number;
    "Avg Row Size": string;
    "Total Est. Size": string;
    "Primary Purpose": string;
  }> = [];

  let totalBytes = 0;

  for (const table of tables) {
    const [countRes] = await sql`SELECT count(*) as count FROM ${sql(table)}`;
    const rowCount = Number(countRes.count);

    // Fetch 20 rows to calculate sample size
    const sampleRows = await sql`SELECT * FROM ${sql(table)} LIMIT 20`;
    let sampleSize = 0;
    for (const r of sampleRows) {
      sampleSize += Buffer.byteLength(JSON.stringify(r), "utf8");
    }
    const avgRowBytes = sampleRows.length > 0 ? Math.round(sampleSize / sampleRows.length) : 0;
    const estimatedTableBytes = Math.round(avgRowBytes * rowCount * 1.25); // +25% index overhead
    totalBytes += estimatedTableBytes;

    let purpose = "";
    if (table === "flow_skills") purpose = "Atomic skills & prompt recipes";
    else if (table === "flow_loops") purpose = "Closed feedback loops & exit criteria";
    else if (table === "flow_graphs") purpose = "Multi-agent DAGs & state machines";
    else if (table === "flows") purpose = "Unified search & catalog table";
    else if (table === "connectors") purpose = "Composio SaaS integrations (28k actions)";
    else if (table === "plugins") purpose = "ClawHub agent capability plugins";
    else if (table === "mcp_servers") purpose = "Remote & local Model Context Protocol servers";

    auditReport.push({
      Table: table,
      Rows: rowCount,
      "Avg Row Size": `${(avgRowBytes / 1024).toFixed(2)} KB`,
      "Total Est. Size": `${(estimatedTableBytes / (1024 * 1024)).toFixed(2)} MB`,
      "Primary Purpose": purpose,
    });
  }

  console.table(auditReport);

  console.log("==================================================================");
  console.log(`📊 TOTAL DATABASE MEMORY FOOTPRINT: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`🛡️ COCKROACHDB FREE TIER LIMIT:     5,000.00 MB`);
  console.log(
    `🚀 FREE HEADROOM:                   ${(5000 - totalBytes / (1024 * 1024)).toFixed(2)} MB (${((1 - totalBytes / (1024 * 1024) / 5000) * 100).toFixed(2)}% FREE)`,
  );
  console.log("==================================================================");

  await sql.end();
}

void main();
