export {};

async function main() {
  console.log("🔍 Scraping and inspecting Composio Toolkits...");
  try {
    const res = await fetch("https://composio.dev/toolkits", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const html = await res.text();
    console.log("Composio HTML length:", html.length);

    // Extract all toolkit links
    const matches = [...html.matchAll(/\/toolkits\/([a-zA-Z0-9_\-]+)/g)].map((m) => m[1]);
    const uniqueToolkits = [...new Set(matches)];
    console.log(`Found ${uniqueToolkits.length} toolkits from HTML:`, uniqueToolkits.slice(0, 40));

    // Also check Python SDK / PyPI composio toolkits or Composio public registry
    const pypiRes = await fetch("https://pypi.org/pypi/composio-core/json");
    if (pypiRes.ok) {
      const pypiData = (await pypiRes.json()) as { info?: { description?: string } };
      console.log("Composio PyPI description snippet:", pypiData.info?.description?.slice(0, 300));
    }
  } catch (err) {
    console.warn("Composio inspect notice:", err);
  }
}

void main();
