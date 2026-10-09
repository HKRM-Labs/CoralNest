import { describe, expect, it } from "vitest";
import { resolveFrontendBuildEnv } from "./vercel-build-frontend";

describe("Vercel frontend build environment", () => {
  it("resolves preview deploy env", () => {
    const env = resolveFrontendBuildEnv({
      VERCEL_ENV: "preview",
    });

    expect(env.VITE_CLAWHUB_DEPLOY_ENV).toBe("preview");
  });

  it("resolves production deploy env", () => {
    const env = resolveFrontendBuildEnv({
      VERCEL_ENV: "production",
    });

    expect(env.VITE_CLAWHUB_DEPLOY_ENV).toBe("production");
  });

  it.each(["test", "production"])(
    "rejects %s rollout modes in an ordinary production build",
    (mode) => {
      expect(() =>
        resolveFrontendBuildEnv({
          VERCEL_ENV: "production",
          CLAWHUB_SKILLS_SH_ROLLOUT_MODE: mode,
        }),
      ).toThrow(/explicit rollout activation/i);
    },
  );

  it("treats malformed production rollout modes as off", () => {
    expect(
      resolveFrontendBuildEnv({
        VERCEL_ENV: "production",
        CLAWHUB_SKILLS_SH_ROLLOUT_MODE: "enabled",
      }).VITE_CLAWHUB_DEPLOY_ENV,
    ).toBe("production");
  });
});
