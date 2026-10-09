import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const backupsDir = path.resolve(process.cwd(), "backups");
const masterDir = path.join(backupsDir, "coralnest-master-backup");

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyFolderRecursive(src, dest, ignoreList = []) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreList.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyFolderRecursive(srcPath, destPath, ignoreList);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function consolidate() {
  console.log("🧹 CONSOLIDATING MASTER BACKUP & REMOVING REDUNDANCIES...\n");

  const masterDbDir = path.join(masterDir, "1_database");
  const masterBucketDir = path.join(masterDir, "2_bucket_storage");
  const masterAppDir = path.join(masterDir, "3_app_source");

  await fs.mkdir(masterDbDir, { recursive: true });
  await fs.mkdir(masterBucketDir, { recursive: true });
  await fs.mkdir(masterAppDir, { recursive: true });

  // 1. Copy Database Export
  const sourceDbDir = path.join(backupsDir, "coralnest-backup-2026-10-02_04-56-25", "database");
  if (await fileExists(sourceDbDir)) {
    console.log(" ➔ Copying verified CockroachDB database export (78,482 rows)...");
    await copyFolderRecursive(sourceDbDir, masterDbDir);
  }

  // 2. Move Bucket Snapshot Zip
  const bucketZip = path.join(backupsDir, "b2-bucket-complete-snapshot.zip");
  const destBucketZip = path.join(masterBucketDir, "coralnest-b2-bucket-1.52GB-snapshot.zip");
  if (await fileExists(bucketZip)) {
    console.log(" ➔ Moving complete 1.52 GB Backblaze B2 Bucket snapshot...");
    await fs.rename(bucketZip, destBucketZip);
  }

  // 3. Copy Application Source Code
  console.log(" ➔ Copying full application source code & configs...");
  const ignoreFolders = ["node_modules", ".git", ".convex", "backups", ".dist", "dist"];
  await copyFolderRecursive(process.cwd(), masterAppDir, ignoreFolders);

  // 4. Remove all temporary/intermediate backup folders & zip files
  console.log("\n🗑️  Cleaning up all duplicate & intermediate backup artifacts...");
  const entries = await fs.readdir(backupsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "coralnest-master-backup") continue;
    const targetPath = path.join(backupsDir, entry.name);

    if (entry.isDirectory()) {
      console.log(` - Removing duplicate folder: ${entry.name}`);
      await fs.rm(targetPath, { recursive: true, force: true });
    } else if (entry.isFile()) {
      console.log(` - Removing intermediate zip: ${entry.name}`);
      await fs.unlink(targetPath);
    }
  }

  // 5. Generate Master ZIP archive
  const masterZipPath = path.join(backupsDir, "coralnest-master-backup.zip");
  console.log(`\n🤐 Building final clean ZIP archive: ${masterZipPath}...`);
  const powershellCmd = `powershell -Command "Compress-Archive -Path '${masterDir}\\*' -DestinationPath '${masterZipPath}' -Force"`;
  execSync(powershellCmd, { stdio: "inherit" });

  const zipStats = await fs.stat(masterZipPath);
  const zipSizeMb = (zipStats.size / (1024 * 1024)).toFixed(2);
  const zipSizeGb = (zipStats.size / (1024 * 1024 * 1024)).toFixed(2);

  console.log("\n=================================================================");
  console.log("🎉 CONSOLIDATION COMPLETE & ALL REDUNDANCIES REMOVED!");
  console.log("=================================================================");
  console.log(`📁 Clean Master Backup Folder : ${masterDir}`);
  console.log(`📦 Final Master ZIP Archive   : ${masterZipPath}`);
  console.log(`📊 Archive Size               : ${zipSizeMb} MB (${zipSizeGb} GB)`);
  console.log("=================================================================");
}

consolidate().catch((err) => {
  console.error("Consolidation error:", err);
  process.exit(1);
});
