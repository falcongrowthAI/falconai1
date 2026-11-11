import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FalconGrowthApiServer } from './index.ts';

const MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const JWT_SECRET = 'super_secret_falcon_growth_jwt_signing_key_minimum_32_chars';

describe('@falcon/api & @falcon/web — End-to-End SaaS API, Multi-Tenant Isolation, 3D Virtual Office & 12 MVP Acceptance Criteria', () => {
  let tmpDir: string;
  let server: FalconGrowthApiServer;
  let tenantAlphaToken: string;
  let tenantBetaToken: string;
  let tenantBetaOrgId: string;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-api-e2e-'));
    server = new FalconGrowthApiServer({
      dataDir: tmpDir,
      masterKmsKeyHex: MASTER_KEY,
      jwtSecret: JWT_SECRET,
      webPublicDir: path.resolve(process.cwd(), 'apps', 'web', 'public'),
    });
  });

  after(async () => {
    await server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Criterion 1, 2 & 3: Provisions 2 isolated tenant databases over HTTP and blocks cross-tenant header manipulation with HTTP 403', async () => {
    const resAlpha = await server.inject({
      method: 'POST',
      url: '/api/auth/register-tenant',
      body: {
        email: 'ceo@alpha-e2e.com.br',
        fullName: 'Roberto Alpha',
        password: 'AlphaPassword!2026',
        slug: 'alpha-e2e',
        legalName: 'Alpha Digital S.A.',
        publicName: 'Alpha Digital',
        planTier: 'PREMIUM',
      },
    });
    assert.equal(resAlpha.status, 201);
    const dataAlpha = await resAlpha.json<{
      token: string;
      organization: { id: string };
      provisioningSteps: unknown[];
      tenantInstance: { dbName: string; healthStatus: string };
    }>();
    assert.equal(dataAlpha.provisioningSteps.length, 10);
    assert.equal(dataAlpha.tenantInstance.healthStatus, 'HEALTHY');
    tenantAlphaToken = dataAlpha.token;

    const resBeta = await server.inject({
      method: 'POST',
      url: '/api/auth/register-tenant',
      body: {
        email: 'ceo@beta-e2e.com.br',
        fullName: 'Helena Beta',
        password: 'BetaPassword!2026',
        slug: 'beta-e2e',
        legalName: 'Beta Commerce Ltda',
        publicName: 'Beta Commerce',
        planTier: 'GROWTH',
      },
    });
    assert.equal(resBeta.status, 201);
    const dataBeta = await resBeta.json<{
      token: string;
      organization: { id: string };
      tenantInstance: { dbName: string };
    }>();
    tenantBetaToken = dataBeta.token;
    tenantBetaOrgId = dataBeta.organization.id;

    assert.notEqual(
      dataAlpha.tenantInstance.dbName,
      dataBeta.tenantInstance.dbName,
    );

    // Alpha creates a confidential CRM lead
    const crmCreate = await server.inject({
      method: 'POST',
      url: '/api/crm/contacts',
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: {
        fullName: 'Lead Confidencial Alpha',
        companyName: 'Conta Enterprise Alpha',
        dealValueCents: 2500000,
      },
    });
    assert.equal(crmCreate.status, 201);

    // Beta lists its CRM contacts -> must be 0
    const crmBeta = await server.inject({
      method: 'GET',
      url: '/api/crm/contacts',
      headers: { Authorization: `Bearer ${tenantBetaToken}` },
    });
    const crmBetaData = await crmBeta.json<{ contacts: unknown[] }>();
    assert.equal(crmBetaData.contacts.length, 0);

    // Alpha attempts to pass Beta's Organization ID in X-Organization-Id header -> HTTP 403
    const crossTenantAttempt = await server.inject({
      method: 'GET',
      url: '/api/crm/contacts',
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
        'X-Organization-Id': tenantBetaOrgId,
      },
    });
    assert.equal(crossTenantAttempt.status, 403);
    const errBody = await crossTenantAttempt.json<{ code: string }>();
    assert.equal(errBody.code, 'TENANT_ISOLATION_VIOLATION');
  });

  it('Criterion 4, 5, 6, 10 & 11: Executes Setup, Brand Intelligence versioning, Falcon Command DAG, Studio versioning, and Approval Lock over HTTP', async () => {
    // Save step in FALCON SETUP and activate Brand Intelligence
    const stepSave = await server.inject({
      method: 'PUT',
      url: '/api/setup/step',
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: {
        stepKey: 'tone_of_voice',
        markCompleted: true,
        data: {
          toneAdjectives: ['Consultivo', 'Estratégico'],
          forbiddenWords: ['gambiarra'],
          preferredTerms: ['crescimento auditável'],
        },
      },
    });
    assert.equal(stepSave.status, 200);

    const activateRes = await server.inject({
      method: 'POST',
      url: '/api/setup/activate',
      headers: { Authorization: `Bearer ${tenantAlphaToken}` },
    });
    assert.equal(activateRes.status, 200);

    // Trigger multi-agent campaign via FALCON COMMAND
    const cmdRes = await server.inject({
      method: 'POST',
      url: '/api/command',
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: {
        prompt:
          'Criar campanha com carrossel e vídeo Reels sobre crescimento auditável',
        targetChannels: ['LinkedIn', 'Instagram'],
      },
    });
    assert.equal(cmdRes.status, 201);
    const cmdData = await cmdRes.json<{
      project: { id: string };
      tasks: unknown[];
      deliverables: Array<{ id: string; currentVersion: number; latestVersionId: string }>;
      approvals: Array<{ id: string; deliverableVersionId: string }>;
    }>();
    assert.equal(cmdData.tasks.length, 6);
    assert.equal(cmdData.deliverables.length, 6);

    const firstApproval = cmdData.approvals[0];
    const firstDeliverable = cmdData.deliverables[0];

    // Attempting to schedule post before approval must return HTTP 409
    const blockedSchedule = await server.inject({
      method: 'POST',
      url: '/api/social/schedule',
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: {
        approvalId: firstApproval.id,
        deliverableVersionId: firstApproval.deliverableVersionId,
        channel: 'LinkedIn',
      },
    });
    assert.equal(blockedSchedule.status, 409);

    // Approve v1
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/approvals/${firstApproval.id}/review`,
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: {
        decision: 'APPROVED',
        feedbackComment: 'Aprovado pela diretoria.',
      },
    });
    assert.equal(approveRes.status, 200);

    // Schedule approved v1 post -> HTTP 201
    const okSchedule = await server.inject({
      method: 'POST',
      url: '/api/social/schedule',
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: {
        approvalId: firstApproval.id,
        deliverableVersionId: firstApproval.deliverableVersionId,
        channel: 'LinkedIn',
        publishImmediately: true,
      },
    });
    assert.equal(okSchedule.status, 201);

    // Create v2 in FALCON STUDIO
    const v2Res = await server.inject({
      method: 'POST',
      url: `/api/studio/deliverables/${firstDeliverable.id}/versions`,
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: {
        contentStructured: { headline: 'Versão 2' },
        contentMarkdown: '# Versão 2 atualizada',
        changeNotes: 'Nova headline v2',
      },
    });
    assert.equal(v2Res.status, 201);
  });

  it('Criterion 8 & 12: Serves the 3D Virtual Office state, Office Builder actions, and Traditional Dashboard Web UI', async () => {
    const officeRes = await server.inject({
      method: 'GET',
      url: '/api/office/state',
      headers: { Authorization: `Bearer ${tenantAlphaToken}` },
    });
    assert.equal(officeRes.status, 200);
    const officeData = await officeRes.json<{
      layout: { zones: unknown[]; version: number };
      agents: unknown[];
    }>();
    assert.equal(officeData.layout.zones.length, 9);
    assert.equal(officeData.agents.length, 11);

    // Navigate user avatar in 3D Virtual Office
    const moveRes = await server.inject({
      method: 'POST',
      url: '/api/office/move',
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: { targetCol: 14, targetRow: 4 },
    });
    assert.equal(moveRes.status, 200);

    // Customize branding in Office Builder
    const buildRes = await server.inject({
      method: 'PUT',
      url: '/api/office/layout',
      headers: {
        Authorization: `Bearer ${tenantAlphaToken}`,
      },
      body: {
        action: 'update_branding',
        branding: { primaryColor: '#10b981' },
      },
    });
    assert.equal(buildRes.status, 200);

    // Verify Web Application HTML + Traditional Dashboard Fallback is served at GET /
    const htmlRes = await server.inject({
      method: 'GET',
      url: '/',
    });
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes('FALCON GROWTH'));
    assert.ok(html.includes('fallbackDashboardContainer'));
  });
});
