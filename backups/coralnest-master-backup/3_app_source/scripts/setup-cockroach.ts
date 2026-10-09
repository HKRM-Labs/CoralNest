import { initializeCockroachSchema, sql } from "../src/db/cockroach/schema-init";

async function main() {
  console.log("🌊 Connecting to CockroachDB Serverless...");

  try {
    const [result] = await sql`SELECT 1 as connected, version() as version;`;
    console.log("✅ CockroachDB connected successfully!");
    console.log("📦 Version:", result.version);

    console.log("⚙️ Initializing CoralNest schema tables...");
    await initializeCockroachSchema();
    console.log("✅ Tables & Indexes created successfully in CockroachDB!");
  } catch (error) {
    console.error("❌ CockroachDB error:", error);
  } finally {
    await sql.end();
  }
}

void main();
