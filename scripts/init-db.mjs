import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

import pg from '../lib/db/node_modules/pg/lib/index.js';

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;

console.log('Connecting to Neon DB...');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const ddl = `
-- Create enums if not exist
DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM ('blocked', 'in-progress', 'at-risk', 'pending', 'complete');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE change_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE change_status AS ENUM ('active', 'resolved', 'monitoring');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE action_status AS ENUM ('todo', 'in-progress', 'done');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE action_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE stakeholder_status AS ENUM ('online', 'on-site', 'in-meeting', 'offline');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE memory_type AS ENUM ('decision', 'change', 'action', 'approval', 'milestone', 'issue');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM ('impact', 'deadline', 'approval', 'info');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE dependency_type AS ENUM ('blocks', 'depends-on', 'relates-to');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE dependency_status AS ENUM ('active', 'resolved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  project_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_project_id_idx ON users(project_id);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  phase TEXT NOT NULL DEFAULT 'Planning',
  status TEXT NOT NULL DEFAULT 'On track',
  progress INTEGER NOT NULL DEFAULT 0,
  owner_id UUID NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects(owner_id);

-- Stakeholders
CREATE TABLE IF NOT EXISTS stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  role TEXT NOT NULL,
  discipline TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  status stakeholder_status NOT NULL DEFAULT 'online',
  owned_count INTEGER NOT NULL DEFAULT 0,
  affected_by_count INTEGER NOT NULL DEFAULT 0,
  raci TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stakeholders_project_id_idx ON stakeholders(project_id);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Deliverable',
  discipline TEXT NOT NULL DEFAULT 'Architecture',
  owner TEXT NOT NULL,
  owner_initials TEXT NOT NULL,
  status activity_status NOT NULL DEFAULT 'in-progress',
  due_date TEXT,
  location TEXT,
  critical_path BOOLEAN NOT NULL DEFAULT false,
  dependency_count INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activities_project_id_idx ON activities(project_id);
CREATE INDEX IF NOT EXISTS activities_status_idx ON activities(status);

-- Dependencies
CREATE TABLE IF NOT EXISTS dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  from_id UUID NOT NULL,
  from_title TEXT NOT NULL,
  to_id UUID NOT NULL,
  to_title TEXT NOT NULL,
  type dependency_type NOT NULL DEFAULT 'blocks',
  status dependency_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dependencies_project_id_idx ON dependencies(project_id);
CREATE INDEX IF NOT EXISTS dependencies_from_id_idx ON dependencies(from_id);
CREATE INDEX IF NOT EXISTS dependencies_to_id_idx ON dependencies(to_id);

-- Changes
CREATE TABLE IF NOT EXISTS changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status change_status NOT NULL DEFAULT 'active',
  severity change_severity NOT NULL DEFAULT 'medium',
  created_by TEXT NOT NULL,
  discipline TEXT,
  affected_count INTEGER NOT NULL DEFAULT 0,
  raw_signal TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS changes_project_id_idx ON changes(project_id);

-- Actions
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  owner_initials TEXT NOT NULL,
  status action_status NOT NULL DEFAULT 'todo',
  due_date TEXT,
  source TEXT,
  priority action_priority NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS actions_project_id_idx ON actions(project_id);
CREATE INDEX IF NOT EXISTS actions_owner_idx ON actions(owner);

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  requester TEXT NOT NULL,
  requester_initials TEXT NOT NULL,
  approver TEXT NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  due_date TEXT,
  category TEXT NOT NULL DEFAULT 'Technical Submittal',
  impact_summary TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS approvals_project_id_idx ON approvals(project_id);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals(status);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type alert_type NOT NULL DEFAULT 'info',
  severity alert_severity NOT NULL DEFAULT 'medium',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS alerts_project_id_idx ON alerts(project_id);

-- Memory
CREATE TABLE IF NOT EXISTS memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type memory_type NOT NULL DEFAULT 'decision',
  actor TEXT NOT NULL,
  tags TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS memory_project_id_idx ON memory(project_id);
CREATE INDEX IF NOT EXISTS memory_type_idx ON memory(type);
`;

async function run() {
  try {
    const client = await pool.connect();
    console.log('Connected! Executing DDL...');
    const t0 = Date.now();
    await client.query(ddl);
    console.log(`DDL executed successfully in ${Date.now() - t0}ms!`);

    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    console.log('Tables present in Neon:');
    console.log(res.rows.map(r => r.tablename));
    client.release();
    await pool.end();
    console.log('Database initialization complete!');
  } catch (err) {
    console.error('Migration error:', err);
    await pool.end();
    process.exit(1);
  }
}

run();
