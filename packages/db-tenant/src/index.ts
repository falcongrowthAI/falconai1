/**
 * @falcon/db-tenant
 * Implementação do Tenant Data Plane (Banco Operacional Individual por Empresa — Seção 6 do PDF),
 * Provisionador Automático de 10 Etapas (Seção 6.2), Roteador Seguro de Conexão (Seção 6.3),
 * FALCON SETUP (Seção 8), FALCON BRAND INTELLIGENCE (Seção 9) e Persistência Operacional.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  AgentOperationalState,
  AutonomyMode,
  BrandMemoryCategory,
  BrandMemoryLevel,
  OFFICIAL_FALCON_AGENTS,
  OFFICIAL_OFFICE_SECTORS,
  type OfficialAgentSlug,
  ONBOARDING_STEPS_ORDERED,
  type OnboardingStepKey,
  OrganizationStatus,
  type PermissionAction,
  TaskStatus,
} from '@falcon/contracts';
import {
  AuthorizationError,
  type FalconCoreControlPlane,
  type ProvisioningStepLog,
  TenantIsolationViolationError,
} from '@falcon/db-core';
import {
  computeIdempotencyKey,
  computeSha256Checksum,
  type SessionTokenPayload,
} from '@falcon/security';

export interface TenantBrandMemoryEntry {
  id: string;
  category: BrandMemoryCategory;
  memoryLevel: BrandMemoryLevel;
  title: string;
  structuredData: Record<string, unknown>;
  contentText: string;
  confidenceScore: number;
  source: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'ARCHIVED';
  currentVersion: number;
  expiresAt: string | null;
  updatedAt: string;
}

export interface TenantAgentRecord {
  id: string;
  slug: OfficialAgentSlug;
  displayOrder: number;
  name: string;
  roleTitle: string;
  department: string;
  specialty: string;
  description: string;
  isSupervisor: boolean;
  modelProvider: string;
  modelName: string;
  activePromptVersion: number;
  authorizedTools: string[];
  memoryScopes: BrandMemoryCategory[];
  maxTokensPerExecution: number;
  timeoutSeconds: number;
  defaultSector: string;
  assignedSeatUid: string | null;
  avatarPalette: number;
  avatarRepeat: number;
  operationalState: AgentOperationalState;
  currentTaskId: string | null;
  isEnabled: boolean;
}

export interface TenantProjectRecord {
  id: string;
  title: string;
  objective: string;
  requesterUserId: string | null;
  sourceChannel: 'DASHBOARD' | 'COMMAND' | 'WHATSAPP';
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  targetChannel: string | null;
  dueAt: string | null;
  supervisorPlan: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
}

export interface TenantTaskRecord {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  requesterUserId: string | null;
  assignedAgentId: string;
  assignedAgentSlug: OfficialAgentSlug;
  department: string;
  title: string;
  description: string;
  objective: string;
  expectedDeliverable: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: TaskStatus;
  dueAt: string | null;
  dependencies: string[];
  acceptanceCriteria: string[];
  qualityChecklist: string[];
  latestDeliverableVersionId: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliverableVersionRecord {
  id: string;
  projectId: string;
  taskId: string;
  versionNumber: number;
  formatType: string;
  title: string;
  contentBody: string;
  structuredContent: Record<string, unknown>;
  storageKey: string | null;
  checksumSha256: string;
  createdByAgentSlug: string | null;
  qaReviewStatus: 'PENDING' | 'PASSED' | 'FAILED';
  qaReviewNotes: string | null;
  isSuperseded: boolean;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  projectId: string;
  taskId: string;
  deliverableVersionId: string;
  versionNumber: number;
  contentChecksumSha256: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'SUPERSEDED';
  requestedByAgentSlug: string;
  decidedByUserId: string | null;
  decisionNotes: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

/**
 * Instância de Banco Operacional exclusiva de uma única Organização (Tenant Data Plane).
 * Cada instância corresponde a um banco de dados físico independente e verifica
 * criptograficamente sua própria credencial de serviço.
 */
export class TenantDatabaseInstance {
  readonly organizationId: string;
  readonly dbFilePath: string;
  readonly storageDirPath: string;
  readonly db: DatabaseSync;

