/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  maskGitHubActionsSecret,
  maskKnownWorkerSecrets,
  safeWorkerArtifactPathLabel,
} from "./workerRedaction";

describe("worker transport redaction", () => {
  it("only displays artifact paths that pass a safe allowlist", () => {
    expect(safeWorkerArtifactPathLabel("SKILL.md")).toBe("SKILL.md");
    expect(safeWorkerArtifactPathLabel("nested/package.json")).toBe("nested/package.json");
    expect(safeWorkerArtifactPathLabel("../SKILL.md")).toBe("[redacted-path]");
  });

  it("emits exact GitHub Actions masks only in GitHub Actions", () => {
    const lines: string[] = [];

    expect(
      maskGitHubActionsSecret("https://signed.example.invalid/file?token=secret", {
        env: { GITHUB_ACTIONS: "true" } as NodeJS.ProcessEnv,
        write: (line) => lines.push(line),
      }),
    ).toBe(true);
    expect(
      maskGitHubActionsSecret("a%b\nc\r", {
        env: { GITHUB_ACTIONS: "true" } as NodeJS.ProcessEnv,
        write: (line) => lines.push(line),
      }),
    ).toBe(true);
    expect(
      maskGitHubActionsSecret("local-secret", {
        env: {} as NodeJS.ProcessEnv,
        write: (line) => lines.push(line),
      }),
    ).toBe(false);

    expect(lines).toEqual([
      "::add-mask::https://signed.example.invalid/file?token=secret\n",
      "::add-mask::a%25b%0Ac%0D\n",
    ]);
  });

  it("masks known worker secrets from the runtime environment", () => {
    const lines: string[] = [];

    maskKnownWorkerSecrets(
      {
        GITHUB_ACTIONS: "true",
        OPENAI_API_KEY: "sk-runtime-secret",
        SECURITY_SCAN_WORKER_TOKEN: "worker-token-secret",
      } as NodeJS.ProcessEnv,
      (line) => lines.push(line),
    );

    expect(lines).toContain("::add-mask::sk-runtime-secret\n");
    expect(lines).toContain("::add-mask::worker-token-secret\n");
  });
});
