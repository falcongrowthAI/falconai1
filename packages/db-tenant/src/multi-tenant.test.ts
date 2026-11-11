import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  PlanTier,
  BrandMemoryCategory,
  BrandMemoryLevel,
} from '@falcon/contracts';
import { FalconCoreControlPlane } from '@falcon/db-core';
import { TenantProvisionerAndRouter } from './index.ts';

const MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const JWT_SECRET = 'super_secret_falcon_growth_jwt_signing_key_minimum_32_chars';

describe('@falcon/db-core & @falcon/db-tenant — Multi-Tenant Isolation, Provisioning & Brand Intelligence', () => {
  let tmpDir: string;
  let core: FalconCoreControlPlane;
  let router: TenantProvisionerAndRouter;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-growth-test-'));
    core = new FalconCoreControlPlane({
      dataDir: tmpDir,
      masterKmsKeyHex: MASTER_KEY,
      jwtSecret: JWT_SECRET,
    });
    router = new TenantProvisionerAndRouter(core);
  });

  after(() => {
    router.closeAll();
    core.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('1 & 2. Provisions two independent companies with isolated physical database instances and encrypted credentials in FALCON CORE', () => {
    const userAlpha = core.registerUser({
      email: 'ceo@alpha-agency.com.br',
      fullName: 'Carlos Alpha',
      password: 'AlphaPass!2026',
    });
    const userBeta = core.registerUser({
      email: 'ceo@beta-retail.com.br',
      fullName: 'Beatriz Beta',
      password: 'BetaPass!2026',
    });

    const orgAlpha = core.createOrganization({
      slug: 'alpha-agency',
      legalName: 'Alpha Marketing Digital Ltda',
      publicName: 'Alpha Growth',
      planTier: PlanTier.GROWTH,
      ownerUserId: userAlpha.id,
    });
    const orgBeta = core.createOrganization({
      slug: 'beta-retail',
      legalName: 'Beta Comercio Varejista S.A.',
      publicName: 'Beta Store',
      planTier: PlanTier.PREMIUM,
      ownerUserId: userBeta.id,
    });

    const provAlpha = router.provisionOrganizationTenant({
      organizationId: orgAlpha.id,
      actorUserId: userAlpha.id,
    });
    const provBeta = router.provisionOrganizationTenant({
      organizationId: orgBeta.id,
      actorUserId: userBeta.id,
    });

    assert.equal(provAlpha.stepsLog.length, 10);
    assert.equal(provBeta.stepsLog.length, 10);

    // Physical database files must be completely distinct
    assert.notEqual(provAlpha.instance.dbFilePath, provBeta.instance.dbFilePath);
    assert.ok(fs.existsSync(provAlpha.instance.dbFilePath));
    assert.ok(fs.existsSync(provBeta.instance.dbFilePath));

    // Encrypted registry in FALCON CORE
    const connAlpha = core.getTenantInstance(orgAlpha.id)!;
    const connBeta = core.getTenantInstance(orgBeta.id)!;
    assert.notEqual(connAlpha.dbName, connBeta.dbName);
    assert.notEqual(connAlpha.storagePrefix, connBeta.storagePrefix);
    assert.equal(connAlpha.healthStatus, 'HEALTHY');
    assert.equal(connBeta.healthStatus, 'HEALTHY');

    // Both tenants must be ACTIVE and have 11 official agents seeded
    const dbAlpha = router.openTenantDatabaseInstance(orgAlpha.id);
    const dbBeta = router.openTenantDatabaseInstance(orgBeta.id);
    assert.equal(dbAlpha.listAgents().length, 11);
    assert.equal(dbBeta.listAgents().length, 11);
  });

  it('3. Blocks cross-tenant access attempts via JWT session validation and records critical security audit log', () => {
    const orgs = core.listOrganizations();
    const orgAlpha = orgs.find((o) => o.slug === 'alpha-agency')!;
    const orgBeta = orgs.find((o) => o.slug === 'beta-retail')!;

    const authAlpha = core.authenticateUser({
      email: 'ceo@alpha-agency.com.br',
      password: 'AlphaPass!2026',
      organizationId: orgAlpha.id,
    });

    // Write data exclusively into Tenant Alpha's database
    const { tenantDb: dbAlpha } = router.resolveForSession(authAlpha.token, orgAlpha.id);
    dbAlpha.db
      .prepare(
        `INSERT INTO crm_contacts (id, full_name, email, company_name, pipeline_stage, deal_value_cents, win_probability, created_at, updated_at)
         VALUES ('lead-alpha-1', 'Lead Secreto Alpha', 'secreto@cliente-alpha.com', 'Cliente Exclusivo Alpha', 'SQL', 1500000, 95, datetime('now'), datetime('now'))`
      )
      .run();

    // Verify Tenant Beta's database has zero contacts
    const dbBeta = router.openTenantDatabaseInstance(orgBeta.id);
    const betaCount = dbBeta.db
      .prepare('SELECT COUNT(*) as total FROM crm_contacts')
      .get() as { total: number };
    const alphaCount = dbAlpha.db
      .prepare('SELECT COUNT(*) as total FROM crm_contacts')
      .get() as { total: number };

    assert.equal(Number(betaCount.total), 0);
    assert.equal(Number(alphaCount.total), 1);

    // Attempting to use Alpha's token to resolve Beta's database must throw TenantIsolationViolationError
    assert.throws(
      () => {
        router.resolveForSession(authAlpha.token, orgBeta.id);
      },
      (err: Error) => err.message.includes('Violação de isolamento de tenant bloqueada')
    );

    // Verify audit log in FALCON CORE recorded the security violation
    const logs = core.getAuditLogs(orgAlpha.id);
    assert.ok(logs.some((l) => l.action === 'security.tenant_isolation_violation_blocked'));
  });

  it('4 & 5. Supports partial saving in FALCON SETUP (11 steps) and structured versioning + governance in FALCON BRAND INTELLIGENCE', () => {
    const orgAlpha = core.listOrganizations().find((o) => o.slug === 'alpha-agency')!;
    const authAlpha = core.authenticateUser({
      email: 'ceo@alpha-agency.com.br',
      password: 'AlphaPass!2026',
      organizationId: orgAlpha.id,
    });
    const { tenantDb, session } = router.resolveForSession(authAlpha.token);

    // Step 1 saved partially
    tenantDb.saveOnboardingStep({
      stepKey: 'identification',
      data: {
        legalName: 'Alpha Marketing Digital Ltda',
        tradeName: 'Alpha Growth',
        segment: 'SaaS B2B & Growth',
        businessModel: 'B2B_RECURRING',
        averageTicketBRL: 5000,
      },
      userId: session.sub,
      markCompleted: true,
    });

    // Step 7 (Tone of voice) saved partially
    tenantDb.saveOnboardingStep({
      stepKey: 'tone_of_voice',
      data: {
        toneAdjectives: ['Estratégico', 'Direto', 'Consultivo'],
        forbiddenWords: ['barato', 'milagre', 'fácil'],
        preferredTerms: ['ROI previsível', 'escala sustentável', 'arquitetura de receita'],
      },
      userId: session.sub,
      markCompleted: true,
    });

    // Verify onboarding progress can be resumed
    const progress = tenantDb.getOnboardingProgress();
    assert.equal(progress.totalCount, 11);
    assert.equal(progress.completedCount, 2);
    const stepIdent = progress.steps.find((s) => s.stepKey === 'identification')!;
    const stepTone = progress.steps.find((s) => s.stepKey === 'tone_of_voice')!;
    const stepOffer = progress.steps.find((s) => s.stepKey === 'offer')!;
    assert.equal(stepIdent.status, 'COMPLETED');
    assert.equal(stepTone.status, 'COMPLETED');
    assert.equal(stepOffer.status, 'PENDING');

    // Confirm and activate Brand Intelligence
    const activation = tenantDb.confirmAndActivateBrandIntelligence(session.sub);
    assert.equal(activation.activatedEntries.length, 2);

    // Update Tone of Voice and verify version increments to v2 while preserving v1 history
    const updatedTone = tenantDb.upsertBrandMemoryEntry({
      category: BrandMemoryCategory.TONE_OF_VOICE,
      memoryLevel: BrandMemoryLevel.PERMANENT,
      title: 'Tom de Voz, Vocabulário e Restrições Linguísticas',
      structuredData: {
        toneAdjectives: ['Estratégico', 'Direto', 'Consultivo', 'Orientado a Dados'],
        forbiddenWords: ['barato', 'milagre', 'fácil', 'hackzinho'],
      },
      contentText: 'Estratégico, Direto, Consultivo, Orientado a Dados',
      source: 'manual_brand_edit',
      reason: 'Adicionado adjetivo Orientado a Dados',
      userId: session.sub,
    });
    assert.equal(updatedTone.currentVersion, 2);

    const history = tenantDb.getBrandMemoryVersionHistory(updatedTone.id);
    assert.equal(history.length, 2);
    assert.ok(history[1].affectedAgents.includes('copywriter'));

    // Governance rule: An AI agent cannot silently overwrite PERMANENT Brand Memory (creates PENDING_APPROVAL suggestion instead)
    const agentSuggestion = tenantDb.upsertBrandMemoryEntry({
      category: BrandMemoryCategory.TONE_OF_VOICE,
      memoryLevel: BrandMemoryLevel.PERMANENT,
      title: 'Tom de Voz, Vocabulário e Restrições Linguísticas',
      structuredData: { toneAdjectives: ['Informal'] },
      contentText: 'Informal',
      source: 'agent_suggestion',
      reason: 'Sugestão automática do agente',
      suggestedByAgentSlug: 'copywriter',
    });
    assert.equal(agentSuggestion.status, 'PENDING_APPROVAL');

    // Verify active entry remains untouched at v2
    const activeTone = tenantDb.getBrandMemoryEntryById(updatedTone.id)!;
    assert.equal(activeTone.currentVersion, 2);
    assert.deepEqual(activeTone.structuredData.toneAdjectives, [
      'Estratégico',
      'Direto',
      'Consultivo',
      'Orientado a Dados',
    ]);

    // Scope rule: Social Media agent has scope for TONE_OF_VOICE, and cannot read unauthorized categories
    const allowedMem = tenantDb.queryBrandIntelligenceForAgent('social-media', [
      BrandMemoryCategory.TONE_OF_VOICE,
    ]);
    assert.equal(allowedMem.length, 1);

    const unauthorizedMem = tenantDb.queryBrandIntelligenceForAgent('designer-de-branding', [
      BrandMemoryCategory.CAMPAIGNS_LEARNINGS,
    ]);
    assert.equal(unauthorizedMem.length, 0);
  });

  it('Supports encrypted per-tenant backup and point-in-time restore without affecting other tenants', () => {
    const orgAlpha = core.listOrganizations().find((o) => o.slug === 'alpha-agency')!;
    const orgBeta = core.listOrganizations().find((o) => o.slug === 'beta-retail')!;

    const backup = router.backupTenantDatabase(orgAlpha.id);
    assert.ok(fs.existsSync(backup.backupFilePath));

    // Add a temporary contact to Alpha after backup
    const dbAlphaBefore = router.openTenantDatabaseInstance(orgAlpha.id);
    dbAlphaBefore.db
      .prepare(
        `INSERT INTO crm_contacts (id, full_name, pipeline_stage, deal_value_cents, win_probability, created_at, updated_at)
         VALUES ('lead-alpha-temp', 'Contato Pos Backup', 'NEW_LEAD', 50000, 10, datetime('now'), datetime('now'))`
      )
      .run();

    const countBefore = dbAlphaBefore.db
      .prepare('SELECT COUNT(*) as total FROM crm_contacts')
      .get() as { total: number };
    assert.equal(Number(countBefore.total), 2);

    // Restore Alpha from backup
    const dbAlphaAfter = router.restoreTenantDatabase(orgAlpha.id, backup.backupFilePath);
    const countAfter = dbAlphaAfter.db
      .prepare('SELECT COUNT(*) as total FROM crm_contacts')
      .get() as { total: number };
    assert.equal(Number(countAfter.total), 1);

    // Beta remains untouched
    const dbBeta = router.openTenantDatabaseInstance(orgBeta.id);
    const betaCount = dbBeta.db
      .prepare('SELECT COUNT(*) as total FROM crm_contacts')
      .get() as { total: number };
    assert.equal(Number(betaCount.total), 0);
  });
});
