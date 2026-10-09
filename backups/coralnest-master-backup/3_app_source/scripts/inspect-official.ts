export {};

async function main() {
  const res = await fetch("https://www.skills.sh/official", {
    headers: { "User-Agent": "CoralNest-Crawler/5.0" },
  });
  const html = await res.text();
  console.log("Fetched official page size:", html.length);

  // Extract all href paths
  const hrefRegex = /href=["'](\/[^"']+)["']/g;
  const hrefs: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    if (match[1].length > 3 && !match[1].startsWith("/_next") && !match[1].startsWith("/api")) {
      hrefs.push(match[1]);
    }
  }

  const uniqueHrefs = [...new Set(hrefs)];
  console.log("Found", uniqueHrefs.length, "unique paths on /official:");
  console.log(uniqueHrefs.slice(0, 30));

  // Check topics page as well
  const topicRes = await fetch("https://www.skills.sh/topics");
  if (topicRes.ok) {
    const topicHtml = await topicRes.text();
    const topicMatches = [...topicHtml.matchAll(/href=["'](\/[^"']+)["']/g)].map((m) => m[1]);
    const uniqueTopics = [...new Set(topicMatches)].filter(
      (h) => !h.startsWith("/_next") && !h.startsWith("/api") && h.length > 3,
    );
    console.log("\nFound", uniqueTopics.length, "unique paths on /topics:");
    console.log(uniqueTopics.slice(0, 30));
  }
}

void main();