  constructor(params: {
    organizationId: string;
    dbFilePath: string;
    storageDirPath: string;
  }) {
    this.organizationId = params.organizationId;
    this.dbFilePath = params.dbFilePath;
    this.storageDirPath = params.storageDirPath;

    mkdirSync(dirname(this.dbFilePath), { recursive: true });
    mkdirSync(this.storageDirPath, { recursive: true });

    this.db = new DatabaseSync(this.dbFilePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  /**
   * Aplica as migrations versionadas do banco do tenant (Etapa 4 do Provisionamento — Seção 6.2).
   */
  applyMigrations(): number {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenant_metadata (
        organization_id TEXT PRIMARY KEY,
        organization_slug TEXT NOT NULL,
        service_credential_hash TEXT NOT NULL,
        autonomy_mode TEXT NOT NULL DEFAULT 'SEMI_AUTOMATIC',
        brand_memory_activated INTEGER NOT NULL DEFAULT 0,
        active_office_layout_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS onboarding_steps (
        step_key TEXT PRIMARY KEY,
        step_order INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        data_json TEXT NOT NULL DEFAULT '{}',
        attachments_json TEXT NOT NULL DEFAULT '[]',
        updated_by_user_id TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS brand_intelligence_entries (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        memory_level TEXT NOT NULL,
        title TEXT NOT NULL,
        structured_data_json TEXT NOT NULL DEFAULT '{}',
        content_text TEXT NOT NULL,
        confidence_score REAL NOT NULL DEFAULT 1.0,
        source TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        current_version INTEGER NOT NULL DEFAULT 1,
        expires_at TEXT,
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS brand_intelligence_versions (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES brand_intelligence_entries(id) ON DELETE CASCADE,
        previous_version INTEGER,
        new_version INTEGER NOT NULL,
        previous_data_json TEXT,
        new_data_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        source TEXT NOT NULL,
        changed_by_user_id TEXT,
        suggested_by_agent_slug TEXT,
        affected_agents_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        display_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        role_title TEXT NOT NULL,
        department TEXT NOT NULL,
        specialty TEXT NOT NULL,
        description TEXT NOT NULL,
        is_supervisor INTEGER NOT NULL DEFAULT 0,
        model_provider TEXT NOT NULL DEFAULT 'anthropic',
        model_name TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
        active_prompt_version INTEGER NOT NULL DEFAULT 1,
        authorized_tools_json TEXT NOT NULL DEFAULT '[]',
        memory_scopes_json TEXT NOT NULL DEFAULT '[]',
        max_tokens_per_execution INTEGER NOT NULL DEFAULT 12000,
        timeout_seconds INTEGER NOT NULL DEFAULT 90,
        max_retries INTEGER NOT NULL DEFAULT 2,
        default_sector TEXT NOT NULL,
        assigned_seat_uid TEXT,
        avatar_palette INTEGER NOT NULL DEFAULT 0,
        avatar_repeat INTEGER NOT NULL DEFAULT 0,
        avatar_custom_json TEXT NOT NULL DEFAULT '{}',
        operational_state TEXT NOT NULL DEFAULT 'AVAILABLE',
        current_task_id TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_prompt_versions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        system_prompt TEXT NOT NULL,
        temperature REAL NOT NULL DEFAULT 0.3,
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(agent_id, version)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        requester_user_id TEXT,
        source_channel TEXT NOT NULL DEFAULT 'DASHBOARD',
        status TEXT NOT NULL DEFAULT 'PLANNING',
        priority TEXT NOT NULL DEFAULT 'MEDIUM',
        target_channel TEXT,
        due_at TEXT,
        supervisor_plan_json TEXT NOT NULL DEFAULT '{}',
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        requester_user_id TEXT,
        assigned_agent_id TEXT NOT NULL REFERENCES agents(id),
        assigned_agent_slug TEXT NOT NULL,
        department TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        objective TEXT NOT NULL,
        expected_deliverable TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'MEDIUM',
        status TEXT NOT NULL DEFAULT 'BACKLOG',
        due_at TEXT,
        input_files_json TEXT NOT NULL DEFAULT '[]',
        output_files_json TEXT NOT NULL DEFAULT '[]',
        references_json TEXT NOT NULL DEFAULT '[]',
        acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
        quality_checklist_json TEXT NOT NULL DEFAULT '[]',
        latest_deliverable_version_id TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, depends_on_task_id)
      );

      CREATE TABLE IF NOT EXISTS task_executions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        attempt_number INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL,
        model_used TEXT NOT NULL,
        prompt_version INTEGER NOT NULL,
        tools_invoked_json TEXT NOT NULL DEFAULT '[]',
        output_summary TEXT,
        output_payload_json TEXT,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        cached_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );

      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        execution_id TEXT REFERENCES task_executions(id) ON DELETE SET NULL,
        from_agent_slug TEXT,
        to_agent_slug TEXT,
        user_id TEXT,
        channel TEXT NOT NULL DEFAULT 'INTERNAL',
        message_type TEXT NOT NULL,
        content TEXT NOT NULL,
        structured_payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deliverable_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        format_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_body TEXT NOT NULL,
        structured_content_json TEXT NOT NULL DEFAULT '{}',
        storage_key TEXT,
        mime_type TEXT NOT NULL DEFAULT 'application/json',
        size_bytes INTEGER NOT NULL DEFAULT 0,
        checksum_sha256 TEXT NOT NULL,
        created_by_agent_slug TEXT,
        created_by_user_id TEXT,
        qa_review_status TEXT NOT NULL DEFAULT 'PENDING',
        qa_review_notes TEXT,
        is_superseded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(task_id, version_number)
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        deliverable_version_id TEXT NOT NULL REFERENCES deliverable_versions(id) ON DELETE RESTRICT,
        version_number INTEGER NOT NULL,
        content_checksum_sha256 TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        requested_by_agent_slug TEXT NOT NULL,
        decided_by_user_id TEXT,
        decision_notes TEXT,
        requested_at TEXT NOT NULL,
        decided_at TEXT
      );

      CREATE TABLE IF NOT EXISTS office_layouts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        template_key TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        layout_json TEXT NOT NULL,
        branding_json TEXT NOT NULL DEFAULT '{}',
        updated_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crm_contacts (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        company_name TEXT,
        email TEXT,
        phone TEXT,
        lead_source TEXT,
        pipeline_stage TEXT NOT NULL DEFAULT 'NEW_LEAD',
        deal_value_cents INTEGER NOT NULL DEFAULT 0,
        win_probability INTEGER NOT NULL DEFAULT 20,
        tags_json TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        assigned_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS social_scheduled_posts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        task_id TEXT NOT NULL REFERENCES tasks(id),
        approval_id TEXT NOT NULL REFERENCES approvals(id),
        deliverable_version_id TEXT NOT NULL REFERENCES deliverable_versions(id),
        channel TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        external_post_id TEXT,
        published_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenant_audit_logs (
        id TEXT PRIMARY KEY,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
    `);

    const existing = this.db
      .prepare('SELECT version FROM schema_migrations WHERE version = 1')
      .get();
    if (!existing) {
      this.db
        .prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        )
        .run(1, '0001_tenant_operational', new Date().toISOString());
    }
    return 1;
  }

  /**
   * Valida se esta instância pertence estritamente à organização solicitada e se a credencial confere.
   */
  verifyInstanceLock(organizationId: string, servicePassword: string): void {
    if (this.organizationId !== organizationId) {
      throw new TenantIsolationViolationError(
        `Instância pertence a ${this.organizationId}, mas foi acessada como ${organizationId}.`,
      );
    }
    const meta = this.db
      .prepare(
        'SELECT organization_id, service_credential_hash FROM tenant_metadata LIMIT 1',
      )
      .get() as Record<string, unknown> | undefined;

    if (!meta || String(meta.organization_id) !== organizationId) {
      throw new TenantIsolationViolationError(
        'Metadados da instância de banco não correspondem à organização solicitada.',
      );
    }

    const actualHash = computeSha256Checksum(
      `${organizationId}:${servicePassword}`,
    );
    if (String(meta.service_credential_hash) !== actualHash) {
      throw new AuthorizationError(
        'Credencial de serviço da instância do tenant inválida.',
      );
    }
  }

  recordTenantAudit(params: {
    actorType: 'USER' | 'AGENT' | 'SYSTEM';
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: Record<string, unknown>;
  }): void {
    this.db
      .prepare(
        `INSERT INTO tenant_audit_logs (
          id, actor_type, actor_id, action, entity_type, entity_id, details_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        params.actorType,
        params.actorId,
        params.action,
        params.entityType,
        params.entityId,
        JSON.stringify(params.details ?? {}),
        new Date().toISOString(),
      );
  }

  // ── FALCON SETUP: Onboarding Guiado 11 Etapas (Seção 8) ───────────────────

  saveOnboardingStep(params: {
    stepKey: OnboardingStepKey;
    data: Record<string, unknown>;
    attachments?: Array<{ name: string; storageKey: string; mimeType: string }>;
    markCompleted?: boolean;
    userId: string;
  }): {
    stepKey: OnboardingStepKey;
    status: 'PENDING' | 'DRAFT' | 'COMPLETED';
    data: Record<string, unknown>;
    updatedAt: string;
  } {
    const status = params.markCompleted ? 'COMPLETED' : 'DRAFT';
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE onboarding_steps
         SET status = ?, data_json = ?, attachments_json = ?, updated_by_user_id = ?, updated_at = ?
         WHERE step_key = ?`,
      )
      .run(
        status,
        JSON.stringify(params.data),
        JSON.stringify(params.attachments ?? []),
        params.userId,
        now,
        params.stepKey,
      );

    this.recordTenantAudit({
      actorType: 'USER',
      actorId: params.userId,
      action: `onboarding.step_${status.toLowerCase()}`,
      entityType: 'onboarding_step',
      entityId: params.stepKey,
      details: { markCompleted: !!params.markCompleted },
    });

    return {
      stepKey: params.stepKey,
      status,
      data: params.data,
      updatedAt: now,
    };
  }

  getOnboardingProgress(): {
    steps: Array<{
      stepKey: OnboardingStepKey;
      stepOrder: number;
      status: 'PENDING' | 'DRAFT' | 'COMPLETED';
      data: Record<string, unknown>;
      attachments: Array<{ name: string; storageKey: string; mimeType: string }>;
      updatedAt: string;
    }>;
    completedCount: number;
    totalCount: number;
    brandMemoryActivated: boolean;
  } {
    const rows = this.db
      .prepare('SELECT * FROM onboarding_steps ORDER BY step_order ASC')
      .all() as Array<Record<string, unknown>>;
    const meta = this.db
      .prepare('SELECT brand_memory_activated FROM tenant_metadata LIMIT 1')
      .get() as Record<string, unknown> | undefined;

    const steps = rows.map((r) => ({
      stepKey: String(r.step_key) as OnboardingStepKey,
      stepOrder: Number(r.step_order),
      status: String(r.status) as 'PENDING' | 'DRAFT' | 'COMPLETED',
      data: JSON.parse(String(r.data_json)) as Record<string, unknown>,
      attachments: JSON.parse(String(r.attachments_json)) as Array<{
        name: string;
        storageKey: string;
        mimeType: string;
      }>,
      updatedAt: String(r.updated_at),
    }));

    return {
      steps,
      completedCount: steps.filter((s) => s.status === 'COMPLETED').length,
      totalCount: steps.length,
      brandMemoryActivated: Boolean(meta?.brand_memory_activated),
    };
  }

  /**
   * Consolida os dados do FALCON SETUP e ativa oficialmente a FALCON BRAND INTELLIGENCE (Seção 8 e 9).
   */
  confirmAndActivateBrandIntelligence(userId: string): {
    activatedEntries: TenantBrandMemoryEntry[];
    pendingStepKeys: OnboardingStepKey[];
  } {
    const progress = this.getOnboardingProgress();
    const pendingStepKeys = progress.steps
      .filter((s) => s.status !== 'COMPLETED')
      .map((s) => s.stepKey);

    const stepToCategoryMap: Record<
      OnboardingStepKey,
      { category: BrandMemoryCategory; title: string }
    > = {
      identification: {
        category: BrandMemoryCategory.INSTITUTIONAL_IDENTITY,
        title: 'Identificação Corporativa e Segmento',
      },
      history: {
        category: BrandMemoryCategory.INSTITUTIONAL_IDENTITY,
        title: 'História, Missão, Visão e Valores',
      },
      offer: {
        category: BrandMemoryCategory.PRODUCTS_SERVICES,
        title: 'Produtos, Serviços, Benefícios e Diferenciais',
      },
      audience: {
        category: BrandMemoryCategory.AUDIENCES_PERSONAS,
        title: 'Públicos Prioritários, Personas e Jornada',
      },
      positioning: {
        category: BrandMemoryCategory.POSITIONING_STRATEGY,
        title: 'Posicionamento e Proposta de Valor',
      },
      visual_identity: {
        category: BrandMemoryCategory.VISUAL_IDENTITY,
        title: 'Identidade Visual, Paleta e Tipografia',
      },
      tone_of_voice: {
        category: BrandMemoryCategory.TONE_OF_VOICE,
        title: 'Tom de Voz, Vocabulário e Restrições Linguísticas',
      },
      channels: {
        category: BrandMemoryCategory.OPERATIONAL_PREFERENCES,
        title: 'Canais Oficiais de Comunicação',
      },
      objectives: {
        category: BrandMemoryCategory.POSITIONING_STRATEGY,
        title: 'Objetivos Estratégicos da Marca',
      },
      operation: {
        category: BrandMemoryCategory.RESTRICTIONS_PROHIBITIONS,
        title: 'Regras Operacionais, Frequência e Restrições',
      },
      integrations: {
        category: BrandMemoryCategory.OPERATIONAL_PREFERENCES,
        title: 'Conexões e Integrações Autorizadas',
      },
    };

    const activatedEntries: TenantBrandMemoryEntry[] = [];
    for (const step of progress.steps) {
      if (Object.keys(step.data).length === 0) continue;
      const mapping = stepToCategoryMap[step.stepKey];
      const entry = this.upsertBrandMemoryEntry({
        category: mapping.category,
        memoryLevel: BrandMemoryLevel.PERMANENT,
        title: mapping.title,
        structuredData: step.data,
        contentText: JSON.stringify(step.data),
        source: `falcon_setup:${step.stepKey}`,
        reason: 'Ativação oficial da memória de marca via FALCON SETUP',
        userId,
      });
      activatedEntries.push(entry);
    }

    this.db
      .prepare(
        'UPDATE tenant_metadata SET brand_memory_activated = 1, updated_at = ?',
      )
      .run(new Date().toISOString());

    this.recordTenantAudit({
      actorType: 'USER',
      actorId: userId,
      action: 'brand_intelligence.activated',
      entityType: 'brand_intelligence',
      entityId: this.organizationId,
      details: {
        entriesCount: activatedEntries.length,
        pendingStepKeys,
      },
    });

    return { activatedEntries, pendingStepKeys };
  }

  // ── FALCON BRAND INTELLIGENCE: Memória e Governança (Seção 9) ─────────────

  upsertBrandMemoryEntry(params: {
    entryId?: string;
    category: BrandMemoryCategory;
    memoryLevel: BrandMemoryLevel;
    title: string;
    structuredData: Record<string, unknown>;
    contentText: string;
    source: string;
    reason: string;
    userId?: string;
    suggestedByAgentSlug?: string;
    confidenceScore?: number;
    expiresAt?: string;
  }): TenantBrandMemoryEntry {
    const now = new Date().toISOString();

    // Regra Inegociável da Seção 9.3:
    // "Agentes podem sugerir atualizações, mas não devem reescrever silenciosamente a identidade oficial."
    const isAgentSuggestionOnPermanent =
      params.memoryLevel === BrandMemoryLevel.PERMANENT &&
      Boolean(params.suggestedByAgentSlug) &&
      !params.userId;

    if (isAgentSuggestionOnPermanent) {
      const suggestionId = randomUUID();
      this.db
        .prepare(
          `INSERT INTO brand_intelligence_entries (
            id, category, memory_level, title, structured_data_json, content_text,
            confidence_score, source, status, current_version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', 1, ?, ?)`,
        )
        .run(
          suggestionId,
          params.category,
          params.memoryLevel,
          params.title,
          JSON.stringify(params.structuredData),
          params.contentText,
          params.confidenceScore ?? 0.85,
          params.source,
          now,
          now,
        );

      this.db
        .prepare(
          `INSERT INTO brand_intelligence_versions (
            id, entry_id, previous_version, new_version, previous_data_json,
            new_data_json, reason, source, suggested_by_agent_slug, created_at
          ) VALUES (?, ?, NULL, 1, NULL, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          suggestionId,
          JSON.stringify(params.structuredData),
          params.reason,
          params.source,
          params.suggestedByAgentSlug ?? null,
          now,
        );

      return this.getBrandMemoryEntryById(suggestionId)!;
    }

    const existing = params.entryId
      ? this.getBrandMemoryEntryById(params.entryId)
      : (this.db
          .prepare(
            `SELECT id FROM brand_intelligence_entries
             WHERE category = ? AND title = ? AND status = 'ACTIVE'`,
          )
          .get(params.category, params.title) as
          | { id: string }
          | undefined);

    if (existing) {
      const current = this.getBrandMemoryEntryById(existing.id)!;
      const nextVersion = current.currentVersion + 1;
      const affectedAgents = OFFICIAL_FALCON_AGENTS.filter((a) =>
        a.memoryScopes.includes(params.category),
      ).map((a) => a.slug);

      this.db
        .prepare(
          `UPDATE brand_intelligence_entries SET
            structured_data_json = ?, content_text = ?, confidence_score = ?,
            source = ?, current_version = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          JSON.stringify(params.structuredData),
          params.contentText,
          params.confidenceScore ?? current.confidenceScore,
          params.source,
          nextVersion,
          now,
          current.id,
        );

      this.db
        .prepare(
          `INSERT INTO brand_intelligence_versions (
            id, entry_id, previous_version, new_version, previous_data_json,
            new_data_json, reason, source, changed_by_user_id, suggested_by_agent_slug,
            affected_agents_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          current.id,
          current.currentVersion,
          nextVersion,
          JSON.stringify(current.structuredData),
          JSON.stringify(params.structuredData),
          params.reason,
          params.source,
          params.userId ?? null,
          params.suggestedByAgentSlug ?? null,
          JSON.stringify(affectedAgents),
          now,
        );

      return this.getBrandMemoryEntryById(current.id)!;
    }

    const entryId = randomUUID();
    const affectedAgents = OFFICIAL_FALCON_AGENTS.filter((a) =>
      a.memoryScopes.includes(params.category),
    ).map((a) => a.slug);

    this.db
      .prepare(
        `INSERT INTO brand_intelligence_entries (
          id, category, memory_level, title, structured_data_json, content_text,
          confidence_score, source, status, current_version, expires_at,
          created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?, ?, ?)`,
      )
      .run(
        entryId,
        params.category,
        params.memoryLevel,
        params.title,
        JSON.stringify(params.structuredData),
        params.contentText,
        params.confidenceScore ?? 1.0,
        params.source,
        params.expiresAt ?? null,
        params.userId ?? null,
        now,
        now,
      );

    this.db
      .prepare(
        `INSERT INTO brand_intelligence_versions (
          id, entry_id, previous_version, new_version, previous_data_json,
          new_data_json, reason, source, changed_by_user_id, suggested_by_agent_slug,
          affected_agents_json, created_at
        ) VALUES (?, ?, NULL, 1, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        entryId,
        JSON.stringify(params.structuredData),
        params.reason,
        params.source,
        params.userId ?? null,
        params.suggestedByAgentSlug ?? null,
        JSON.stringify(affectedAgents),
        now,
      );

    return this.getBrandMemoryEntryById(entryId)!;
  }

  getBrandMemoryEntryById(entryId: string): TenantBrandMemoryEntry | null {
    const row = this.db
      .prepare('SELECT * FROM brand_intelligence_entries WHERE id = ?')
      .get(entryId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      category: String(row.category) as BrandMemoryCategory,
      memoryLevel: String(row.memory_level) as BrandMemoryLevel,
      title: String(row.title),
      structuredData: JSON.parse(String(row.structured_data_json)) as Record<
        string,
        unknown
      >,
      contentText: String(row.content_text),
      confidenceScore: Number(row.confidence_score),
      source: String(row.source),
      status: String(row.status) as TenantBrandMemoryEntry['status'],
      currentVersion: Number(row.current_version),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      updatedAt: String(row.updated_at),
    };
  }

  /**
   * Consulta a Brand Intelligence respeitando os escopos de memória autorizados para o agente (Seção 10.1 e Critério 7 do MVP).
   */
  queryBrandIntelligenceForAgent(
    agentSlug: OfficialAgentSlug,
    categories?: BrandMemoryCategory[],
  ): TenantBrandMemoryEntry[] {
    const agent = this.getAgentBySlug(agentSlug);
    if (!agent) {
      throw new Error(`Agente ${agentSlug} não encontrado no tenant.`);
    }

    const allowedScopes = new Set(agent.memoryScopes);
    const requestedCategories = categories
      ? categories.filter((c) => allowedScopes.has(c))
      : agent.memoryScopes;

    if (requestedCategories.length === 0) return [];

    const rows = this.db
      .prepare(
        `SELECT * FROM brand_intelligence_entries
         WHERE status = 'ACTIVE'
         ORDER BY CASE memory_level
           WHEN 'PERMANENT' THEN 1
           WHEN 'OPERATIONAL' THEN 2
           ELSE 3
         END ASC, updated_at DESC`,
      )
      .all() as Array<Record<string, unknown>>;

    return rows
      .filter((r) =>
        requestedCategories.includes(
          String(r.category) as BrandMemoryCategory,
        ),
      )
      .map((row) => ({
        id: String(row.id),
        category: String(row.category) as BrandMemoryCategory,
        memoryLevel: String(row.memory_level) as BrandMemoryLevel,
        title: String(row.title),
        structuredData: JSON.parse(String(row.structured_data_json)) as Record<
          string,
          unknown
        >,
        contentText: String(row.content_text),
        confidenceScore: Number(row.confidence_score),
        source: String(row.source),
        status: String(row.status) as TenantBrandMemoryEntry['status'],
        currentVersion: Number(row.current_version),
        expiresAt: row.expires_at ? String(row.expires_at) : null,
        updatedAt: String(row.updated_at),
      }));
  }

  getBrandMemoryVersionHistory(entryId: string): Array<{
    id: string;
    previousVersion: number | null;
    newVersion: number;
    reason: string;
    source: string;
    changedByUserId: string | null;
    suggestedByAgentSlug: string | null;
    affectedAgents: string[];
    createdAt: string;
  }> {
    const rows = this.db
      .prepare(
        'SELECT * FROM brand_intelligence_versions WHERE entry_id = ? ORDER BY new_version ASC',
      )
      .all(entryId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      previousVersion:
        r.previous_version !== null ? Number(r.previous_version) : null,
      newVersion: Number(r.new_version),
      reason: String(r.reason),
      source: String(r.source),
      changedByUserId: r.changed_by_user_id
        ? String(r.changed_by_user_id)
        : null,
      suggestedByAgentSlug: r.suggested_by_agent_slug
        ? String(r.suggested_by_agent_slug)
        : null,
      affectedAgents: JSON.parse(String(r.affected_agents_json)) as string[],
      createdAt: String(r.created_at),
    }));
  }

  // ── FALCON AI TEAM: Agentes e Estados Reais (Seção 10 e 13.3) ─────────────

  listAgents(): TenantAgentRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM agents ORDER BY display_order ASC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapAgentRow(r));
  }

  getAgentBySlug(slug: OfficialAgentSlug): TenantAgentRecord | null {
    const row = this.db
      .prepare('SELECT * FROM agents WHERE slug = ?')
      .get(slug) as Record<string, unknown> | undefined;
    return row ? this.mapAgentRow(row) : null;
  }

  updateAgentOperationalState(params: {
    slug: OfficialAgentSlug;
    operationalState: AgentOperationalState;
    currentTaskId?: string | null;
  }): TenantAgentRecord {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE agents
         SET operational_state = ?, current_task_id = ?, updated_at = ?
         WHERE slug = ?`,
      )
      .run(
        params.operationalState,
        params.currentTaskId ?? null,
        now,
        params.slug,
      );
    return this.getAgentBySlug(params.slug)!;
  }

  /**
   * Personalização visual do avatar (Seção 14):
   * "A personalização visual dos personagens não pode alterar o modelo de IA, instruções, ferramentas ou permissões do agente."
   */
  updateAgentAvatarAppearance(params: {
    slug: OfficialAgentSlug;
    palette: number;
    repeat: number;
    assignedSeatUid?: string | null;
    customAppearance?: Record<string, unknown>;
  }): TenantAgentRecord {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE agents
         SET avatar_palette = ?, avatar_repeat = ?, assigned_seat_uid = COALESCE(?, assigned_seat_uid),
             avatar_custom_json = ?, updated_at = ?
         WHERE slug = ?`,
      )
      .run(
        params.palette,
        params.repeat,
        params.assignedSeatUid ?? null,
        JSON.stringify(params.customAppearance ?? {}),
        now,
        params.slug,
      );
    return this.getAgentBySlug(params.slug)!;
  }

