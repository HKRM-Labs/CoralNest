async function inspect() {
  const jsonRes = await fetch("https://signals.forwardfuture.com/loop-library/catalog.json");
  const data = await jsonRes.json();
  console.log("Sample loop from catalog.json:", JSON.stringify(data[0] || data, null, 2));

  const mdRes = await fetch("https://signals.forwardfuture.com/loop-library/catalog.md");
  const md = await mdRes.text();
  console.log("\nSample catalog.md header (first 500 chars):\n", md.slice(0, 500));
}

void inspect();
