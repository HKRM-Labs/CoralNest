/* @vitest-environment node */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

function buildDeterministicZip(files: Array<{ path: string; bytes: Uint8Array }>) {
  const zipData: Record<string, Uint8Array> = {};
  for (const file of files) {
    zipData[file.path] = file.bytes;
  }
  return zipSync(zipData);
}

function buildAgentSkillsDiscoveryDocument(input: {
  origin: string;
  ownerHandle: string;
  slug: string;
  displayName: string;
  description: string;
  digest: string;
  version: string;
}) {
  return {
    $schema: "https://agent-skills.org/schema/v1/agent-skills.json",
    skills: [
      {
        name: input.slug,
        displayName: input.displayName,
        description: input.description,
        version: input.version,
        downloadUrl: `${input.origin}/${input.ownerHandle}/skills/${input.slug}/download`,
        digest: input.digest,
      },
    ],
  };
}

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];
const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Agent Skills CLI compatibility", () => {
  it("installs a ClawHub skill page URL with the real npx skills CLI", async () => {
    const skillMarkdown = `---
name: demo
description: Demonstrates ClawHub Agent Skills discovery.
---

# Demo

Installed from a ClawHub skill page URL.
`;
    const archive = buildDeterministicZip([
      { path: "SKILL.md", bytes: new TextEncoder().encode(skillMarkdown) },
      {
        path: "references/proof.txt",
        bytes: new TextEncoder().encode("supporting file installed"),
      },
    ]);
    const digest = createHash("sha256").update(archive).digest("hex");

    const server = createServer((request, response) => {
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const url = new URL(request.url ?? "/", origin);

      if (url.pathname === "/openclaw/skills/demo/.well-known/agent-skills/index.json") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify(
            buildAgentSkillsDiscoveryDocument({
              origin,
              ownerHandle: "openclaw",
              slug: "demo",
              displayName: "Demo",
              description: "Demonstrates ClawHub Agent Skills discovery.",
              digest,
              version: "1.0.0",
            }),
          ),
        );
        return;
      }

      if (url.pathname === "/openclaw/skills/demo/download") {
        response.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="openclaw-demo-1.0.0.zip"',
        });
        response.end(archive);
        return;
      }

      response.writeHead(404);
      response.end();
    });

    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const tempDir = await mkdtemp(join(tmpdir(), "clawhub-skills-cli-"));
    tempDirs.push(tempDir);

    const result = await execFileAsync(
      "npx",
      [
        "--yes",
        "skills@1.5.16",
        "add",
        `${origin}/openclaw/skills/demo`,
        "--agent",
        "codex",
        "--copy",
        "--yes",
      ],
      { cwd: tempDir },
    );

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Added 1 skill");

    const installedSkill = await readFile(join(tempDir, ".codex/skills/demo/SKILL.md"), "utf8");
    const installedReference = await readFile(
      join(tempDir, ".codex/skills/demo/references/proof.txt"),
      "utf8",
    );

    expect(installedSkill).toContain("Installed from a ClawHub skill page URL.");
    expect(installedReference).toBe("supporting file installed");
  });
});
