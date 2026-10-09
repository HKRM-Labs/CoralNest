import { fetchText } from "./lib/ingest-utils.ts";

async function main() {
  console.log("================================================================");
  console.log("🔍 SKILLS.SH SITEMAP DISCOVERY");
  console.log("================================================================");

  const sitemaps = [
    "https://www.skills.sh/sitemap-skills-1.xml",
    "https://www.skills.sh/sitemap-skills-2.xml",
  ];

  let totalUrls = 0;
  const skillsList: Array<{ owner: string; repo: string; skillSlug: string; url: string }> = [];

  for (const smUrl of sitemaps) {
    console.log(`📥 Fetching ${smUrl}...`);
    const xml = await fetchText(smUrl);
    if (!xml) {
      console.error(`❌ Failed to fetch ${smUrl}`);
      continue;
    }

    const matches = xml.match(/<loc>(https:\/\/www\.skills\.sh\/[^<]+)<\/loc>/g) || [];
    console.log(`   Found ${matches.length} skill URLs in this sitemap.`);
    totalUrls += matches.length;

    for (const m of matches) {
      const u = m.replace(/<\/?loc>/g, "");
      const parts = u.replace("https://www.skills.sh/", "").split("/");
      if (parts.length >= 3) {
        skillsList.push({
          owner: parts[0],
          repo: parts[1],
          skillSlug: parts.slice(2).join("/"),
          url: u,
        });
      }
    }
  }

  console.log("================================================================");
  console.log(`✅ Total Skill URLs discovered across skills.sh: ${skillsList.length}`);
  console.log("   Sample entries:");
  skillsList.slice(0, 10).forEach((s, i) => {
    console.log(`   ${i + 1}. [${s.owner}/${s.repo}] ${s.skillSlug} -> ${s.url}`);
  });
  console.log("================================================================");
}

void main();
