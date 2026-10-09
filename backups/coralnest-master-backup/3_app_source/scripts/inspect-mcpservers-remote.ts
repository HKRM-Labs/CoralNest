async function scrapeMcpServersOrg() {
  console.log("🔍 Extracting Remote MCP Servers from mcpservers.org...");

  const res = await fetch("https://mcpservers.org/remote-mcp-servers");
  const html = await res.text();

  const serverRegex = /<a\s+href="\/remote-mcp-servers\/([a-zA-Z0-9\-_]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const servers: Array<{
    slug: string;
    name: string;
    description: string;
    logoUrl?: string;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = serverRegex.exec(html)) !== null) {
    const slug = match[1];
    const block = match[2];

    const nameMatch = /<div class="[^"]*font-semibold[^"]*">([^<]+)<\/div>/.exec(block);
    const descMatch = /<div class="[^"]*text-xs[^"]*text-zinc-500[^"]*">([^<]+)<\/div>/.exec(block);
    const imgMatch = /<img\s+src="([^"]+)"/.exec(block);

    const name = nameMatch ? nameMatch[1].trim() : slug;
    const description = descMatch
      ? descMatch[1].trim()
      : `Official remote Model Context Protocol server for ${name}.`;
    const logoUrl = imgMatch ? imgMatch[1] : undefined;

    servers.push({ slug, name, description, logoUrl });
  }

  console.log(`Discovered ${servers.length} Remote MCP Servers from mcpservers.org!`);
  if (servers.length > 0) {
    console.log("Sample extracted servers:", servers.slice(0, 5));
  }
}

void scrapeMcpServersOrg();
