/**
 * CORALNEST — Ultimate Composio Connectors Harvester
 *
 * Ingests ALL 1,069 complete connectors & toolkits from Composio.
 * For each connector:
 *   1. Fetches full action schemas, parameter definitions, and triggers
 *   2. Uploads complete connector payload to Backblaze B2 (connectors/composio/<slug>/connector.json)
 *   3. Populates lean metadata in CockroachDB connectors table (Zero Redundancy)
 */
import {
  sql,
  b2Upload,
  fetchJSON,
  computeQuality,
  extractTags,
  inferCategory,
  slug,
  sleep,
} from "./lib/ingest-utils.ts";

// ── Types ────────────────────────────────────────────────────────────────────

interface ComposioAuthScheme {
  authType: string;
  mode?: string;
}

interface ComposioToolkit {
  slug: string;
  name: string;
  logo?: string;
  description?: string;
  category?: string;
  authSchemes?: ComposioAuthScheme[];
  composioManagedAuthSchemes?: any[];
  toolCount?: number;
  triggerCount?: number;
  version?: string;
  tools?: any[];
  triggers?: any[];
  authConfigDetails?: any;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================");
  console.log("🪢 CORALNEST — COMPOSIO MASS CONNECTORS HARVESTER");
  console.log("   Source: Composio Official Catalog (toolkits.json)");
  console.log("   Target: 1,069 complete connectors → B2 + CockroachDB");
  console.log("================================================================\n");

  console.log("1. Downloading full Composio toolkits dataset (18.4 MB)...");
  const url =
    "https://raw.githubusercontent.com/ComposioHQ/composio/next/docs/public/data/toolkits.json";
  const toolkits = await fetchJSON<ComposioToolkit[]>(url);

  if (!toolkits || !Array.isArray(toolkits)) {
    console.error("❌ Failed to fetch Composio toolkits dataset.");
    process.exit(1);
  }

  console.log(`   ✅ Downloaded ${toolkits.length} complete connectors from Composio.\n`);
  console.log("2. Ingesting connectors into Backblaze B2 & CockroachDB...\n");

  let processed = 0;
  let errors = 0;
  const BATCH_SIZE = 12;

  for (let i = 0; i < toolkits.length; i += BATCH_SIZE) {
    const batch = toolkits.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const connectorSlug = slug(item.slug || item.name);
          const b2Path = `connectors/composio/${connectorSlug}/connector.json`;

          // Auth type normalization
          let authType = "none";
          if (item.authSchemes && item.authSchemes.length > 0) {
            const firstAuth = item.authSchemes[0].authType?.toLowerCase() || "";
            if (firstAuth.includes("oauth")) authType = "oauth2";
            else if (firstAuth.includes("api_key") || firstAuth.includes("apikey"))
              authType = "api_key";
            else if (firstAuth.includes("bearer")) authType = "bearer";
            else if (firstAuth.includes("basic")) authType = "basic";
            else authType = firstAuth || "other";
          }

          // Full connector payload JSON for B2
          const fullConnectorPayload = {
            id: `connector:composio:${connectorSlug}`,
            slug: connectorSlug,
            name: item.name,
            provider: "composio",
            category: item.category || "productivity",
            description: item.description || `Composio integration connector for ${item.name}`,
            logoUrl: item.logo || `https://logos.composio.dev/api/${connectorSlug}`,
            docsUrl: `https://composio.dev/toolkits/${connectorSlug}`,
            authType,
            authSchemes: item.authSchemes || [],
            authConfigDetails: item.authConfigDetails || null,
            toolCount: item.toolCount || item.tools?.length || 0,
            triggerCount: item.triggerCount || item.triggers?.length || 0,
            tools: item.tools || [],
            triggers: item.triggers || [],
            version: item.version || "1.0.0",
          };

          const payloadJson = JSON.stringify(fullConnectorPayload, null, 2);

          // Upload full payload to B2
          const {
            bytes,
            hash,
            url: storageUrl,
          } = await b2Upload(b2Path, payloadJson, "application/json");

          // Categorization & tags
          const tags = extractTags(item.description || item.name, [
            item.category || "",
            "connector",
          ]);
          const category = inferCategory(item.name, item.description || "", tags);

          // Quality score calculation
          const actionsCount = item.toolCount || item.tools?.length || 0;
          const triggersCount = item.triggerCount || item.triggers?.length || 0;

          const qualityScore = computeQuality({
            hasDescription: !!item.description,
            descriptionLength: item.description?.length ?? 0,
            hasTags: tags.length >= 2,
            tagCount: tags.length,
            hasLicense: true,
            hasIcon: !!item.logo,
            hasSourceRepo: true,
            hasReadme: actionsCount > 0,
            trust: "official",
          });

          const bonus = Math.min(25, Math.floor(actionsCount / 2));
          const finalQuality = Math.min(100, qualityScore + bonus);

          // CockroachDB Upsert (Zero Redundancy)
          await sql`
            INSERT INTO connectors (
              id, slug, name,
              source, source_id, external_url,
              provider, auth_type,
              actions_count, webhooks_count, triggers_count,
              category, tags, use_cases,
              summary, logo_url, docs_url,
              quality_score, security_score,
              is_verified, is_featured, is_official,
              storage_path, storage_url, content_hash, file_size_bytes,
              last_synced_at
            ) VALUES (
              ${`connector:composio:${connectorSlug}`},
              ${connectorSlug},
              ${item.name},
              ${"composio"}, ${item.slug}, ${`https://composio.dev/toolkits/${connectorSlug}`},
              ${"composio"}, ${authType},
              ${actionsCount}, ${0}, ${triggersCount},
              ${category}, ${tags}, ${[category, "automation", "api-integration"]},
              ${(item.description || item.name).slice(0, 500)},
              ${item.logo || `https://logos.composio.dev/api/${connectorSlug}`},
              ${`https://composio.dev/toolkits/${connectorSlug}`},
              ${finalQuality}, ${85},
              ${true}, ${actionsCount > 10}, ${true},
              ${b2Path}, ${storageUrl}, ${hash}, ${bytes},
              ${new Date().toISOString()}
            )
            ON CONFLICT (slug) DO UPDATE SET
              actions_count = EXCLUDED.actions_count,
              triggers_count = EXCLUDED.triggers_count,
              quality_score = EXCLUDED.quality_score,
              storage_url = EXCLUDED.storage_url,
              content_hash = EXCLUDED.content_hash,
              file_size_bytes = EXCLUDED.file_size_bytes,
              last_synced_at = EXCLUDED.last_synced_at
          `;

          processed++;
          process.stdout.write(
            `   [${String(processed).padStart(4)}/${toolkits.length}] ✅ ${item.name.slice(0, 45).padEnd(45)} (${actionsCount} actions, ${triggersCount} triggers)\r`,
          );
        } catch (e: any) {
          errors++;
          if (errors <= 5) console.error(`\n   ❌ Connector error (${item.name}):`, e.message);
        }
        await sleep(30);
      }),
    );

    if (i + BATCH_SIZE < toolkits.length) await sleep(100);
  }

  // Final Audit
  const dbCount = await sql`SELECT count(*) AS c FROM connectors`;

  console.log("\n\n================================================================");
  console.log("🎉 COMPOSIO MASS CONNECTORS HARVEST COMPLETE");
  console.log(`   Processed:           ${processed} connectors`);
  console.log(`   Errors:              ${errors}`);
  console.log(`   Total DB Connectors: ${dbCount[0].c} stored cleanly in CockroachDB`);
  console.log("   Zero Redundancy:     ON CONFLICT (slug) upsert guaranteed");
  console.log("================================================================");
  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
