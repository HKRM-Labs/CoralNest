const includeTests = process.env.KNIP_INCLUDE_TESTS === "1";

const config = {
  ignore: [
    ".artifacts/**",
    ".nitro/**",
    ".output/**",
    ".tanstack/**",
    ".vercel/**",
    "coverage/**",
    "dist/**",
    "src/routeTree.gen.ts",
    "packages/*/dist/**",
    "packages/clawhub/test-artifact/**",
  ],
  ...(includeTests
    ? {}
    : {
        ignoreFiles: [
          "**/*.test.{ts,tsx,mjs,js}",
          "**/__tests__/**",
          "src/__tests__/helpers/**",
          "packages/clawhub/test/**",
          "vitest.setup.ts",
        ],
      }),
  workspaces: {
    ".": {
      entry: [
        "src/router.tsx!",
        "src/server.ts!",
        "src/routes/**/*.{ts,tsx}!",
        "src/styles.css!",
        "src/db/**/*.{ts,tsx}!",
        "src/lib/**/*.{ts,tsx}!",
        "server/**/*.{ts,tsx}!",
        "emails/**/*.{ts,tsx}!",
        "scripts/**/*.{ts,mjs,js}!",
        "*.{config,setup}.{ts,mjs,js}!",
        ...(includeTests
          ? [
              "src/**/*.test.{ts,tsx}!",
              "src/__tests__/**/*.{ts,tsx}!",
              "emails/**/*.test.{ts,tsx}!",
              "server/**/*.test.{ts,tsx}!",
            ]
          : []),
      ],
      ignoreDependencies: [
        "@auth/core",
        "@aws-sdk/lib-storage",
        "@openclaw/plugin-inspector",
        "@react-email/components",
        "@react-email/render",
        "@fontsource/bricolage-grotesque",
        "@fontsource/ibm-plex-mono",
        "@fontsource/manrope",
        "@fontsource/noto-sans-sc",
        "mime",
        "resend",
        "tailwindcss",
        "tw-animate-css",
        "yaml",
        "zod",
      ],
      project: [
        "src/**/*.{ts,tsx}!",
        "src/**/*.css!",
        "emails/**/*.{ts,tsx}!",
        "server/**/*.{ts,tsx}!",
        "scripts/**/*.{ts,mjs,js}!",
        "*.{config,setup}.{ts,mjs,js}!",
      ],
    },
    "packages/clawhub": {
      entry: [
        "bin/clawdhub.js!",
        "scripts/build.mjs!",
        "src/cli.ts!",
        "src/http.ts!",
        "src/schema/**/*.ts!",
        "vitest*.ts!",
        ...(includeTests ? ["src/**/*.test.ts!", "test/**/*.ts!", "test-artifact/**/*.ts!"] : []),
      ],
      project: [
        "bin/**/*.js!",
        "scripts/**/*.{mjs,js,ts}!",
        "src/**/*.ts!",
        "test/**/*.ts!",
        "vitest*.ts!",
      ],
    },
    "packages/clawhub-admin": {
      entry: [
        "bin/clawhub-admin.js!",
        "scripts/build.mjs!",
        "scripts/typecheck.mjs!",
        "src/cli.ts!",
        "../clawhub/src/cli/commands/auth.ts!",
        "../clawhub/src/cli/commands/packages.ts!",
        "../clawhub/src/cli/commands/skills.ts!",
        "vitest*.ts!",
        ...(includeTests ? ["src/**/*.test.ts!"] : []),
      ],
      project: [
        "bin/**/*.js!",
        "scripts/**/*.{mjs,js,ts}!",
        "src/**/*.ts!",
        "../clawhub/src/**/*.ts!",
        "vitest*.ts!",
      ],
      ignoreDependencies: [
        "arktype",
        "fflate",
        "ignore",
        "json5",
        "mime",
        "ora",
        "p-retry",
        "semver",
        "undici",
      ],
    },
    "packages/schema": {
      entry: [
        "src/index.ts!",
        "src/licenseConstants.ts!",
        "src/routes.ts!",
        "src/textFiles.ts!",
        ...(includeTests ? ["src/**/*.test.ts!"] : []),
      ],
      project: ["src/**/*.ts!"],
    },
  },
} as const;

export default config;
