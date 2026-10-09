import { readFile } from "node:fs/promises";
import { join } from "node:path";

type PackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

async function readJson(path: string): Promise<PackageJson> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as PackageJson;
}

async function main() {
  const root = process.cwd();
  const rootPkgPath = join(root, "package.json");
  const corePkgPath = join(root, "node_modules", "@auth", "core", "package.json");

  const rootPkg = await readJson(rootPkgPath);
  const corePkg = await readJson(corePkgPath);

  const declaredRange = rootPkg.dependencies?.["@auth/core"];
  const installedVersion = corePkg.version;

  if (!declaredRange) {
    throw new Error("Missing @auth/core dependency in root package.json");
  }
  if (!installedVersion) {
    throw new Error("Missing @auth/core version in node_modules");
  }

  console.log(`peer ok: @auth/core ${installedVersion} installed`);
}

await main();
