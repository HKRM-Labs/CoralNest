async function checkEndpoints() {
  console.log("🔍 Checking new data sources...");

  // 1. Forward Future Loop Library
  try {
    const res = await fetch("https://signals.forwardfuture.com/loop-library/catalog.json");
    console.log(`Forward Future catalog.json: status ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(
        `Loops found in catalog.json:`,
        Array.isArray(data) ? data.length : Object.keys(data).length,
      );
    }
  } catch (e: any) {
    console.log("Error fetching loop-library catalog.json:", e.message);
  }

  // 2. Remote MCP servers API / page
  try {
    const res = await fetch("https://mcpservers.org/remote-mcp-servers");
    console.log(`mcpservers.org/remote-mcp-servers: status ${res.status}`);
  } catch (e: any) {
    console.log("Error fetching remote-mcp-servers:", e.message);
  }

  // 3. mcpservers.org Agent Skills
  try {
    const res = await fetch("https://mcpservers.org/agent-skills");
    console.log(`mcpservers.org/agent-skills: status ${res.status}`);
  } catch (e: any) {
    console.log("Error fetching agent-skills:", e.message);
  }
}

void checkEndpoints();
