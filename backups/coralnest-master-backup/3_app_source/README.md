<p align="center">
  <img src="public/coral-logo.png" alt="CoralNest Logo" width="140">
</p>

<h1 align="center">🪸 CoralNest</h1>

<p align="center">
  <strong>The Premier Open Registry for AI Agent Flows, MCP Servers, Plugins, Connectors, and Personas</strong>
</p>

<p align="center">
  <img src="public/coral-bg.jpg" alt="CoralNest Banner" width="100%" style="border-radius: 12px; max-height: 280px; object-fit: cover;">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-0284c7.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Runtime-Bun-fbf0df?style=for-the-badge&logo=bun" alt="Bun"></a>
  <a href="https://cockroachlabs.com"><img src="https://img.shields.io/badge/Database-CockroachDB-6933ff?style=for-the-badge&logo=cockroachlabs" alt="CockroachDB"></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/Language-TypeScript-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript"></a>
</p>

---

## 🌊 Overview

**CoralNest** is a high-performance, unified public registry and marketplace for modern AI agent ecosystems. It provides discovery, versioning, semantic vector search, and distribution for prompt-based agent flows, tool servers, native plugins, external API connectors, and pre-assembled agent personas.

---

## 🏗️ Architecture & Ecosystem Layers

CoralNest organizes agent capabilities into five dedicated registries, structured in the canonical navigation hierarchy:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                PERSONAS                                  │
│  The Complete "Freelancer" / Assembled Autonomous Agent Persona          │
│  (Role, Personality, System Prompt, Boundary Rules, Identity)            │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐  │
│  │        FLOWS         │  │   MCP & CONNECTORS   │  │    PLUGINS     │  │
│  │ • Skills (Know-how)  │  │ • MCP Servers (Tools)│  │ • Pre-packaged │  │
│  │ • Loops (Iteration)  │  │ • Connectors (APIs)  │  │   Tool & Skill │  │
│  │ • Graphs (Routing)   │  │   (Access Credentials│   Bundles         │  │
│  └──────────────────────┘  └──────────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1. 🔄 Flows (`/flows`) — The Agent's Knowledge & Execution Workflows

Flows are prompt-based recipes and execution methodologies that teach agents how to perform tasks:

- **Skills (`SKILL.md`)**: Atomic prompt procedures, role guides, domain knowledge, and reference workflows (e.g. Code Reviewer, Database Optimizer, API Architect).
- **Loops**: Iterative, closed-loop execution recipes (e.g., Plan $\rightarrow$ Execute $\rightarrow$ Verify $\rightarrow$ Self-Repair).
- **Graphs**: Stateful multi-agent topologies, directed acyclic graphs (DAGs), decision trees, and routing logic across subagents.

### 2. ⚡ Model Context Protocol — MCP (`/mcp`) — Local Tooling & System Resources

- Standardized open-protocol servers providing real-time local toolkits, database query runners, filesystem managers, and terminal access to LLM agents via JSON-RPC.

### 3. 🧩 Plugins (`/plugins`) — Installable Software Bundles

- Versioned, installable software packages that bundle skills, MCP configs, CLI helpers, and environment hooks into a single distributable artifact.

### 4. 🔌 Connectors (`/connectors`) — SaaS & External Cloud Pipelines

- Managed SaaS pipelines bridging agents to third-party ecosystems (GitHub, Slack, Discord, Notion, Jira, Linear) with authenticated API credentials and webhooks.

### 5. 🎭 Personas (`/persona`) — The Complete "Freelancer" Agent Packages

- A ready-to-hire, fully assembled autonomous agent archetype. A Persona encapsulates a role, system instructions, personality, and pre-wired combinations of **Flows**, **MCP Servers**, and **Connectors**.

---

### 🧑‍💼 The "Freelancer" Talent Analogy

| Real-World Freelancer Component      | CoralNest Registry Equivalent                                   |
| :----------------------------------- | :-------------------------------------------------------------- |
| **Knowledge & Skillset**             | **Skills** (procedures and instructions in `SKILL.md`)          |
| **Work Methodology & Process**       | **Loops & Graphs** (how the agent iterates and makes decisions) |
| **Hardware & Local Toolbelt**        | **MCP Servers** (local tools, terminal, filesystem, DB drivers) |
| **Client Passwords & SaaS Access**   | **Connectors** (GitHub, Slack, Jira, Linear integrations)       |
| **Pre-Packaged Toolkit**             | **Plugins** (distribution packages)                             |
| **The Complete Specialist You Hire** | **Persona** (The fully configured, ready-to-work agent)         |

---

## 🎨 Registry Directory & Color Identity

| Order | Registry        |                      Icon Logo                      | Description                                                             |
| :---: | :-------------- | :-------------------------------------------------: | :---------------------------------------------------------------------- |
| **1** | **Flows**       | <img src="public/coral-logo-olive.png" width="28">  | Skills (`SKILL.md`), iterative loops, and multi-agent graph topologies  |
| **2** | **MCP Servers** |  <img src="public/coral-logo-red.png" width="28">   | Model Context Protocol servers for real-time local tools and resources  |
| **3** | **Plugins**     | <img src="public/coral-logo-purple.png" width="28"> | Executable code modules, WASM bundles, and extension packages           |
| **4** | **Connectors**  | <img src="public/coral-logo-orange.png" width="28"> | SaaS integrations, webhook handlers, and third-party auth tunnels       |
| **5** | **Personas**    |  <img src="public/coral-logo-pink.png" width="28">  | Complete agent archetypes and system personas with pre-configured tools |

---

## ✨ Key Features

- **Unified Flow Hub**: Seamlessly browse Skills (with category filters and trending views), Loops, and Graphs on a unified surface.
- **Embedding & Vector Search**: Vector embeddings combined with real-time vector search for semantic agent discovery.
- **Version Control & Package History**: Publish releases with semver tags (`latest`), changelogs, and atomic releases.
- **Pin & Lock Installs**: Freeze local skill/plugin versions to prevent breaking changes during auto-updates.
- **Moderation & Security Verification**: Built-in automated security scanners, staff approval flows, and permission gating.
- **CLI & REST API Integration**: CLI tool for quick terminal search, installation, version management, and remote device auth.

---

## 🛠️ Technology Stack

- **Frontend**: TanStack Start (React 19, Vite, Nitro server engine).
- **Catalog Database**: [CockroachDB Serverless](https://cockroachlabs.com) (fast SQL metadata index for all 6 registry tiers).
- **File Object Storage**: [Backblaze B2](https://www.backblaze.com/cloud-storage) (S3-compatible — stores raw SKILL.md files, OpenAPI schemas, DAG topologies, and manifests).
- **Language & Tooling**: TypeScript (Strict ESM), Bun runtime, Biome & Oxlint.

---

## 🗄️ Data Architecture

CoralNest uses a **hybrid two-layer storage model** to separate fast-indexed metadata from heavy file content:

```
┌──────────────────────────────────────────────────────────────────┐
│           CockroachDB Serverless  (Fast Metadata Index)          │
│                                                                  │
│  • slug, name, category, tags, author, stars, downloads          │
│  • storage_path  →  "skills/anthropic/react/SKILL.md"           │
│  • storage_url   →  "b2://coralnest-assets/skills/..."           │
│  • content_hash  →  SHA-256 integrity fingerprint                │
│  • file_size_bytes                                               │
│                                                                  │
│  Tables: flow_skills · flow_loops · flow_graphs                  │
│          mcp_servers · connectors · plugins · personas           │
└───────────────────────┬──────────────────────────────────────────┘
                        │ (URL pointer — no blob data in SQL)
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│          Backblaze B2  ·  bucket: coralnest-assets               │
│             (Private S3-Compatible Object Storage)               │
│                                                                  │
│  📂 skills/<author>/<slug>/SKILL.md      ← Full markdown prompts │
│  📂 loops/<slug>/LOOP.md                 ← Feedback loop recipes │
│  📂 graphs/<slug>/graph.json             ← DAG topologies (JSON) │
│  📂 mcp/<slug>/mcp-server.json           ← MCP tool schemas      │
│  📂 connectors/<slug>/openapi.json       ← OpenAPI action defs   │
│  📂 plugins/<slug>/manifest.json         ← Plugin manifests      │
└──────────────────────────────────────────────────────────────────┘
```

### Why This Split?

| Concern             | CockroachDB                         | Backblaze B2                   |
| ------------------- | ----------------------------------- | ------------------------------ |
| **Search & Filter** | ✅ SQL indexes, full-text, ORDER BY | ❌ Not searchable              |
| **Trending / Sort** | ✅ `downloads DESC`, `stars DESC`   | ❌ No sorting                  |
| **File Content**    | ❌ Inefficient as text blob         | ✅ Native object store         |
| **Cost at Scale**   | Cheap for rows, expensive for blobs | Free egress, unlimited objects |
| **Integrity Check** | Stores `content_hash`               | Serves the actual bytes        |

### Registry Data Volumes

| Table         | Rows   | What B2 Stores                                       |
| ------------- | ------ | ---------------------------------------------------- |
| `flow_skills` | 10,009 | `SKILL.md` per skill — full prompt & instructions    |
| `flow_loops`  | 90     | `LOOP.md` — exit criteria, steps, iteration rules    |
| `flow_graphs` | 3      | `graph.json` — DAG nodes, edges, routing logic       |
| `mcp_servers` | 267    | `mcp-server.json` — JSON-RPC 2.0 tool declarations   |
| `connectors`  | 1,063  | `openapi.json` — full OpenAPI action schemas         |
| `plugins`     | 1,654  | `manifest.json` — package manifest & capability spec |

---

## 💻 CLI Commands

Common CLI operations for managing your CoralNest packages:

```bash
# Authentication
coralnest login
coralnest whoami
coralnest login --device

# Discovery & Catalog Exploration
coralnest search "database automation"
coralnest explore
coralnest package inspect @coral/github-connector

# Managing Local Packages & Skills
coralnest install @coral/pdf-parser
coralnest pin pdf-parser
coralnest unpin pdf-parser
coralnest update --all
coralnest list

# Publishing Packages & Skills
coralnest skill publish ./my-skill
coralnest package publish ./my-plugin
```

---

## 🚀 Local Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (v1.1+)
- Node.js 20+

### Step-by-Step Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/astralink-hkrm/CoralNest.git
   cd CoralNest
   ```

2. **Install dependencies**:

   ```bash
   bun install --ignore-scripts
   ```

3. **Configure Environment Variables**:

   ```bash
   cp .env.local.example .env.local
   ```

4. **Start Web App**:

   ```bash
   bun run dev
   ```

   _The app will be available at `http://localhost:3000`._

---

## 🔌 Public API Access

CoralNest exposes a keyless, read-only REST API for the hosted registry (`https://clawhub.ai/api/v1/...`):

| Endpoint                   | Description                                                        |
| :------------------------- | :----------------------------------------------------------------- |
| `GET /api/v1/flows`        | List and filter flows by kind (`skills`, `loops`, `graphs`, `all`) |
| `GET /api/v1/skills`       | List/search skills (`q`, `limit`, `sort`, `family`)                |
| `GET /api/v1/skills/:name` | Fetch a single skill by name                                       |
| `GET /api/v1/trending`     | Trending skills/plugins                                            |
| `GET /api/v1/packages`     | Browse packages (`family`, `isOfficial`, `category`, `topic`)      |
| `GET /api/v1/plugins`      | Browse native code & bundle plugins                                |
| `GET /api/v1/connectors`   | List SaaS connectors                                               |
| `GET /api/v1/mcp`          | List open-source MCP servers                                       |

---

## 📁 Repository Structure

```
CoralNest/
├── src/                    # TanStack Start application (routes, components, styles)
│   ├── components/         # Shared UI components (CoralPageWrapper, Header, Footer)
│   ├── routes/             # Route pages (index, flows, mcp, plugins, connectors, persona)
│   ├── design-system.css   # Carapace design tokens & typography
│   └── styles.css          # Application layout styles
├── packages/               # Workspace packages (clawhub CLI, admin tools, schema)
├── server/                 # Server endpoints, asset handlers, and catalog routes
├── public/                 # Static assets, coral logo variants, and background images
├── docs/                   # Public documentation & guides
└── specs/                  # Product specifications & architectural intent
```

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
