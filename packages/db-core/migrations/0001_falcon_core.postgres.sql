-- =============================================================================
-- FALCON CORE (CONTROL PLANE) — PostgreSQL 16+ Official Schema Migration v1
-- Responsabilidade: Cadastro global SaaS, organizações, usuários, planos,
-- assinaturas, registro seguro de instâncias individuais de tenants, jobs de
-- provisionamento, catálogo global, consumo consolidado e auditoria administrativa.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  tier TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_users INTEGER NOT NULL,
  max_active_agents INTEGER NOT NULL,
  max_projects_per_month INTEGER NOT NULL,
  max_tokens_per_month BIGINT NOT NULL,
  max_static_arts_per_month INTEGER NOT NULL,
  max_video_minutes_per_month INTEGER NOT NULL,
  max_storage_bytes BIGINT NOT NULL,
  max_social_channels INTEGER NOT NULL,
  allow_paid_ads_module BOOLEAN NOT NULL DEFAULT FALSE,
  allow_full_office_builder BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  public_name TEXT NOT NULL,
  segment TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'LEAD', 'COMMERCIAL_ONBOARDING', 'AWAITING_PAYMENT',
    'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'CLOSING', 'CLOSED'
  )),
  plan_tier TEXT NOT NULL REFERENCES plans(tier),
  billing_status TEXT NOT NULL DEFAULT 'TRIAL_OR_AUTHORIZED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_internal_falcon_admin BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'APPROVER', 'MEMBER', 'VIEWER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

CREATE TABLE IF NOT EXISTS tenant_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT,
  instance_identifier TEXT NOT NULL UNIQUE,
  engine_mode TEXT NOT NULL CHECK (engine_mode IN ('POSTGRES_DEDICATED', 'ISOLATED_INSTANCE_FILE')),
  db_host TEXT NOT NULL,
  db_port INTEGER NOT NULL,
  db_name TEXT NOT NULL UNIQUE,
  db_user TEXT NOT NULL UNIQUE,
  encrypted_db_credential TEXT NOT NULL,
  kms_key_id TEXT NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_prefix TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL DEFAULT 1,
  health_status TEXT NOT NULL CHECK (health_status IN ('PROVISIONING', 'HEALTHY', 'DEGRADED', 'SUSPENDED', 'OFFLINE')),
  last_health_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provisioning_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  current_step INTEGER NOT NULL DEFAULT 0,
  steps_log_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tenant_usage_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  period_month TEXT NOT NULL, -- YYYY-MM
  tokens_used BIGINT NOT NULL DEFAULT 0,
  api_calls_count INTEGER NOT NULL DEFAULT 0,
  static_arts_generated INTEGER NOT NULL DEFAULT 0,
  video_minutes_rendered NUMERIC(10,2) NOT NULL DEFAULT 0,
  storage_bytes_used BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, period_month)
);

CREATE TABLE IF NOT EXISTS core_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID,
  organization_id UUID,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  previous_state_json JSONB,
  new_state_json JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
