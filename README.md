<div align="center">

# 🏗️ Coordination Intelligence System (CIS)

### Real-Time Multidisciplinary AEC Construction Coordination & AI Blast-Radius Harmonizer

**Unifying Architecture, Structural, MEP, and General Contracting workflows with deterministic dependency graphing and generative AI intelligence.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.1-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-5.0-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-00E599?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F7DF1E?style=for-the-badge)](LICENSE)

[Overview](#-executive-summary--problem-space) • [Architecture](#-system-architecture--dataflow) • [Capabilities](#-core-intelligence-capabilities) • [Flagship Project](#-flagship-scenario-riverside-mixed-use-development) • [Data Schema](#-data-schema--dual-persistence-strategy) • [API Reference](#-api-specification--endpoints) • [Quickstart](#-quickstart--local-setup) • [Deployment](#-cloud-deployment-guide-vercel--render)

</div>

---

## 📖 Executive Summary & Problem Space

Modern commercial construction and architectural developments represent some of the most complex, distributed human coordination challenges in industry:

* **Multidisciplinary Fragmentation**: Projects involve dozens of autonomous stakeholders—developers, architects, structural engineers, MEP consultants, general contractors, specialized subcontractors, and municipal inspectors.
* **Information Disconnect**: Critical project information is dispersed across unindexed email threads, WhatsApp chats, phone calls, markups on outdated PDFs, and disconnected spreadsheets.
* **The "Coordination Black Hole"**: When an inevitable site event occurs—such as a laser-scan deviation on a post-tensioned slab sleeve or a geotechnical foundation revision—traditional workflows fail to identify ripple effects across disciplines until trade crews physically arrive on site.
* **Compound Construction Failure**: Late-stage clash detection results in expensive physical rework, crane standby downtime, emergency redesigns, trade disputes, and compounding schedule delays.

### Traditional AEC Coordination vs. Coordination Intelligence System

| Dimension | Traditional Construction Coordination | Coordination Intelligence System (CIS) |
|---|---|---|
| **Change Signal Detection** | Buried in personal notes, site logs, or instant messages. | Ingested as plain-language signals with automated entity extraction. |
| **Impact & Blast Radius** | Manual review of 2D/3D sheets; takes 3–7 business days. | **Deterministic Graph Traversal + Gemini AI** calculates full blast radius in **under 2 seconds**. |
| **Trade Notification** | Ad-hoc emails and missed CC chains. | Automated stakeholder RACI mapping; targeted high-priority alerts to affected trade owners. |
| **Corrective Mitigation** | Unassigned meeting minutes with ambiguous ownership. | Auto-generated corrective tasks and approval workflows with assigned owners and deadlines. |
| **Institutional Memory** | Lost in personal mailboxes or buried in document vaults. | **Immutable, descending chronological Project Memory ledger** preserving full decision rationale. |

---

## 🏛️ System Architecture & Dataflow

CIS employs a **two-stage hybrid intelligence architecture**:
1. **Deterministic Graph Engine**: Operates over directed dependency edges (`requires`, `blocks`, `informs`) to identify true topological precedents and downstream dependents. This eliminates AI hallucinations regarding physical or sequence dependencies.
2. **Generative AI Layer (Google Gemini 2.5 Flash)**: Evaluates the verified graph nodes against the logged site deviation, estimating schedule slippage, monetary risk exposure, qualitative severity, and synthesizing mitigation actions.

### Architecture Layers

* **Client Presentation Tier (Port 3000)**: Built with React 19, Vite 7, and Tailwind CSS v4. Delivers the operational radar dashboard, interactive work register, signal ingestion modal, SVG dependency graph, multidisciplinary RACI matrix, immutable project memory ledger, and RAG copilot chat interface. State is managed with TanStack React Query v5 and contextual session providers.
* **API Gateway & Security Tier (Port 5000)**: Express 5 HTTP REST services providing CORS handling, session crypto, role-based access control (RBAC), and structured Pino audit logging across `/api/auth/*` and `/api/coordination/*` endpoints.
* **Coordination Intelligence Core**: Contains the deterministic graph traversal engine (DAG topological search) and the Google Gemini 2.5 Flash AI integration (`@google/generative-ai`) for blast radius impact assessment, action proposal drafting, and RAG context grounding.
* **Hybrid Persistence Tier**: Connects primarily to Neon Serverless PostgreSQL via HTTP connection pooling (`@neondatabase/serverless`) with Drizzle ORM schemas, and automatically fails over to a resilient local JSON file store (`server/data/store.json`) when running offline or without database credentials.

---

## 🏙️ Flagship Scenario: Riverside Mixed-Use Development

The application is pre-seeded with a comprehensive, realistic multi-million dollar flagship project:

* **Project Overview**:
  * **Retail Podium** (Levels 1–3): Commercial retail, dining promenade, anchor grocery.
  * **Tower A** (24 Floors): 140 luxury residential condominium units.
  * **Tower B** (24 Floors): 120 residential units with cantilevered architectural terraces.
  * **Subterranean Structure** (Levels B1–B3): 380 parking stalls, central MEP plant, retention vault.
* **Pre-Loaded Records**: 40+ interrelated physical work packages, active critical paths, lead contracts, milestone sign-offs, and an immutable memory history.
* **The Benchmark Site Clash Event**:
  > *"3D laser scan revealed a +120mm offset on the Tower B Level 4 post-tensioned cantilever slab sleeve. MEP hydronic radiant loop conduits and motorized pocket slider track anchors require immediate recalibration."*

### Multi-Discipline Cascade Breakdown:
1. **Structural Verification**: Flags Principal Structural Engineer (**Tariq Al-Mansoor**) to perform FEA stress verification on the cantilever slab edge reinforcement.
2. **MEP Recalibration**: Flags Head of MEP Services (**Marcus Vance**) to reroute hydronic conduits and reposition in-slab junction sleeves before concrete casting.
3. **Architectural Detailing**: Directs Lead Architect (**Elena Rostova**) to adjust motorized sliding door perimeter pocket anchor specifications.
4. **Schedule & Critical Path Impact**: Quantifies a **12-day schedule slippage risk**, flags affected trade contractors, and auto-drafts assignable corrective action items with due dates.

---

## ⚡ Core Intelligence Capabilities

### 1. 💥 Automated Blast Radius & Impact Harmonizer
* **Plain-Language Signal Ingestion**: Field personnel can log issues using natural conversational text, laser-scan summaries, or trade clash logs.
* **Deterministic + Generative Hybrid**:
  * *Deterministic Phase*: Traverses directed edges in the project graph to gather true connected deliverables, guaranteeing zero hallucinated relationships.
  * *Generative Phase*: Passes verified nodes to Google Gemini 2.5 Flash to compute qualitative severity (`Critical`, `High`, `Medium`, `Low`), monetary risk exposure, and schedule delay estimates.
* **Auto-Action Generation**: Transforms impact insights into official assigned tasks (e.g., *"Perform localized slab edge FEA"* assigned to Tariq Al-Mansoor).
* **Rerun Analysis**: Re-evaluate blast radii when revised laser scans or structural recalculations are submitted.

### 2. 🎯 Multidisciplinary Coordination Radar
* **Executive Project Health Vitals**: Real-time counters displaying Active Tasks, Critical Blockers, Overdue Actions, and Pending Approvals.
* **Discipline Switching**: Instantly isolate metrics by Architecture, Structural, MEP, Civil, Interior Design, and Client Management.
* **Personalized Daily AI Briefing**: Synthesizes a daily coordination digest customized to the logged-in user’s exact role, pending approvals, and blocked deliverables.

### 3. 📋 Interactive Work Register & Activity Lifecycles
* **End-to-End Status Tracking**: Progress tasks across `Draft`, `In Progress`, `Review`, `Blocked`, and `Completed`.
* **Interactive Modal View & Edit**: Clicking any row in the activities table launches a responsive modal dialog:
  * Adjust completion status and priority (`Low`, `Medium`, `High`, `Critical`).
  * Reassign lead discipline and responsible trade owner.
  * Reschedule planned start and target completion dates with input validation.
  * Toggle blocker status and record explicit blocker reasons.
  * Delete completed or obsolete work items with instant UI updates.

### 4. 🧠 Immutable Chronological Project Memory
* **Tamper-Evident Ledger**: Permanent audit trail categorizing entries into `CHANGE`, `DECISION`, `MILESTONE`, and `INSPECTION`.
* **Chronological Timestamp Preservation**: Database adapters preserve exact historical creation timestamps rather than overwriting with `NOW()`, ensuring strict descending chronological order.
* **Custom Event Logging**: Project managers can record milestone decisions with custom historical date/time pickers and discipline tagging.

### 5. 🤖 RAG-Grounded Project Copilot ("Ask the Project")
* **Natural Language Queries**: Context-aware Copilot grounded in the live project graph, active blocker register, and memory audit trail.
* **Supported Queries**:
  * *"What is currently blocking the glazing installation on Tower B?"*
  * *"Who owns the MEP shop drawings and when is the next submission due?"*
  * *"Summarize all decisions approved by the Client regarding geothermal HVAC boreholes."*
  * *"Show all critical path items with less than 5 days of float."*

### 6. 🗺️ Multidisciplinary RACI Matrix & Dependency Graph
* **Interactive Dependency Map**: Visual node-link network illustrating how structural milestones govern MEP first-fix, envelope waterproofing, and interior fit-outs. Nodes are styled with discipline-coded accents and real-time status borders (red for blocked, amber for in-review, green for completed).
* **RACI Matrix**: Comprehensive cross-reference grid identifying who is **R**esponsible, **A**ccountable, **C**onsulted, and **I**nformed for every deliverable.

---

## 👥 Stakeholder Personas & Disciplines

| Persona | Name | Project Role & Discipline | Permissions & Scope |
|---|---|---|---|
| 👔 **PM** | **David Chen** | Project Delivery Manager / PM | Full administrative oversight, change logging, approval dispatching |
| 📐 **Architect** | **Elena Rostova** | Lead Design Architect | Architectural approvals, facade detailing, aesthetic coordination |
| 🏗️ **Structural** | **Tariq Al-Mansoor** | Principal Structural Engineer | Structural sign-offs, slab/foundation re-verifications |
| ⚡ **MEP** | **Marcus Vance** | Head of MEP Services | Mechanical, electrical, hydronic, and HVAC coordination |
| 🔨 **Contractor** | **Sarah Jenkins** | General Contractor Lead | Site execution, trade scheduling, daily work logs |
| 🎨 **Interiors** | **Sophia Lin** | Interior Architect | Millwork, lighting layouts, luxury finishes |
| 🔍 **QA/Safety** | **Rajesh Patel** | Site QA/Safety Inspector | Quality inspections, safety compliance sign-offs |
| 💼 **Client** | **Arthur Pendelton** | Client / Developer Rep | Budget variations, milestone approvals, client decisions |

---

## 💾 Data Schema & Dual Persistence Strategy

The system features a **dual-persistence storage architecture** engineered for high-availability cloud deployment and zero-friction offline developer onboarding:

```
                  ┌─────────────────────────────────────────┐
                  │          Express API Services           │
                  └────────────────────┬────────────────────┘
                                       │
                     Is DATABASE_URL present & valid?
                                       │
                      ┌────────────────┴────────────────┐
                      ▼ YES                             ▼ NO
        ┌───────────────────────────┐     ┌───────────────────────────┐
        │  Neon Serverless Postgres │     │  Local JSON File Storage  │
        │ (@neondatabase/serverless)│     │  (server/data/store.json) │
        │  - Cloud-synced           │     │  - Zero-config local run  │
        │  - Connection pooled      │     │  - Immediate persistence  │
        │  - Multi-tenant ready     │     │  - Fully offline capable  │
        └───────────────────────────┘     └───────────────────────────┘
```

### Database Schema Tables (PostgreSQL / Drizzle)

| Table | Purpose | Key Attributes |
|---|---|---|
| `users` | User credentials & profiles | `id`, `email`, `password_hash`, `name`, `role`, `discipline`, `avatar` |
| `projects` | Master project definitions | `id`, `name`, `code`, `description`, `location`, `status`, `target_date` |
| `stakeholders`| Organizations & contact points | `id`, `project_id`, `organization`, `lead_contact`, `discipline`, `phone` |
| `activities` | Tasks, milestones & deliverables | `id`, `title`, `package`, `discipline`, `owner`, `status`, `priority`, `is_blocked`, `due_date` |
| `dependencies`| Directed graph relationship edges | `id`, `source_activity_id`, `target_activity_id`, `type` (`requires`, `blocks`, `informs`) |
| `changes` | Logged site deviations & revisions | `id`, `title`, `description`, `status`, `discipline`, `registered_by`, `created_at` |
| `impacts` | AI-generated blast radius reports | `id`, `change_id`, `severity`, `schedule_impact_days`, `cost_estimate`, `summary` |
| `actions` | Corrective tasks generated by AI | `id`, `impact_id`, `title`, `assigned_to`, `due_date`, `status` |
| `approvals` | Multidisciplinary sign-off queue | `id`, `title`, `approver_role`, `status`, `requester`, `decision_notes` |
| `alerts` | High-visibility notifications | `id`, `recipient_id`, `title`, `message`, `severity`, `is_acknowledged` |
| `memory_entries`| Immutable project decision ledger | `id`, `type` (`CHANGE`, `DECISION`, `MILESTONE`), `title`, `details`, `recorded_by`, `created_at` |

---

## 📂 Repository & Codebase Structure

```
Coordination-Intelligence-System/
├── client/                             # React 19 Single Page Application
│   ├── src/
│   │   ├── components/                 # Domain-Specific UI Components
│   │   │   ├── dependency-graph.tsx    # Interactive SVG dependency map
│   │   │   ├── raci-matrix.tsx         # Multidisciplinary RACI grid
│   │   │   ├── signal-ingestion-modal.tsx # Change logging & signal ingestion
│   │   │   ├── stakeholder-drawer.tsx  # Stakeholder directory drawer
│   │   │   └── ui/                     # Dialog, Button, Badge, Form components
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx           # Authenticated login & instant demo switch
│   │   │   ├── RegisterPage.tsx        # Self-service registration & project creator
│   │   │   └── not-found.tsx           # 404 handler
│   │   ├── App.tsx                     # Core coordination dashboard & state coordinator
│   │   └── index.css                   # Tailwind v4 theme, glassmorphism, animations
│   ├── vite.config.ts                  # Vite 7 server & build configuration
│   └── package.json                    # Frontend dependencies
│
├── server/                             # Express 5 Backend
│   ├── src/
│   │   ├── db/
│   │   │   └── neon.ts                 # Neon PostgreSQL driver, schema sync, queries
│   │   ├── routes/
│   │   │   ├── auth.ts                 # User authentication & demo switching routes
│   │   │   ├── coordination.ts         # Activities, changes, impacts, copilot endpoints
│   │   │   └── health.ts               # Liveness & readiness probes
│   │   ├── middlewares/                # Session verification & audit loggers
│   │   ├── lib/
│   │   │   └── logger.ts               # Structured Pino logging utility
│   │   ├── app.ts                      # Express app setup & CORS policy
│   │   └── index.ts                    # HTTP server entrypoint
│   ├── data/
│   │   └── store.json                  # Local JSON fallback store
│   └── package.json                    # Backend dependencies
│
├── lib/                                # Shared Monorepo Packages
│   ├── api-spec/                       # OpenAPI 3.0 specification (`openapi.yaml`)
│   ├── api-client-react/               # Auto-generated React Query hooks
│   ├── api-zod/                        # Shared Zod validation schemas
│   └── db/                             # Drizzle ORM schema declarations
│
├── scripts/                            # Operational Tooling
│   ├── dev.mjs                         # Parallel dev runner (Ports 3000 + 5000)
│   └── init-db.mjs                     # Neon PostgreSQL schema migration script
│
├── package.json                        # Monorepo workspace root configuration
├── pnpm-workspace.yaml                 # PNPM monorepo package definitions
└── README.md                           # Master project documentation
```

---

## 📡 API Specification & Endpoints

### Core Endpoints Table

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register new user and provision project workspace |
| `POST` | `/api/auth/login` | No | Authenticate user credentials |
| `POST` | `/api/auth/demo-login` | No | Instant login as David Chen (Riverside Demo) |
| `GET` | `/api/auth/me` | Yes | Get active user session and role profile |
| `POST` | `/api/auth/logout` | Yes | Terminate session |
| `GET` | `/api/coordination/overview` | Yes | Retrieve aggregate KPIs, blockers, and AI briefing |
| `GET` | `/api/coordination/activities` | Yes | List project activities (filterable by owner/discipline) |
| `POST` | `/api/coordination/activities` | Yes | Create a new work package / task |
| `PATCH`| `/api/coordination/activities/:id`| Yes | Update activity status, owner, priority, dates, or blocker |
| `DELETE`| `/api/coordination/activities/:id`| Yes | Delete an activity record |
| `GET` | `/api/coordination/changes` | Yes | List logged change events and impacts |
| `POST` | `/api/coordination/changes` | Yes | Ingest a change signal and run AI blast radius analysis |
| `POST` | `/api/coordination/changes/:id/rerun`| Yes | Re-calculate graph traversal and AI blast radius |
| `GET` | `/api/coordination/memory` | Yes | Fetch immutable chronological decision ledger |
| `POST` | `/api/coordination/memory` | Yes | Add manual milestone or decision record |
| `POST` | `/api/coordination/ask` | Yes | Query the RAG-grounded Project Copilot |
| `GET` | `/api/healthz` | No | Health check probe (`{"status": "ok"}`) |

### Example API Request & Response

#### Ingest Change & Compute Blast Radius
```bash
curl -X POST http://localhost:5000/api/coordination/changes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tower B Level 4 Slab Sleeve Deviation (+120mm)",
    "description": "3D laser scan revealed a 120mm offset on post-tensioned cantilever slab sleeve. MEP hydronic radiant loop conduits and motorized pocket slider track anchors require immediate recalibration.",
    "discipline": "Structural",
    "priority": "critical"
  }'
```

```json
{
  "change": {
    "id": "chg-178930",
    "title": "Tower B Level 4 Slab Sleeve Deviation (+120mm)",
    "discipline": "Structural",
    "status": "under_analysis"
  },
  "impact": {
    "severity": "critical",
    "scheduleImpactDays": 12,
    "costExposureEstimate": "$45,000",
    "summary": "Post-tensioned cantilever slab sleeve offset threatens structural reinforcement margins and blocks hydronic radiant loop conduits.",
    "affectedDisciplines": ["Structural", "MEP", "Architecture", "Contractor"],
    "proposedActions": [
      {
        "title": "Perform localized FEA re-check around slab edge sleeve",
        "assignedTo": "Tariq Al-Mansoor",
        "dueDate": "2026-09-18"
      },
      {
        "title": "Relocate in-slab radiant heating junction boxes",
        "assignedTo": "Marcus Vance",
        "dueDate": "2026-09-19"
      }
    ],
    "requiredApprovals": [
      {
        "title": "Cantilever Slab Edge Rebar Calculation Sign-Off",
        "approverRole": "Principal Structural Engineer"
      }
    ]
  }
}
```

---

## 🚀 Quickstart & Local Setup

### Prerequisites
* **Node.js**: `v20.x` or later
* **pnpm**: `v9.x` or later (`npm install -g pnpm`)

### 1. Clone the Repository
```bash
git clone https://github.com/Lokesh-5505/Coordination-Intelligence-System.git
cd Coordination-Intelligence-System
```

### 2. Install Workspace Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Application Server Port
PORT=5000

# Session Security Secret
SESSION_SECRET=coordination_intelligence_super_secret_key_2026

# Optional: Neon Serverless PostgreSQL URL (Leaves local fallback active if omitted)
DATABASE_URL=postgresql://user:password@ep-example.region.neon.tech/neondb?sslmode=require

# Optional: Google Gemini API Key (Uses realistic built-in fallback heuristics if omitted)
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Start Development Stack
Start both the API server (Port 5000) and the Vite frontend (Port 3000) concurrently:

```bash
# On Linux / macOS:
pnpm run dev

# On Windows (PowerShell):
pnpm.cmd run dev
```

* **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
* **Backend API**: [http://localhost:5000](http://localhost:5000)
* **Health Check Probe**: [http://localhost:5000/api/healthz](http://localhost:5000/api/healthz)

### 5. Production Build & Validation
Run typecheck across all workspace packages and build production bundles:
```bash
# On Linux / macOS:
pnpm run build

# On Windows (PowerShell):
pnpm.cmd run build
```

---

## ☁️ Cloud Deployment Guide (Vercel + Render)

This repository is optimized for decoupled cloud deployment: **Frontend on Vercel** and **Backend on Render**.

### 1. Deploying the Backend on Render

1. Create a new account or log into [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service** and connect your GitHub repository.
3. Configure the web service with the following settings:
   * **Name**: `coordination-intelligence-api`
   * **Region**: Choose the region closest to your Neon database.
   * **Root Directory**: Leave **blank** (root of repository, ensuring workspace dependencies link properly).
   * **Runtime**: `Node`
   * **Build Command**: `pnpm install && pnpm run build`
   * **Start Command**: `node --enable-source-maps server/dist/index.mjs`
   * **Plan**: `Free` (or higher)
4. Add the following **Environment Variables** in the Render Dashboard:
   | Key | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production mode optimizations |
   | `PORT` | `5000` | Port for Express service |
   | `HOST` | `0.0.0.0` | Binds to all network interfaces (required by Render) |
   | `SESSION_SECRET` | *(Generate a random 32+ char string)* | Used for session cryptography |
   | `DATABASE_URL` | `postgresql://...` | Your Neon connection string (or omit to use local file fallback) |
   | `GEMINI_API_KEY` | `AIzaSy...` | Google Gemini API Key |
   | `CLIENT_ORIGIN` | `https://your-frontend-app.vercel.app` | Allows CORS requests from your Vercel domain |
5. Click **Deploy Web Service**. Render will provision and launch your backend. Once deployed, note your service URL (e.g., `https://coordination-intelligence-api.onrender.com`).

> **Tip**: You can also use the included [`render.yaml`](render.yaml) blueprint file for automated 1-click deployment on Render.

---

### 2. Deploying the Frontend on Vercel

1. Log into [Vercel Dashboard](https://vercel.com/) and click **Add New...** → **Project**.
2. Import your GitHub repository.
3. Configure the project settings:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click **Edit** and select `client` (or leave as root with output `client/dist`).
   * **Build Command**: `pnpm run build`
   * **Output Directory**: `dist`
4. Add the following **Environment Variable** in the Vercel Dashboard:
   | Key | Value | Description |
   |---|---|---|
   | `VITE_API_BASE_URL` | `https://your-backend-app.onrender.com/api` | Points frontend API client to your deployed Render backend |
5. Click **Deploy**. Vercel will build the frontend and deploy it to a global CDN.

> **Note**: SPA client-side routing is handled automatically by the included [`vercel.json`](client/vercel.json) file, ensuring that refreshing on `/dashboard` or `/login` does not cause 404 errors.

---

## ❓ Technical Architecture FAQ

<details>
<summary><b>1. Do I need a Neon PostgreSQL database account or Google Gemini API key to run this project?</b></summary>
No. CIS includes a built-in resilience engine. If <code>DATABASE_URL</code> is omitted, it automatically falls back to <code>server/data/store.json</code>. If <code>GEMINI_API_KEY</code> is omitted, it utilizes built-in deterministic heuristic analysis. You can clone and run the full experience out of the box with zero external dependencies.
</details>

<details>
<summary><b>2. Why use pnpm.cmd on Windows?</b></summary>
On Windows PowerShell, npm's default security policy may restrict execution of <code>pnpm.ps1</code>. Using <code>pnpm.cmd</code> executes the native batch runner cleanly without requiring changes to Windows execution policies.
</details>

<details>
<summary><b>3. How does the graph traversal prevent AI hallucinations?</b></summary>
The system uses a strict two-stage pipeline. The graph traversal engine is deterministic: it follows directed edges in the dependency graph to find actual connected deliverables and tasks. The AI model is only asked to synthesize and rank this pre-verified list of affected nodes, ensuring it never invents fictitious tasks or stakeholders.
</details>

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Designed & engineered by <b>Ram Lokesh</b> for modern Architecture, Engineering, and Construction workflows.</sub>
</div>