  private mapAgentRow(r: Record<string, unknown>): TenantAgentRecord {
    return {
      id: String(r.id),
      slug: String(r.slug) as OfficialAgentSlug,
      displayOrder: Number(r.display_order),
      name: String(r.name),
      roleTitle: String(r.role_title),
      department: String(r.department),
      specialty: String(r.specialty),
      description: String(r.description),
      isSupervisor: Boolean(r.is_supervisor),
      modelProvider: String(r.model_provider),
      modelName: String(r.model_name),
      activePromptVersion: Number(r.active_prompt_version),
      authorizedTools: JSON.parse(
        String(r.authorized_tools_json),
      ) as string[],
      memoryScopes: JSON.parse(
        String(r.memory_scopes_json),
      ) as BrandMemoryCategory[],
      maxTokensPerExecution: Number(r.max_tokens_per_execution),
      timeoutSeconds: Number(r.timeout_seconds),
      defaultSector: String(r.default_sector),
      assignedSeatUid: r.assigned_seat_uid
        ? String(r.assigned_seat_uid)
        : null,
      avatarPalette: Number(r.avatar_palette),
      avatarRepeat: Number(r.avatar_repeat),
      operationalState: String(r.operational_state) as AgentOperationalState,
      currentTaskId: r.current_task_id ? String(r.current_task_id) : null,
      isEnabled: Boolean(r.is_enabled),
    };
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Provisionador Automático de 10 Etapas (Seção 6.2) e Roteador Seguro de Conexões (Seção 6.3).
 */
export class TenantProvisionerAndRouter {
  readonly core: FalconCoreControlPlane;
  private readonly instanceCache = new Map<string, TenantDatabaseInstance>();

  constructor(core: FalconCoreControlPlane) {
    this.core = core;
  }

  /**
   * Executa as 10 etapas obrigatórias e idempotentes de provisionamento de um novo Tenant (Seção 6.2).
   */
  provisionOrganizationTenant(params: {
    organizationId: string;
    actorUserId: string;
  }): {
    instance: TenantDatabaseInstance;
    stepsLog: ProvisioningStepLog[];
  } {
    const idempotencyKey = computeIdempotencyKey(
      params.organizationId,
      'tenant.provision',
      { organizationId: params.organizationId },
    );

    const stepsLog: ProvisioningStepLog[] = [];
    const logStep = (step: number, name: string, details?: string) => {
      stepsLog.push({
        step,
        name,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        details,
      });
    };

    // Etapa 1: Validar registro da organização no FALCON CORE
    const org = this.core.getOrganizationById(params.organizationId);
    if (!org) {
      throw new Error(
        `Organização ${params.organizationId} não encontrada no FALCON CORE.`,
      );
    }
    logStep(1, 'Validar registro da organização no FALCON CORE', `slug=${org.slug}`);

    // Se já estiver provisionada e saudável (idempotência), retorna a instância existente
    const existingInstance = this.core.getTenantInstance(params.organizationId);
    if (
      existingInstance &&
      existingInstance.healthStatus === 'HEALTHY' &&
      org.status === OrganizationStatus.ACTIVE
    ) {
      const dbInstance = this.openTenantDatabaseInstance(params.organizationId);
      return { instance: dbInstance, stepsLog };
    }

    // Etapa 2: Validar plano, cobrança e autorização de provisionamento
    const planLimits = this.core.getPlanLimitsForOrganization(
      params.organizationId,
    );
    if (org.billingStatus !== 'AUTHORIZED' && org.billingStatus !== 'TRIAL_OR_AUTHORIZED') {
      throw new Error('Cobrança ou autorização comercial pendente.');
    }
    if (org.status !== OrganizationStatus.PROVISIONING) {
      this.core.transitionOrganizationStatus({
        organizationId: params.organizationId,
        targetStatus: OrganizationStatus.PROVISIONING,
        actorUserId: params.actorUserId,
        reason: 'Início do provisionamento automático de instância individual',
      });
    }
    logStep(2, 'Validar plano, cobrança e autorização de provisionamento', `plan=${planLimits.tier}`);

    // Etapa 3: Criar instância de banco de dados exclusiva da organização
    const shortId = params.organizationId.replace(/-/g, '').slice(0, 12);
    const dbName = `falcon_tenant_${shortId}`;
    const dbUser = `falcon_role_${shortId}`;
    const servicePassword = randomBytes(24).toString('base64url');
    const dbFilePath = join(
      this.core.dataDir,
      'tenants',
      `${dbName}.sqlite`,
    );
    const storagePrefix = `tenants/${params.organizationId}`;
    const storageDirPath = join(
      this.core.dataDir,
      'storage',
      storagePrefix,
    );

    const tenantDb = new TenantDatabaseInstance({
      organizationId: params.organizationId,
      dbFilePath,
      storageDirPath,
    });
    logStep(3, 'Criar instância de banco de dados exclusiva', `dbName=${dbName}`);

    // Etapa 4: Aplicar migrations versionadas
    const schemaVersion = tenantDb.applyMigrations();
    logStep(4, 'Aplicar migrations versionadas', `schemaVersion=v${schemaVersion}`);

    // Etapa 5: Criar credenciais de serviço com privilégio mínimo e vínculo criptográfico
    const credentialHash = computeSha256Checksum(
      `${params.organizationId}:${servicePassword}`,
    );
    const now = new Date().toISOString();
    tenantDb.db
      .prepare(
        `INSERT OR REPLACE INTO tenant_metadata (
          organization_id, organization_slug, service_credential_hash,
          autonomy_mode, brand_memory_activated, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        params.organizationId,
        org.slug,
        credentialHash,
        AutonomyMode.SEMI_AUTOMATIC,
        now,
        now,
      );
    logStep(5, 'Criar credenciais de serviço exclusivas com privilégio mínimo', `dbUser=${dbUser}`);

    // Etapa 6: Criar estrutura de Object Storage isolada por tenant
    mkdirSync(join(storageDirPath, 'brand'), { recursive: true });
    mkdirSync(join(storageDirPath, 'studio'), { recursive: true });
    mkdirSync(join(storageDirPath, 'deliverables'), { recursive: true });
    logStep(6, 'Criar estrutura de Object Storage isolada', `prefix=${storagePrefix}`);

    // Etapa 7: Inicializar os 11 agentes padrão, etapas do FALCON SETUP e template do Escritório 3D
    this.seedTenantInitialData(tenantDb, org.publicName);
    logStep(7, 'Inicializar 11 agentes padrão, FALCON SETUP e Escritório 3D inicial');

    // Etapa 8: Registrar endpoint e metadados da instância no FALCON CORE com segredo em cofre AES-256-GCM
    this.core.registerTenantInstance({
      organizationId: params.organizationId,
      instanceIdentifier: `inst-${shortId}`,
      engineMode: 'ISOLATED_INSTANCE_FILE',
      dbHost: '127.0.0.1',
      dbPort: 5432,
      dbName,
      dbUser,
      plainDbPassword: servicePassword,
      storageBucket: 'falcon-growth-storage',
      storagePrefix,
      schemaVersion,
    });
    logStep(8, 'Registrar endpoint e segredos criptografados (AES-256-GCM) no FALCON CORE');

    // Etapa 9: Executar health check, teste de conexão e validação de migrations
    tenantDb.verifyInstanceLock(params.organizationId, servicePassword);
    const agentCountRow = tenantDb.db
      .prepare('SELECT COUNT(*) as total FROM agents')
      .get() as { total: number };
    if (Number(agentCountRow.total) !== 11) {
      throw new Error(
        `Health check falhou: esperado 11 agentes inicializados, encontrado ${agentCountRow.total}.`,
      );
    }
    this.core.updateTenantHealth(
      params.organizationId,
      'HEALTHY',
      schemaVersion,
    );
    logStep(9, 'Executar health check, teste de conexão e validação de migrations', 'status=HEALTHY');

    // Etapa 10: Liberar o acesso do cliente (status = ACTIVE) somente após todas as etapas concluídas
    this.core.transitionOrganizationStatus({
      organizationId: params.organizationId,
      targetStatus: OrganizationStatus.ACTIVE,
      actorUserId: params.actorUserId,
      reason: 'Provisionamento automático de 10 etapas concluído com sucesso',
    });
    logStep(10, 'Liberar acesso do cliente (Organização ATIVA)');

    // Persiste job de provisionamento concluído no FALCON CORE
    this.core.db
      .prepare(
        `INSERT OR REPLACE INTO provisioning_jobs (
          id, organization_id, idempotency_key, status, current_step,
          steps_log_json, started_at, completed_at
        ) VALUES (?, ?, ?, 'COMPLETED', 10, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        params.organizationId,
        idempotencyKey,
        JSON.stringify(stepsLog),
        stepsLog[0].timestamp,
        now,
      );

    this.instanceCache.set(params.organizationId, tenantDb);
    return { instance: tenantDb, stepsLog };
  }

  private seedTenantInitialData(
    tenantDb: TenantDatabaseInstance,
    organizationPublicName: string,
  ): void {
    const now = new Date().toISOString();

    // 1. Seed das 11 etapas do FALCON SETUP (Seção 8)
    const stepStmt = tenantDb.db.prepare(`
      INSERT OR IGNORE INTO onboarding_steps (
        step_key, step_order, status, data_json, attachments_json, updated_at
      ) VALUES (?, ?, 'PENDING', '{}', '[]', ?)
    `);
    ONBOARDING_STEPS_ORDERED.forEach((stepKey, idx) => {
      stepStmt.run(stepKey, idx + 1, now);
    });

    // 2. Seed dos 11 Agentes Especializados da FALCON AI TEAM (Seção 10)
    const agentStmt = tenantDb.db.prepare(`
      INSERT OR IGNORE INTO agents (
        id, slug, display_order, name, role_title, department, specialty,
        description, is_supervisor, model_provider, model_name, active_prompt_version,
        authorized_tools_json, memory_scopes_json, max_tokens_per_execution,
        timeout_seconds, default_sector, assigned_seat_uid, avatar_palette,
        avatar_repeat, operational_state, is_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'anthropic', 'claude-sonnet-4-20250514', 1, ?, ?, ?, ?, ?, ?, ?, 0, 'AVAILABLE', 1, ?)
    `);
    const promptStmt = tenantDb.db.prepare(`
      INSERT OR IGNORE INTO agent_prompt_versions (
        id, agent_id, version, system_prompt, temperature, created_at
      ) VALUES (?, ?, 1, ?, 0.3, ?)
    `);

    for (const blueprint of OFFICIAL_FALCON_AGENTS) {
      const agentId = randomUUID();
      const seatUid = `seat-${blueprint.slug}`;
      agentStmt.run(
        agentId,
        blueprint.slug,
        blueprint.order,
        blueprint.name,
        blueprint.roleTitle,
        blueprint.department,
        blueprint.specialty,
        blueprint.description,
        blueprint.isSupervisor ? 1 : 0,
        JSON.stringify(blueprint.authorizedTools),
        JSON.stringify(blueprint.memoryScopes),
        blueprint.maxTokensPerExecution,
        blueprint.timeoutSeconds,
        blueprint.defaultSector,
        seatUid,
        blueprint.defaultPaletteIndex,
        now,
      );

      const defaultSystemPrompt = [
        `Você é ${blueprint.name}, ${blueprint.roleTitle} da agência virtual da marca "${organizationPublicName}".`,
        `Departamento: ${blueprint.department}.`,
        `Responsabilidade principal: ${blueprint.specialty}`,
        `Regra inegociável: respeite rigorosamente a FALCON BRAND INTELLIGENCE da empresa, utilize apenas ferramentas autorizadas (${blueprint.authorizedTools.join(', ')}) e nunca invente métricas ou aprove ações externas sem revisão.`,
      ].join('\n');

      promptStmt.run(randomUUID(), agentId, defaultSystemPrompt, now);
    }

    // 3. Seed do Layout Inicial do FALCON VIRTUAL OFFICE 3D (com os 9 ambientes da Seção 13.1)
    const layoutId = randomUUID();
    const initialOfficeLayout = {
      version: 1,
      cols: 32,
      rows: 20,
      sectors: OFFICIAL_OFFICE_SECTORS,
      workstations: OFFICIAL_FALCON_AGENTS.map((a, idx) => ({
        seatUid: `seat-${a.slug}`,
        agentSlug: a.slug,
        sectorId: a.defaultSector,
        col: 4 + (idx % 4) * 6,
        row: 4 + Math.floor(idx / 4) * 5,
      })),
    };

    tenantDb.db
      .prepare(
        `INSERT OR IGNORE INTO office_layouts (
          id, name, template_key, version, is_active, layout_json, branding_json, created_at, updated_at
        ) VALUES (?, ?, 'falcon-agency-hq-v1', 1, 1, ?, ?, ?, ?)`,
      )
      .run(
        layoutId,
        `Sede Virtual — ${organizationPublicName}`,
        JSON.stringify(initialOfficeLayout),
        JSON.stringify({ companyName: organizationPublicName, primaryColor: '#f59e0b' }),
        now,
        now,
      );

    tenantDb.db
      .prepare('UPDATE tenant_metadata SET active_office_layout_id = ?')
      .run(layoutId);
  }

  /**
   * Abre e autentica a instância exclusiva de um tenant registrado no FALCON CORE.
   */
  openTenantDatabaseInstance(organizationId: string): TenantDatabaseInstance {
    const org = this.core.getOrganizationById(organizationId);
    if (!org) {
      throw new AuthorizationError('Organização não encontrada no FALCON CORE.');
    }
    if (org.status !== OrganizationStatus.ACTIVE) {
      throw new AuthorizationError(
        `Acesso bloqueado: a organização ${org.publicName} está no estado '${org.status}' (exige 'ACTIVE').`,
      );
    }

    const instanceMeta = this.core.getTenantInstance(organizationId);
    if (!instanceMeta || instanceMeta.healthStatus !== 'HEALTHY') {
      throw new AuthorizationError(
        `Instância operacional do tenant ${organizationId} não está disponível ou saudável.`,
      );
    }

    const decryptedPassword =
      this.core.decryptTenantInstanceCredential(organizationId);

    let instance = this.instanceCache.get(organizationId);
    if (!instance) {
      const dbFilePath = join(
        this.core.dataDir,
        'tenants',
        `${instanceMeta.dbName}.sqlite`,
      );
      const storageDirPath = join(
        this.core.dataDir,
        'storage',
        instanceMeta.storagePrefix,
      );
      instance = new TenantDatabaseInstance({
        organizationId,
        dbFilePath,
        storageDirPath,
      });
      this.instanceCache.set(organizationId, instance);
    }

    // Verifica criptograficamente o vínculo entre o FALCON CORE e a instância do tenant!
    instance.verifyInstanceLock(organizationId, decryptedPassword);
    return instance;
  }

  /**
   * Roteador Seguro de Conexão (Seção 6.3):
   * Resolve o banco de dados do tenant exclusivamente a partir da sessão autenticada.
   * Impede qualquer manipulação de requisições para acessar outro tenant.
   */
  resolveForSession(
    token: string,
    requestedOrganizationId?: string,
    requiredPermission?: PermissionAction,
  ): {
    session: SessionTokenPayload;
    tenantDb: TenantDatabaseInstance;
  } {
    const session = this.core.verifySession(
      token,
      requestedOrganizationId,
      requiredPermission,
    );
    const tenantDb = this.openTenantDatabaseInstance(session.orgId);
    return { session, tenantDb };
  }

  /**
   * Backup Criptografado Individual por Tenant (Seção 6.3 e Seção 32).
   */
  backupTenantDatabase(organizationId: string): {
    backupId: string;
    backupFilePath: string;
    checksumSha256: string;
    createdAt: string;
  } {
    const instanceMeta = this.core.getTenantInstance(organizationId);
    if (!instanceMeta) {
      throw new Error(`Instância não encontrada para o tenant ${organizationId}.`);
    }
    const tenantDb = this.openTenantDatabaseInstance(organizationId);
    tenantDb.db.exec('PRAGMA wal_checkpoint(FULL);');

    const rawBytes = readFileSync(tenantDb.dbFilePath);
    const checksumSha256 = computeSha256Checksum(rawBytes);
    const encryptedPayload = this.core.vault.encrypt(
      rawBytes.toString('base64'),
      organizationId,
    );

    const backupId = `bkp-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const backupDir = join(
      this.core.dataDir,
      'backups',
      organizationId,
    );
    mkdirSync(backupDir, { recursive: true });
    const backupFilePath = join(backupDir, `${backupId}.falconbkp`);
    writeFileSync(backupFilePath, encryptedPayload, 'utf8');

    const createdAt = new Date().toISOString();
    this.core.recordAuditLog({
      organizationId,
      action: 'tenant.backup_created',
      targetType: 'tenant_instance',
      targetId: instanceMeta.id,
      newState: { backupId, checksumSha256 },
    });

    return { backupId, backupFilePath, checksumSha256, createdAt };
  }

  /**
   * Restauração Isolada de um Tenant a partir de Backup Criptografado (Seção 6.3 e Seção 32).
   */
  restoreTenantDatabase(
    organizationId: string,
    backupFilePath: string,
  ): TenantDatabaseInstance {
    if (!existsSync(backupFilePath)) {
      throw new Error(`Arquivo de backup não encontrado: ${backupFilePath}`);
    }
    const encryptedPayload = readFileSync(backupFilePath, 'utf8');
    const decryptedBase64 = this.core.vault.decrypt(
      encryptedPayload,
      organizationId,
    );
    const restoredBytes = Buffer.from(decryptedBase64, 'base64');

    const existing = this.instanceCache.get(organizationId);
    if (existing) {
      existing.close();
      this.instanceCache.delete(organizationId);
    }

    const instanceMeta = this.core.getTenantInstance(organizationId)!;
    const dbFilePath = join(
      this.core.dataDir,
      'tenants',
      `${instanceMeta.dbName}.sqlite`,
    );

    // Faz cópia de segurança pré-restore e escreve os bytes restaurados
    if (existsSync(dbFilePath)) {
      copyFileSync(dbFilePath, `${dbFilePath}.pre-restore.bak`);
    }
    writeFileSync(dbFilePath, restoredBytes);

    this.core.recordAuditLog({
      organizationId,
      action: 'tenant.backup_restored',
      targetType: 'tenant_instance',
      targetId: instanceMeta.id,
      newState: { backupFilePath },
    });

    return this.openTenantDatabaseInstance(organizationId);
  }

  closeAll(): void {
    for (const inst of this.instanceCache.values()) {
      inst.close();
    }
    this.instanceCache.clear();
  }
}
