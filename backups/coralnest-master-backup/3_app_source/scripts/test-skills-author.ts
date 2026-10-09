async function testAuthorPage() {
  const res = await fetch("https://mcpservers.org/agent-skills/author/anthropic");
  console.log("Anthropic skills author page status:", res.status);
  const html = await res.text();
  console.log("HTML length:", html.length);

  const skillCards =
    html.match(/<a\s+href="\/agent-skills\/[a-zA-Z0-9\-_/]+"[^>]*>([\s\S]*?)<\/a>/g) || [];
  console.log(`Found ${skillCards.length} skill links on Anthropic author page.`);

  const sample = skillCards.slice(0, 3);
  for (const s of sample) {
    console.log("--- Sample Skill Link ---");
    console.log(s.slice(0, 200));
  }
}

void testAuthorPage();
