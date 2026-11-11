-- =============================================================================
-- FALCON GROWTH — TENANT DATA PLANE (Banco PostgreSQL Individual por Empresa)
-- Migration v1: Estrutura operacional completa e isolada de uma organização.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_metadata (
  organization_id UUID PRIMARY KEY,
  organization_slug TEXT NOT NULL,
  autonomy_mode TEXT NOT NULL DEFAULT 'SEMI_AUTOMATIC' CHECK (
    autonomy_mode IN ('ASSISTED', 'SEMI_AUTOMATIC', 'AUTOMATED')
  ),
  brand_memory_activated BOOLEAN NOT NULL DEFAULT FALSE,
  active_office_layout_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. FALCON SETUP (Onboarding Guiado 11 Etapas com Salvamento Parcial — Seção 8)
CREATE TABLE IF NOT EXISTS onboarding_steps (
  step_key TEXT PRIMARY KEY,
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DRAFT', 'COMPLETED')),
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by_user_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. FALCON BRAND INTELLIGENCE (Memória Estruturada e Versionada — Seção 9)
CREATE TABLE IF NOT EXISTS brand_intelligence_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  memory_level TEXT NOT NULL CHECK (memory_level IN ('PERMANENT', 'OPERATIONAL', 'TEMPORARY')),
  title TEXT NOT NULL,
  structured_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_text TEXT NOT NULL,
  embedding vector(1536),
  confidence_score NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'ARCHIVED')),
  current_version INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_intel_category ON brand_intelligence_entries(category, status);
CREATE INDEX IF NOT EXISTS idx_brand_intel_level ON brand_intelligence_entries(memory_level, status);

CREATE TABLE IF NOT EXISTS brand_intelligence_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES brand_intelligence_entries(id) ON DELETE CASCADE,
  previous_version INTEGER,
  new_version INTEGER NOT NULL,
  previous_data_json JSONB,
  new_data_json JSONB NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  changed_by_user_id UUID,
  suggested_by_agent_slug TEXT,
  affected_agents_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. FALCON AI TEAM (11 Agentes Especializados Configuráveis — Seção 10)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  department TEXT NOT NULL,
  specialty TEXT NOT NULL,
  description TEXT NOT NULL,
  is_supervisor BOOLEAN NOT NULL DEFAULT FALSE,
  model_provider TEXT NOT NULL DEFAULT 'anthropic',
  model_name TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  active_prompt_version INTEGER NOT NULL DEFAULT 1,
  authorized_tools_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  memory_scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_tokens_per_execution INTEGER NOT NULL DEFAULT 12000,
  timeout_seconds INTEGER NOT NULL DEFAULT 90,
  max_retries INTEGER NOT NULL DEFAULT 2,
  default_sector TEXT NOT NULL,
  assigned_seat_uid TEXT,
  avatar_palette INTEGER NOT NULL DEFAULT 0,
  avatar_repeat INTEGER NOT NULL DEFAULT 0,
  avatar_custom_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  operational_state TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (
    operational_state IN (
      'AVAILABLE', 'EXECUTING', 'IN_MEETING', 'CREATING',
      'REVIEWING', 'AWAITING_APPROVAL', 'COMPLETED', 'UNAVAILABLE', 'ERROR'
    )
  ),
  current_task_id UUID,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_prompt_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, version)
);

-- 4. PROJETOS, TAREFAS, DEPENDÊNCIAS E EXECUÇÕES (Seção 11)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  requester_user_id UUID,
  source_channel TEXT NOT NULL DEFAULT 'DASHBOARD' CHECK (source_channel IN ('DASHBOARD', 'COMMAND', 'WHATSAPP')),
  status TEXT NOT NULL DEFAULT 'PLANNING' CHECK (
    status IN ('PLANNING', 'IN_PROGRESS', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'COMPLETED', 'CANCELLED')
  ),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  target_channel TEXT,
  due_at TIMESTAMPTZ,
  supervisor_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  requester_user_id UUID,
  assigned_agent_id UUID NOT NULL REFERENCES agents(id),
  assigned_agent_slug TEXT NOT NULL,
  department TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  objective TEXT NOT NULL,
  expected_deliverable TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'BACKLOG' CHECK (
    status IN (
      'BACKLOG', 'PLANNED', 'AWAITING_DEPENDENCY', 'READY',
      'IN_PROGRESS', 'IN_REVIEW', 'AWAITING_CLIENT', 'CHANGES_REQUESTED',
      'APPROVED', 'SCHEDULED', 'PUBLISHED', 'COMPLETED',
      'BLOCKED', 'FAILED', 'CANCELLED'
    )
  ),
  due_at TIMESTAMPTZ,
  input_files_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_files_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  references_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  acceptance_criteria_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  latest_deliverable_version_id UUID,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id, status);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS task_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT')),
  model_used TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  tools_invoked_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_summary TEXT,
  output_payload_json JSONB,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES task_executions(id) ON DELETE SET NULL,
  from_agent_slug TEXT,
  to_agent_slug TEXT,
  user_id UUID,
  channel TEXT NOT NULL DEFAULT 'INTERNAL' CHECK (channel IN ('INTERNAL', 'COMMAND', 'WHATSAPP', 'APPROVAL')),
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  structured_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ARQUIVOS, FALCON STUDIO E FALCON APPROVALS (Seções 12.3, 15 e 23)
CREATE TABLE IF NOT EXISTS deliverable_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  format_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content_body TEXT NOT NULL,
  structured_content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_key TEXT,
  mime_type TEXT NOT NULL DEFAULT 'application/json',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 TEXT NOT NULL,
  created_by_agent_slug TEXT,
  created_by_user_id UUID,
  qa_review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (qa_review_status IN ('PENDING', 'PASSED', 'FAILED')),
  qa_review_notes TEXT,
  is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, version_number)
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_version_id UUID NOT NULL REFERENCES deliverable_versions(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL,
  content_checksum_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'SUPERSEDED')
  ),
  requested_by_agent_slug TEXT NOT NULL,
  decided_by_user_id UUID,
  decision_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

-- 6. FALCON VIRTUAL OFFICE 3D & OFFICE BUILDER (Seções 13 e 14)
CREATE TABLE IF NOT EXISTS office_layouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  template_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  layout_json JSONB NOT NULL,
  branding_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. CRM, SOCIAL, ADS, PERFORMANCE, CONNECT & AUDITORIA (Seções 17 a 24)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('CONNECTED', 'EXPIRED', 'ERROR', 'DISCONNECTED')),
  granted_scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  encrypted_tokens_envelope TEXT,
  last_sync_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  lead_source TEXT,
  pipeline_stage TEXT NOT NULL DEFAULT 'NEW_LEAD',
  deal_value_cents BIGINT NOT NULL DEFAULT 0,
  win_probability INTEGER NOT NULL DEFAULT 20,
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  assigned_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  task_id UUID NOT NULL REFERENCES tasks(id),
  approval_id UUID NOT NULL REFERENCES approvals(id),
  deliverable_version_id UUID NOT NULL REFERENCES deliverable_versions(id),
  channel TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'PUBLISHED', 'FAILED', 'CANCELLED')),
  idempotency_key TEXT NOT NULL UNIQUE,
  external_post_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ads_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL DEFAULT 'META_ADS',
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  daily_budget_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'AWAITING_BUDGET_APPROVAL', 'ACTIVE', 'PAUSED')),
  approved_by_user_id UUID,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('USER', 'AGENT', 'SYSTEM')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
