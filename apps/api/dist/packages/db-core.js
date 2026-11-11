/**
 * @falcon/db-core
 * Implementação do Control Plane (FALCON CORE — Seções 6 e 7 do Documento Mestre).
 * Gerencia autenticação, organizações, membros/papéis, planos, catálogo global,
 * registro criptografado de instâncias de bancos de tenants, trilha de auditoria e consumo.
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  canTransitionOrganizationStatus,
  DEFAULT_PLAN_QUOTAS,
  OrganizationStatus,
                        
  PlanTier,
                       
  roleHasPermission,
  TenantRole,
} from './contracts.js';
import {
  hashPassword,
  SecretVault,
                           
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './security.js';

export class AuthorizationError extends Error {
           code = 'AUTHORIZATION_ERROR';
  constructor(message        ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class TenantIsolationViolationError extends Error {
           code = 'TENANT_ISOLATION_VIOLATION';
  constructor(message        ) {
    super(message);
    this.name = 'TenantIsolationViolationError';
  }
}

                                     
             
               
                    
                     
                         
                             
                     
                        
                    
                    
 

                             
             
                
                   
                                 
                    
                    
 

                                           
             
                         
                 
                   
                    
                    
 

                                       
             
                         
                             
                                                              
                 
                 
                 
                 
                                
                   
                        
                        
                        
                                                                                  
                                   
                    
                    
 

                                      
               
               
                                 
                    
                   
 

                                        
             
                         
                         
                                                         
                      
                                  
                              
                    
                             
 

                                          
                  
                          
                    
 

export class FalconCoreControlPlane {
           db              ;
           vault             ;
           dataDir        ;
                   jwtSecret        ;

  constructor(options                         ) {
    this.dataDir = options.dataDir;
    this.jwtSecret = options.jwtSecret;
    this.vault = new SecretVault(options.masterKmsKeyHex, 'kms-v1');

    const dbFile = join(this.dataDir, 'core', 'falcon_core.sqlite');
    mkdirSync(dirname(dbFile), { recursive: true });

    this.db = new DatabaseSync(dbFile);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.applyMigrations();
    this.seedDefaultPlans();
  }

          applyMigrations()       {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plans (
        tier TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        max_users INTEGER NOT NULL,
        max_active_agents INTEGER NOT NULL,
        max_projects_per_month INTEGER NOT NULL,
        max_tokens_per_month INTEGER NOT NULL,
        max_static_arts_per_month INTEGER NOT NULL,
        max_video_minutes_per_month INTEGER NOT NULL,
        max_storage_bytes INTEGER NOT NULL,
        max_social_channels INTEGER NOT NULL,
        allow_paid_ads_module INTEGER NOT NULL DEFAULT 0,
        allow_full_office_builder INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        legal_name TEXT NOT NULL,
        public_name TEXT NOT NULL,
        segment TEXT,
        status TEXT NOT NULL,
        plan_tier TEXT NOT NULL REFERENCES plans(tier),
        billing_status TEXT NOT NULL DEFAULT 'AUTHORIZED',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_internal_falcon_admin INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        UNIQUE(organization_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS tenant_instances (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT,
        instance_identifier TEXT NOT NULL UNIQUE,
        engine_mode TEXT NOT NULL,
        db_host TEXT NOT NULL,
        db_port INTEGER NOT NULL,
        db_name TEXT NOT NULL UNIQUE,
        db_user TEXT NOT NULL UNIQUE,
        encrypted_db_credential TEXT NOT NULL,
        kms_key_id TEXT NOT NULL,
        storage_bucket TEXT NOT NULL,
        storage_prefix TEXT NOT NULL UNIQUE,
        schema_version INTEGER NOT NULL DEFAULT 1,
        health_status TEXT NOT NULL,
        last_health_check_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provisioning_jobs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 0,
        steps_log_json TEXT NOT NULL DEFAULT '[]',
        error_message TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tenant_usage_ledger (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        period_month TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        api_calls_count INTEGER NOT NULL DEFAULT 0,
        static_arts_generated INTEGER NOT NULL DEFAULT 0,
        video_minutes_rendered REAL NOT NULL DEFAULT 0,
        storage_bytes_used INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, period_month)
      );

      CREATE TABLE IF NOT EXISTS core_audit_logs (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        organization_id TEXT,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        previous_state_json TEXT,
        new_state_json TEXT,
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
        .run(1, '0001_falcon_core', new Date().toISOString());
    }
  }

          seedDefaultPlans()       {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO plans (
        tier, name, max_users, max_active_agents, max_projects_per_month,
        max_tokens_per_month, max_static_arts_per_month, max_video_minutes_per_month,
        max_storage_bytes, max_social_channels, allow_paid_ads_module,
        allow_full_office_builder, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const plan of Object.values(DEFAULT_PLAN_QUOTAS)) {
      stmt.run(
        plan.tier,
        plan.name,
        plan.maxUsers,
        plan.maxActiveAgents,
        plan.maxProjectsPerMonth,
        plan.maxTokensPerMonth,
        plan.maxStaticArtsPerMonth,
        plan.maxVideoMinutesPerMonth,
        plan.maxStorageBytes,
        plan.maxSocialChannels,
        plan.allowPaidAdsModule ? 1 : 0,
        plan.allowFullOfficeBuilder ? 1 : 0,
        now,
      );
    }
  }

  // ── Auditoria do Control Plane ─────────────────────────────────────────────

  recordAuditLog(params   
                                
                                   
                   
                       
                     
                            
                       
   )       {
    this.db
      .prepare(
        `INSERT INTO core_audit_logs (
          id, actor_user_id, organization_id, action, target_type, target_id,
          previous_state_json, new_state_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        params.actorUserId ?? null,
        params.organizationId ?? null,
        params.action,
        params.targetType,
        params.targetId,
        params.previousState ? JSON.stringify(params.previousState) : null,
        params.newState ? JSON.stringify(params.newState) : null,
        new Date().toISOString(),
      );
  }

  getAuditLogs(organizationId         )         
               
                               
                                  
                   
                       
                     
                      
     {
    const rows = organizationId
      ? (this.db
          .prepare(
            'SELECT * FROM core_audit_logs WHERE organization_id = ? ORDER BY created_at DESC',
          )
          .all(organizationId)                                  )
      : (this.db
          .prepare('SELECT * FROM core_audit_logs ORDER BY created_at DESC')
          .all()                                  );

    return rows.map((r) => ({
      id: String(r.id),
      actorUserId: r.actor_user_id ? String(r.actor_user_id) : null,
      organizationId: r.organization_id ? String(r.organization_id) : null,
      action: String(r.action),
      targetType: String(r.target_type),
      targetId: String(r.target_id),
      createdAt: String(r.created_at),
    }));
  }

  // ── Usuários e Autenticação (Etapa 2) ──────────────────────────────────────

  registerUser(params   
                  
                     
                     
                                    
   )             {
    const normalizedEmail = params.email.trim().toLowerCase();
    const id = randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(params.password);

    this.db
      .prepare(
        `INSERT INTO users (
          id, email, full_name, password_hash, is_internal_falcon_admin, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        id,
        normalizedEmail,
        params.fullName.trim(),
        passwordHash,
        params.isInternalFalconAdmin ? 1 : 0,
        now,
        now,
      );

    this.recordAuditLog({
      actorUserId: id,
      action: 'user.registered',
      targetType: 'user',
      targetId: id,
      newState: { email: normalizedEmail, fullName: params.fullName },
    });

    return {
      id,
      email: normalizedEmail,
      fullName: params.fullName.trim(),
      isInternalFalconAdmin: !!params.isInternalFalconAdmin,
      isActive: true,
      createdAt: now,
    };
  }

  authenticateUser(params   
                  
                     
                            
   )   
                  
                     
                                     
                     
    {
    const normalizedEmail = params.email.trim().toLowerCase();
    const userRow = this.db
      .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
      .get(normalizedEmail)                                       ;

    if (
      !userRow ||
      !verifyPassword(params.password, String(userRow.password_hash))
    ) {
      throw new AuthorizationError('Credenciais de autenticação inválidas.');
    }

    const userId = String(userRow.id);
    const membershipRows = this.db
      .prepare(
        `SELECT m.role, m.organization_id
         FROM organization_members m
         WHERE m.user_id = ? AND m.is_active = 1`,
      )
      .all(userId)                                  ;

    if (membershipRows.length === 0) {
      throw new AuthorizationError(
        'Usuário não possui vínculo ativo com nenhuma organização.',
      );
    }

    const selectedMembership = params.organizationId
      ? membershipRows.find(
          (m) => String(m.organization_id) === params.organizationId,
        )
      : membershipRows[0];

    if (!selectedMembership) {
      this.recordAuditLog({
        actorUserId: userId,
        organizationId: params.organizationId ?? null,
        action: 'auth.cross_tenant_login_blocked',
        targetType: 'organization',
        targetId: params.organizationId ?? 'unknown',
      });
      throw new TenantIsolationViolationError(
        'Acesso negado: o usuário não pertence à organização solicitada.',
      );
    }

    const orgId = String(selectedMembership.organization_id);
    const role = String(selectedMembership.role)              ;
    const org = this.getOrganizationById(orgId);
    if (!org) {
      throw new AuthorizationError('Organização não encontrada.');
    }

    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, userId);

    const token = signSessionToken(
      {
        sub: userId,
        orgId: org.id,
        role,
        email: normalizedEmail,
        isInternalAdmin: Boolean(userRow.is_internal_falcon_admin),
      },
      this.jwtSecret,
    );

    return {
      token,
      user: {
        id: userId,
        email: normalizedEmail,
        fullName: String(userRow.full_name),
        isInternalFalconAdmin: Boolean(userRow.is_internal_falcon_admin),
        isActive: Boolean(userRow.is_active),
        createdAt: String(userRow.created_at),
      },
      organization: org,
      role,
    };
  }

  verifySession(
    token        ,
    requestedOrganizationId         ,
    requiredPermission                   ,
  )                      {
    let payload                     ;
    try {
      payload = verifySessionToken(token, this.jwtSecret);
    } catch (err) {
      throw new AuthorizationError((err         ).message);
    }

    // Regra de ouro de isolamento (Seção 6.3 e Critério de Aceite 3 do MVP):
    // Se uma requisição tentar manipular o organizationId para acessar outro tenant, bloqueia imediatamente!
    if (
      requestedOrganizationId &&
      requestedOrganizationId !== payload.orgId
    ) {
      this.recordAuditLog({
        actorUserId: payload.sub,
        organizationId: payload.orgId,
        action: 'security.tenant_isolation_violation_blocked',
        targetType: 'organization',
        targetId: requestedOrganizationId,
        newState: {
          sessionOrgId: payload.orgId,
          attemptedOrgId: requestedOrganizationId,
        },
      });
      throw new TenantIsolationViolationError(
        `Violação de isolamento de tenant bloqueada: sessão pertence à organização ${payload.orgId}, tentativa de acesso a ${requestedOrganizationId}.`,
      );
    }

    // Confirma no FALCON CORE que o membro continua ativo na organização
    const membership = this.db
      .prepare(
        `SELECT role, is_active FROM organization_members
         WHERE organization_id = ? AND user_id = ? AND is_active = 1`,
      )
      .get(payload.orgId, payload.sub)                                       ;

    if (!membership) {
      throw new AuthorizationError(
        'Vínculo do usuário com a organização foi revogado ou desativado.',
      );
    }

    const currentRole = String(membership.role)              ;
    if (
      requiredPermission &&
      !roleHasPermission(currentRole, requiredPermission)
    ) {
      this.recordAuditLog({
        actorUserId: payload.sub,
        organizationId: payload.orgId,
        action: 'security.permission_denied',
        targetType: 'permission',
        targetId: requiredPermission,
        newState: { role: currentRole, requiredPermission },
      });
      throw new AuthorizationError(
        `Permissão insuficiente: papel ${currentRole} não possui autorização para '${requiredPermission}'.`,
      );
    }

    return { ...payload, role: currentRole };
  }

  // ── Organizações, Membros e Ciclo de Vida (Seção 7) ────────────────────────

  createOrganization(params   
                 
                      
                       
                     
                        
                        
                                       
   )                     {
    const id = randomUUID();
    const now = new Date().toISOString();
    const slug = params.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    const status =
      params.initialStatus ?? OrganizationStatus.COMMERCIAL_ONBOARDING;
    const planTier = params.planTier ?? PlanTier.GROWTH;

    this.db
      .prepare(
        `INSERT INTO organizations (
          id, slug, legal_name, public_name, segment, status, plan_tier, billing_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'AUTHORIZED', ?, ?)`,
      )
      .run(
        id,
        slug,
        params.legalName.trim(),
        params.publicName.trim(),
        params.segment ?? null,
        status,
        planTier,
        now,
        now,
      );

    this.addOrganizationMember({
      organizationId: id,
      userId: params.ownerUserId,
      role: TenantRole.OWNER,
      actorUserId: params.ownerUserId,
    });

    this.recordAuditLog({
      actorUserId: params.ownerUserId,
      organizationId: id,
      action: 'organization.created',
      targetType: 'organization',
      targetId: id,
      newState: { slug, status, planTier },
    });

    return this.getOrganizationById(id) ;
  }

  addOrganizationMember(params   
                           
                   
                     
                         
   )                           {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO organization_members (id, organization_id, user_id, role, is_active, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
      )
      .run(id, params.organizationId, params.userId, params.role, now);

    this.recordAuditLog({
      actorUserId: params.actorUserId ?? params.userId,
      organizationId: params.organizationId,
      action: 'organization.member_added',
      targetType: 'organization_member',
      targetId: id,
      newState: { userId: params.userId, role: params.role },
    });

    return {
      id,
      organizationId: params.organizationId,
      userId: params.userId,
      role: params.role,
      isActive: true,
      createdAt: now,
    };
  }

  getOrganizationById(organizationId        )                            {
    const row = this.db
      .prepare('SELECT * FROM organizations WHERE id = ?')
      .get(organizationId)                                       ;
    if (!row) return null;
    return {
      id: String(row.id),
      slug: String(row.slug),
      legalName: String(row.legal_name),
      publicName: String(row.public_name),
      segment: row.segment ? String(row.segment) : null,
      status: String(row.status)                      ,
      planTier: String(row.plan_tier)            ,
      billingStatus: String(row.billing_status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  listOrganizations()                       {
    const rows = this.db
      .prepare('SELECT * FROM organizations ORDER BY created_at DESC')
      .all()                                  ;
    return rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      legalName: String(row.legal_name),
      publicName: String(row.public_name),
      segment: row.segment ? String(row.segment) : null,
      status: String(row.status)                      ,
      planTier: String(row.plan_tier)            ,
      billingStatus: String(row.billing_status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  transitionOrganizationStatus(params   
                           
                                     
                        
                    
   )                     {
    const org = this.getOrganizationById(params.organizationId);
    if (!org) {
      throw new Error(`Organização ${params.organizationId} não encontrada.`);
    }
    if (org.status === params.targetStatus) {
      return org;
    }
    if (!canTransitionOrganizationStatus(org.status, params.targetStatus)) {
      throw new Error(
        `Transição de estado inválida para organização: ${org.status} -> ${params.targetStatus}.`,
      );
    }

    const now = new Date().toISOString();
    this.db
      .prepare(
        'UPDATE organizations SET status = ?, updated_at = ? WHERE id = ?',
      )
      .run(params.targetStatus, now, params.organizationId);

    this.recordAuditLog({
      actorUserId: params.actorUserId,
      organizationId: params.organizationId,
      action: 'organization.status_transitioned',
      targetType: 'organization',
      targetId: params.organizationId,
      previousState: { status: org.status },
      newState: { status: params.targetStatus, reason: params.reason },
    });

    return this.getOrganizationById(params.organizationId) ;
  }

  getPlanLimitsForOrganization(organizationId        )                  {
    const org = this.getOrganizationById(organizationId);
    if (!org) {
      throw new Error(`Organização ${organizationId} não encontrada.`);
    }
    return DEFAULT_PLAN_QUOTAS[org.planTier];
  }

  // ── Registro Seguro de Instâncias de Tenants (Seção 6.1 e 6.2) ────────────

  registerTenantInstance(params   
                           
                               
                                                                
                   
                   
                   
                   
                            
                          
                          
                          
   )                       {
    const now = new Date().toISOString();
    // Criptografa a credencial vinculando o organizationId como AAD!
    const encryptedCredential = this.vault.encrypt(
      params.plainDbPassword,
      params.organizationId,
    );

    const existing = this.getTenantInstance(params.organizationId);
    if (existing) {
      this.db
        .prepare(
          `UPDATE tenant_instances SET
            instance_identifier = ?, engine_mode = ?, db_host = ?, db_port = ?,
            db_name = ?, db_user = ?, encrypted_db_credential = ?, storage_bucket = ?,
            storage_prefix = ?, schema_version = ?, updated_at = ?
           WHERE organization_id = ?`,
        )
        .run(
          params.instanceIdentifier,
          params.engineMode,
          params.dbHost,
          params.dbPort,
          params.dbName,
          params.dbUser,
          encryptedCredential,
          params.storageBucket,
          params.storagePrefix,
          params.schemaVersion,
          now,
          params.organizationId,
        );
      return this.getTenantInstance(params.organizationId) ;
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO tenant_instances (
          id, organization_id, instance_identifier, engine_mode,
          db_host, db_port, db_name, db_user, encrypted_db_credential,
          kms_key_id, storage_bucket, storage_prefix, schema_version,
          health_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'kms-v1', ?, ?, ?, 'PROVISIONING', ?, ?)`,
      )
      .run(
        id,
        params.organizationId,
        params.instanceIdentifier,
        params.engineMode,
        params.dbHost,
        params.dbPort,
        params.dbName,
        params.dbUser,
        encryptedCredential,
        params.storageBucket,
        params.storagePrefix,
        params.schemaVersion,
        now,
        now,
      );

    return this.getTenantInstance(params.organizationId) ;
  }

  getTenantInstance(organizationId        )                              {
    const row = this.db
      .prepare('SELECT * FROM tenant_instances WHERE organization_id = ?')
      .get(organizationId)                                       ;
    if (!row) return null;
    return {
      id: String(row.id),
      organizationId: String(row.organization_id),
      instanceIdentifier: String(row.instance_identifier),
      engineMode: String(row.engine_mode)                                      ,
      dbHost: String(row.db_host),
      dbPort: Number(row.db_port),
      dbName: String(row.db_name),
      dbUser: String(row.db_user),
      encryptedDbCredential: String(row.encrypted_db_credential),
      kmsKeyId: String(row.kms_key_id),
      storageBucket: String(row.storage_bucket),
      storagePrefix: String(row.storage_prefix),
      schemaVersion: Number(row.schema_version),
      healthStatus: String(
        row.health_status,
      )                                        ,
      lastHealthCheckAt: row.last_health_check_at
        ? String(row.last_health_check_at)
        : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  decryptTenantInstanceCredential(organizationId        )         {
    const instance = this.getTenantInstance(organizationId);
    if (!instance) {
      throw new Error(
        `Nenhuma instância de banco registrada para a organização ${organizationId}.`,
      );
    }
    return this.vault.decrypt(
      instance.encryptedDbCredential,
      organizationId,
    );
  }

  updateTenantHealth(
    organizationId        ,
    healthStatus                                      ,
    schemaVersion         ,
  )       {
    const now = new Date().toISOString();
    if (schemaVersion !== undefined) {
      this.db
        .prepare(
          `UPDATE tenant_instances
           SET health_status = ?, schema_version = ?, last_health_check_at = ?, updated_at = ?
           WHERE organization_id = ?`,
        )
        .run(healthStatus, schemaVersion, now, now, organizationId);
    } else {
      this.db
        .prepare(
          `UPDATE tenant_instances
           SET health_status = ?, last_health_check_at = ?, updated_at = ?
           WHERE organization_id = ?`,
        )
        .run(healthStatus, now, now, organizationId);
    }
  }

  // ── Painel de Consumo (Tokens, Gerações, Storage e Custos — Seção 7) ───────

  recordTenantUsage(params   
                           
                         
                           
                             
                               
                               
                                   
   )       {
    const periodMonth = new Date().toISOString().slice(0, 7);
    const now = new Date().toISOString();
    const existing = this.db
      .prepare(
        'SELECT id FROM tenant_usage_ledger WHERE organization_id = ? AND period_month = ?',
      )
      .get(params.organizationId, periodMonth)   
                               
                 ;

    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO tenant_usage_ledger (
            id, organization_id, period_month, tokens_used, api_calls_count,
            static_arts_generated, video_minutes_rendered, storage_bytes_used,
            estimated_cost_usd, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          params.organizationId,
          periodMonth,
          params.tokensDelta ?? 0,
          params.apiCallsDelta ?? 0,
          params.staticArtsDelta ?? 0,
          params.videoMinutesDelta ?? 0,
          params.storageBytesDelta ?? 0,
          params.estimatedCostUsdDelta ?? 0,
          now,
        );
      return;
    }

    this.db
      .prepare(
        `UPDATE tenant_usage_ledger SET
          tokens_used = tokens_used + ?,
          api_calls_count = api_calls_count + ?,
          static_arts_generated = static_arts_generated + ?,
          video_minutes_rendered = video_minutes_rendered + ?,
          storage_bytes_used = storage_bytes_used + ?,
          estimated_cost_usd = estimated_cost_usd + ?,
          updated_at = ?
         WHERE organization_id = ? AND period_month = ?`,
      )
      .run(
        params.tokensDelta ?? 0,
        params.apiCallsDelta ?? 0,
        params.staticArtsDelta ?? 0,
        params.videoMinutesDelta ?? 0,
        params.storageBytesDelta ?? 0,
        params.estimatedCostUsdDelta ?? 0,
        now,
        params.organizationId,
        periodMonth,
      );
  }

  getTenantUsage(organizationId        , periodMonth         )   
                        
                       
                          
                                
                                 
                             
                             
    {
    const month = periodMonth ?? new Date().toISOString().slice(0, 7);
    const row = this.db
      .prepare(
        'SELECT * FROM tenant_usage_ledger WHERE organization_id = ? AND period_month = ?',
      )
      .get(organizationId, month)                                       ;

    return {
      periodMonth: month,
      tokensUsed: row ? Number(row.tokens_used) : 0,
      apiCallsCount: row ? Number(row.api_calls_count) : 0,
      staticArtsGenerated: row ? Number(row.static_arts_generated) : 0,
      videoMinutesRendered: row ? Number(row.video_minutes_rendered) : 0,
      storageBytesUsed: row ? Number(row.storage_bytes_used) : 0,
      estimatedCostUsd: row ? Number(row.estimated_cost_usd) : 0,
    };
  }

  close()       {
    this.db.close();
  }
}
