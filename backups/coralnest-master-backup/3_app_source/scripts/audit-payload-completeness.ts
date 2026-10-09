import { GetObjectCommand } from "@aws-sdk/client-s3";
import { sql, s3, BUCKET } from "./lib/ingest-utils.ts";

async function fetchB2Content(
  storageUrl: string | null,
  storagePath: string | null,
): Promise<string | null> {
  let key = storagePath;
  if (!key && storageUrl && storageUrl.startsWith("b2://")) {
    key = storageUrl.replace(`b2://${BUCKET}/`, "");
  }
  if (!key) return null;

  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return (await res.Body?.transformToString()) ?? null;
  } catch (e: any) {
    return null;
  }
}

async function main() {
  console.log("================================================================");
  console.log("🔍 CORALNEST — COMPREHENSIVE PAYLOAD COMPLETENESS AUDIT");
  console.log("   Auditing data integrity across all 6 asset tables:");
  console.log("   skills, plugins, mcp_servers, connectors, loops, graphs");
  console.log("================================================================\n");

  // 1. Audit Skills
  console.log("1. AUDITING SKILLS (Sample 15 rows)...");
  const skillSamples = await sql`
    SELECT id, slug, name, source, summary, storage_path, storage_url, file_size_bytes
    FROM skills
    ORDER BY random() LIMIT 15
  `;

  const skillResults = await Promise.all(
    skillSamples.map(async (s) => {
      const b2Data = await fetchB2Content(s.storage_url, s.storage_path);
      return { sample: s, b2Data };
    }),
  );

  let skillsWithFullCode = 0;
  let skillsTotalBytes = 0;
  for (const res of skillResults) {
    if (res.b2Data) {
      skillsTotalBytes += res.b2Data.length;
      if (
        res.b2Data.length > 300 &&
        (res.b2Data.includes("---") ||
          res.b2Data.includes("# ") ||
          res.b2Data.includes("description") ||
          res.b2Data.includes("skill"))
      ) {
        skillsWithFullCode++;
      }
    }
  }

  console.log(`   Sample size:           ${skillSamples.length}`);
  console.log(
    `   B2 Files Verified:     ${skillResults.filter((r) => r.b2Data).length}/${skillSamples.length}`,
  );
  console.log(
    `   Full Content/SKILL.md: ${skillsWithFullCode}/${skillSamples.length} (${Math.round((skillsWithFullCode / skillSamples.length) * 100)}%)`,
  );
  console.log(
    `   Avg Payload Size:      ${Math.round(skillsTotalBytes / (skillResults.filter((r) => r.b2Data).length || 1))} bytes`,
  );

  if (skillResults.length > 0 && skillResults[0].b2Data) {
    console.log(`\n   --- SAMPLE SKILL PREVIEW (${skillResults[0].sample.name}) ---`);
    console.log(
      `   Slug: ${skillResults[0].sample.slug} | Source: ${skillResults[0].sample.source}`,
    );
    console.log(
      `   Preview (first 250 chars):\n   "${skillResults[0].b2Data.slice(0, 250).replace(/\n/g, " ")}..."\n`,
    );
  }

  // 2. Audit Plugins
  console.log("2. AUDITING PLUGINS (Sample 15 rows)...");
  const pluginSamples = await sql`
    SELECT id, slug, name, source, summary, storage_path, storage_url, file_size_bytes
    FROM plugins
    ORDER BY random() LIMIT 15
  `;

  const pluginResults = await Promise.all(
    pluginSamples.map(async (p) => {
      const b2Data = await fetchB2Content(p.storage_url, p.storage_path);
      return { sample: p, b2Data };
    }),
  );

  let pluginsWithManifest = 0;
  let pluginsTotalBytes = 0;
  for (const res of pluginResults) {
    if (res.b2Data) {
      pluginsTotalBytes += res.b2Data.length;
      if (
        res.b2Data.includes('"name"') &&
        (res.b2Data.includes('"version"') ||
          res.b2Data.includes('"description"') ||
          res.b2Data.includes('"hooks"') ||
          res.b2Data.includes('"tools"'))
      ) {
        pluginsWithManifest++;
      }
    }
  }

  console.log(`   Sample size:           ${pluginSamples.length}`);
  console.log(
    `   B2 Files Verified:     ${pluginResults.filter((r) => r.b2Data).length}/${pluginSamples.length}`,
  );
  console.log(
    `   Full Manifest Payload: ${pluginsWithManifest}/${pluginSamples.length} (${Math.round((pluginsWithManifest / pluginSamples.length) * 100)}%)`,
  );
  console.log(
    `   Avg Payload Size:      ${Math.round(pluginsTotalBytes / (pluginResults.filter((r) => r.b2Data).length || 1))} bytes`,
  );

  if (pluginResults.length > 0 && pluginResults[0].b2Data) {
    console.log(`\n   --- SAMPLE PLUGIN PREVIEW (${pluginResults[0].sample.name}) ---`);
    console.log(
      `   Slug: ${pluginResults[0].sample.slug} | Source: ${pluginResults[0].sample.source}`,
    );
    console.log(
      `   Preview (first 250 chars):\n   "${pluginResults[0].b2Data.slice(0, 250).replace(/\n/g, " ")}..."\n`,
    );
  }

  // 3. Audit MCP Servers
  console.log("3. AUDITING MCP SERVERS (Sample 15 rows)...");
  const mcpSamples = await sql`
    SELECT id, slug, name, source, transport, external_url, storage_path, storage_url, file_size_bytes
    FROM mcp_servers
    ORDER BY random() LIMIT 15
  `;

  const mcpResults = await Promise.all(
    mcpSamples.map(async (m) => {
      const b2Data = await fetchB2Content(m.storage_url, m.storage_path);
      return { sample: m, b2Data };
    }),
  );

  let mcpWithFullPayload = 0;
  let mcpTotalBytes = 0;
  for (const res of mcpResults) {
    if (res.b2Data) {
      mcpTotalBytes += res.b2Data.length;
      if (res.b2Data.includes('"id"') && res.b2Data.includes('"transport"')) {
        mcpWithFullPayload++;
      }
    }
  }

  console.log(`   Sample size:           ${mcpSamples.length}`);
  console.log(
    `   B2 Files Verified:     ${mcpResults.filter((r) => r.b2Data).length}/${mcpSamples.length}`,
  );
  console.log(
    `   Full Config Payload:   ${mcpWithFullPayload}/${mcpSamples.length} (${Math.round((mcpWithFullPayload / mcpSamples.length) * 100)}%)`,
  );
  console.log(
    `   Avg Payload Size:      ${Math.round(mcpTotalBytes / (mcpResults.filter((r) => r.b2Data).length || 1))} bytes`,
  );

  if (mcpResults.length > 0 && mcpResults[0].b2Data) {
    console.log(`\n   --- SAMPLE MCP SERVER PREVIEW (${mcpResults[0].sample.name}) ---`);
    console.log(`   Slug: ${mcpResults[0].sample.slug} | Source: ${mcpResults[0].sample.source}`);
    console.log(
      `   Preview (first 250 chars):\n   "${mcpResults[0].b2Data.slice(0, 250).replace(/\n/g, " ")}..."\n`,
    );
  }

  // 4. Audit Connectors
  console.log("4. AUDITING CONNECTORS (Sample 15 rows)...");
  const connectorSamples = await sql`
    SELECT id, slug, name, source, actions_count, triggers_count, storage_path, storage_url, file_size_bytes
    FROM connectors
    ORDER BY random() LIMIT 15
  `;

  const connectorResults = await Promise.all(
    connectorSamples.map(async (c) => {
      const b2Data = await fetchB2Content(c.storage_url, c.storage_path);
      return { sample: c, b2Data };
    }),
  );

  let connectorsWithOpenAPI = 0;
  let connectorsTotalBytes = 0;
  for (const res of connectorResults) {
    if (res.b2Data) {
      connectorsTotalBytes += res.b2Data.length;
      if (
        res.b2Data.includes('"openapi"') ||
        res.b2Data.includes('"paths"') ||
        res.b2Data.includes('"tools"') ||
        res.b2Data.includes('"actions"')
      ) {
        connectorsWithOpenAPI++;
      }
    }
  }

  console.log(`   Sample size:           ${connectorSamples.length}`);
  console.log(
    `   B2 Files Verified:     ${connectorResults.filter((r) => r.b2Data).length}/${connectorSamples.length}`,
  );
  console.log(
    `   Full Tool Schemas:     ${connectorsWithOpenAPI}/${connectorSamples.length} (${Math.round((connectorsWithOpenAPI / connectorSamples.length) * 100)}%)`,
  );
  console.log(
    `   Avg Payload Size:      ${Math.round(connectorsTotalBytes / (connectorResults.filter((r) => r.b2Data).length || 1))} bytes`,
  );

  if (connectorResults.length > 0 && connectorResults[0].b2Data) {
    console.log(`\n   --- SAMPLE CONNECTOR PREVIEW (${connectorResults[0].sample.name}) ---`);
    console.log(
      `   Slug: ${connectorResults[0].sample.slug} | Source: ${connectorResults[0].sample.source}`,
    );
    console.log(
      `   Actions: ${connectorResults[0].sample.actions_count} | Triggers: ${connectorResults[0].sample.triggers_count}`,
    );
    console.log(
      `   Preview (first 300 chars):\n   "${connectorResults[0].b2Data.slice(0, 300).replace(/\n/g, " ")}..."\n`,
    );
  }

  // 5. Audit Loops
  console.log("5. AUDITING LOOPS (Sample 15 rows)...");
  const loopSamples = await sql`
    SELECT id, slug, name, source, step_count, exit_criteria, storage_path, storage_url, file_size_bytes
    FROM loops
    ORDER BY random() LIMIT 15
  `;

  const loopResults = await Promise.all(
    loopSamples.map(async (l) => {
      const b2Data = await fetchB2Content(l.storage_url, l.storage_path);
      return { sample: l, b2Data };
    }),
  );

  let loopsWithStepsAndPrompts = 0;
  let loopsTotalBytes = 0;
  for (const res of loopResults) {
    if (res.b2Data) {
      loopsTotalBytes += res.b2Data.length;
      if (
        res.b2Data.includes('"steps"') &&
        res.b2Data.includes('"prompt"') &&
        res.b2Data.includes('"verification"')
      ) {
        loopsWithStepsAndPrompts++;
      }
    }
  }

  console.log(`   Sample size:           ${loopSamples.length}`);
  console.log(
    `   B2 Files Verified:     ${loopResults.filter((r) => r.b2Data).length}/${loopSamples.length}`,
  );
  console.log(
    `   Full Steps & Prompts:  ${loopsWithStepsAndPrompts}/${loopSamples.length} (${Math.round((loopsWithStepsAndPrompts / loopSamples.length) * 100)}%)`,
  );
  console.log(
    `   Avg Payload Size:      ${Math.round(loopsTotalBytes / (loopResults.filter((r) => r.b2Data).length || 1))} bytes`,
  );

  if (loopResults.length > 0 && loopResults[0].b2Data) {
    console.log(`\n   --- SAMPLE LOOP PREVIEW (${loopResults[0].sample.name}) ---`);
    console.log(`   Slug: ${loopResults[0].sample.slug} | Source: ${loopResults[0].sample.source}`);
    console.log(
      `   Steps: ${loopResults[0].sample.step_count} | Exit Criteria: ${loopResults[0].sample.exit_criteria}`,
    );
    console.log(
      `   Preview (first 300 chars):\n   "${loopResults[0].b2Data.slice(0, 300).replace(/\n/g, " ")}..."\n`,
    );
  }

  // 6. Audit Graphs
  console.log("6. AUDITING GRAPHS (Sample 15 rows)...");
  const graphSamples = await sql`
    SELECT id, slug, name, source, node_count, edge_count, framework, storage_path, storage_url, file_size_bytes
    FROM graphs
    ORDER BY random() LIMIT 15
  `;

  const graphResults = await Promise.all(
    graphSamples.map(async (g) => {
      const b2Data = await fetchB2Content(g.storage_url, g.storage_path);
      return { sample: g, b2Data };
    }),
  );

  let graphsWithNodesAndEdges = 0;
  let graphsTotalBytes = 0;
  for (const res of graphResults) {
    if (res.b2Data) {
      graphsTotalBytes += res.b2Data.length;
      if (
        res.b2Data.includes('"nodes"') &&
        res.b2Data.includes('"edges"') &&
        res.b2Data.includes('"graphType"')
      ) {
        graphsWithNodesAndEdges++;
      }
    }
  }

  console.log(`   Sample size:           ${graphSamples.length}`);
  console.log(
    `   B2 Files Verified:     ${graphResults.filter((r) => r.b2Data).length}/${graphSamples.length}`,
  );
  console.log(
    `   Full Topology:         ${graphsWithNodesAndEdges}/${graphSamples.length} (${Math.round((graphsWithNodesAndEdges / graphSamples.length) * 100)}%)`,
  );
  console.log(
    `   Avg Payload Size:      ${Math.round(graphsTotalBytes / (graphResults.filter((r) => r.b2Data).length || 1))} bytes`,
  );

  if (graphResults.length > 0 && graphResults[0].b2Data) {
    console.log(`\n   --- SAMPLE GRAPH PREVIEW (${graphResults[0].sample.name}) ---`);
    console.log(
      `   Slug: ${graphResults[0].sample.slug} | Framework: ${graphResults[0].sample.framework}`,
    );
    console.log(
      `   Nodes: ${graphResults[0].sample.node_count} | Edges: ${graphResults[0].sample.edge_count}`,
    );
    console.log(
      `   Preview (first 300 chars):\n   "${graphResults[0].b2Data.slice(0, 300).replace(/\n/g, " ")}..."\n`,
    );
  }

  console.log("================================================================");
  console.log("🎉 AUDIT COMPLETE — ANALYSIS PROCESSED SUCCESSFULLY");
  console.log("================================================================");

  await sql.end();
}

void main().catch((e) => {
  console.error("❌ Fatal audit error:", e);
  process.exit(1);
});
