#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { parseRolloutMode } from "clawhub-schema";

export function resolveFrontendBuildEnv(env: NodeJS.ProcessEnv) {
  const targetEnvironment = env.VERCEL_TARGET_ENV?.trim() || env.VERCEL_ENV?.trim();
  if (targetEnvironment === "production") {
    const activeMode = [
      env.CLAWHUB_SKILLS_SH_ROLLOUT_MODE,
      env.CLAWHUB_GITHUB_SKILL_SYNC_ROLLOUT_MODE,
    ].find((value) => parseRolloutMode(value) !== "off");
    if (activeMode) {
      throw new Error(
        "Production skills rollout requires a separately authorized explicit rollout activation",
      );
    }
  }
  return {
    ...env,
    VITE_CLAWHUB_DEPLOY_ENV: targetEnvironment ?? "development",
  };
}

function main() {
  const result = spawnSync("bun", ["run", "build"], {
    cwd: process.cwd(),
    env: resolveFrontendBuildEnv(process.env),
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
