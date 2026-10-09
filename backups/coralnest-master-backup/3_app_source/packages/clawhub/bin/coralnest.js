#!/usr/bin/env node
try {
  await import("../dist/cli.js");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`coralnest: failed to load CLI: ${message}`);
  process.exitCode = 1;
}
