# CoralNest Master System & Data Backup Snapshot

This directory contains the **100% complete snapshot** of the CoralNest platform architecture, database, object storage bucket, and source code.

---

## 📂 Backup Repository Structure

```
backups/
├── README.md                           <-- System backup documentation & restore instructions
├── github-release-parts/               <-- 50 MB split volumes (GitHub <=100MB compliant)
│   ├── master-backup.part001.bin
│   ├── master-backup.part002.bin
│   └── ...
└── coralnest-master-backup/            <-- Uncompressed Master Backup Folder
    ├── 1_database/                     <-- CockroachDB Database Export (78,482 records)
    │   ├── cockroach-full-dump.sql     (SQL DDL schema + 78,482 INSERT statements)
    │   ├── cockroach-all-tables.json   (Full JSON database snapshot)
    │   └── tables/
    │       ├── skills.json             (71,204 rows)
    │       ├── plugins.json            (4,871 rows)
    │       ├── mcp_servers.json        (1,192 rows)
    │       ├── connectors.json         (1,074 rows)
    │       ├── loops.json              (90 rows)
    │       └── graphs.json             (51 rows)
    │
    ├── 2_bucket_storage/               <-- Backblaze B2 Bucket Storage (177,952 files)
    │   └── coralnest-b2-bucket-1.52GB-snapshot.zip
    │       ├── connectors/             (OpenAPI specs & SaaS connector JSONs)
    │       ├── graphs/                 (DAG topologies & router files)
    │       ├── loops/                  (Closed-loop verifiers & recipes)
    │       ├── mcp/                    (Glama & Community MCP server specs)
    │       ├── mcp_servers/            (MCP server manifests)
    │       ├── plugins/                (Installable tool bundles)
    │       └── skills/                 (Scraped prompt files & READMEs)
    │
    └── 3_app_source/                   <-- Full Application Source Code
        ├── src/                        (TanStack Start UI, routes, components, styles)
        ├── packages/                   (clawhub, clawhub-admin, schema)
        ├── scripts/                    (Seed scripts, scrapers, & tool suites)
        ├── public/ & docs/ & specs/    (Static web assets, docs, & system specs)
        └── package.json, bun.lock, etc. (Root configs & lockfiles)
```

---

## 📊 Summary Statistics

| Subsystem | Count / Size | Status |
| :--- | :--- | :--- |
| **CockroachDB Tables** | **6 Tables** (78,482 total records) | **100% Exported** ✅ |
| **Backblaze B2 Objects** | **177,952 Files** (1.52 GB compressed) | **100% Exported** ✅ |
| **App Source Code** | **Full Repository Code & Packages** | **100% Exported** ✅ |
| **GitHub Compatibility** | **Split into 50 MB volumes** | **GitHub Push Ready** ✅ |

---

## 🔄 Restoration Instructions

### How to Rejoin Split Volumes into Master ZIP Archive:

#### **On Windows (PowerShell):**
```powershell
# Combine all 50MB parts back into the single master zip file
Get-Content backups/github-release-parts/master-backup.part*.bin -Encoding Byte -ReadCount 0 | Set-Content backups/coralnest-master-backup-restored.zip -Encoding Byte
```

#### **On Linux / macOS (Bash):**
```bash
# Combine all parts back into the single master zip file
cat backups/github-release-parts/master-backup.part*.bin > backups/coralnest-master-backup-restored.zip
```

### How to Restore CockroachDB Database:
```bash
# Restore schema and all 78,482 records to a PostgreSQL / CockroachDB instance:
psql "postgresql://user:pass@host:26257/defaultdb?sslmode=verify-full" -f backups/coralnest-master-backup/1_database/cockroach-full-dump.sql
```
