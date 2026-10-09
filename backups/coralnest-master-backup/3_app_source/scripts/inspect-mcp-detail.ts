async function findConfig() {
  const res = await fetch("https://mcpservers.org/remote-mcp-servers/stripe");
  const html = await res.text();

  // Search for code blocks or pre tags
  const codeBlocks = html.match(/<pre[\s\S]*?<\/pre>/gi) || [];
  console.log(`Found ${codeBlocks.length} code blocks in Stripe page.`);
  for (let i = 0; i < codeBlocks.length; i++) {
    console.log(`--- Block ${i + 1} ---`);
    console.log(codeBlocks[i].replace(/<[^>]+>/g, "").slice(0, 300));
  }

  // Look for any urls or commands
  const urls = html.match(/https?:\/\/[a-zA-Z0-9.\-_/:]*mcp[a-zA-Z0-9.\-_/:]*/gi) || [];
  console.log("\nMCP URLs found in page:", Array.from(new Set(urls)));
}

void findConfig();
