import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  AgentOperationalState,
  BrandMemoryCategory,
  BrandMemoryLevel,
  OfficialAgentSlug,
  PlanTier,
  TaskStatus,
} from '@falcon/contracts';
import { FalconCoreControlPlane } from '@falcon/db-core';
import { TenantProvisionerAndRouter, type TenantDatabaseInstance } from '@falcon/db-tenant';
import {
  FalconAiRuntime,
  ToolAuthorizationError,
  ApprovalVersionLockError,
  scheduleApprovedSocialPost,
} from './index.ts';

const MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const JWT_SECRET = 'super_secret_falcon_growth_jwt_signing_key_minimum_32_chars';

describe('@falcon/ai-runtime — Head de Marketing DAG Orchestration, Least Privilege, Failure Handling & Approval Lock', () => {
  let tmpDir: string;
  let core: FalconCoreControlPlane;
  let router: TenantProvisionerAndRouter;
  let runtime: FalconAiRuntime;
  let orgId: string;
  let userId: string;
  let tenantDb: TenantDatabaseInstance;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-ai-runtime-test-'));
    core = new FalconCoreControlPlane({
      dataDir: tmpDir,
      masterKmsKeyHex: MASTER_KEY,
      jwtSecret: JWT_SECRET,
    });
    router = new TenantProvisionerAndRouter(core);
    runtime = new FalconAiRuntime({ core });

    const owner = core.registerUser({
      email: 'diretoria@vanguardb2b.com.br',
      fullName: 'Marina Vanguard',
      password: 'VanguardPassword!2026',
    });
    userId = owner.id;

    const org = core.createOrganization({
      slug: 'vanguard-b2b',
      legalName: 'Vanguard Tecnologia e Growth S.A.',
      publicName: 'Vanguard Growth',
      planTier: PlanTier.PREMIUM,
      ownerUserId: owner.id,
    });
    orgId = org.id;

    const provisioned = router.provisionOrganizationTenant({
      organizationId: org.id,
      actorUserId: owner.id,
    });
    tenantDb = provisioned.instance;

    // Configura a FALCON BRAND INTELLIGENCE da Vanguard Growth
    tenantDb.upsertBrandMemoryEntry({
      category: BrandMemoryCategory.INSTITUTIONAL_IDENTITY,
      memoryLevel: BrandMemoryLevel.PERMANENT,
      title: 'Identidade Institucional',
      structuredData: {
        tradeName: 'Vanguard Growth',
        segment: 'Enterprise B2B Revenue Architecture',
      },
      contentText: 'Vanguard Growth — Enterprise B2B Revenue Architecture',
      source: 'falcon_setup',
      reason: 'Setup inicial',
      userId,
    });

    tenantDb.upsertBrandMemoryEntry({
      category: BrandMemoryCategory.TONE_OF_VOICE,
      memoryLevel: BrandMemoryLevel.PERMANENT,
      title: 'Tom de Voz Oficial',
      structuredData: {
        toneAdjectives: ['Executivo', 'Analítico', 'Autoritativo'],
        forbiddenWords: ['promoção relâmpago', 'baratinho', 'milagroso'],
        preferredTerms: ['previsibilidade de receita', 'eficiência de CAC'],
      },
      contentText: 'Executivo, Analítico, Autoritativo',
      source: 'falcon_setup',
      reason: 'Setup inicial',
      userId,
    });
  });

  after(() => {
    router.closeAll();
    core.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('6 & 8. Orchestrates a full multi-agent campaign via Head de Marketing, applying Brand Intelligence and emitting real-time Virtual Office states', () => {
    const capturedEvents: Array<{ type: string; payload: unknown }> = [];
    const unsubscribe = runtime.eventBus.subscribe(orgId, (ev) => {
      capturedEvents.push({ type: ev.type, payload: ev.payload });
    });

    const result = runtime.orchestrateCommand({
      organizationId: orgId,
      tenantDb,
      userId,
      prompt:
        'Criar campanha completa de lançamento com carrossel, roteiro de vídeo Reels e plano de tráfego pago sobre eficiência de CAC (evitar promoção relâmpago).',
      originChannel: 'FALCON_COMMAND',
      targetChannels: ['LinkedIn', 'Instagram'],
    });

    unsubscribe();

    // Projeto e DAG de tarefas criados (concept, calendar, copy, design, video, traffic = 6 tarefas)
    assert.ok(result.project.id);
    assert.equal(result.tasks.length, 6);
    assert.ok(result.messages.length >= 6);
    assert.equal(result.deliverables.length, 6);
    assert.equal(result.approvals.length, 6);

    // Verifica se a Brand Intelligence foi consultada e aplicada nos entregáveis
    assert.ok(result.brandContextUsed.toneAdjectives.includes('Executivo'));
    assert.ok(
      result.brandContextUsed.preferredTermsIncluded.includes('eficiência de CAC'),
    );

    for (const deliv of result.deliverables) {
      assert.equal(deliv.currentVersion, 1);
      assert.equal(deliv.qaReviewedByAgent, true);
      assert.equal(deliv.qaScore, 98);
      const md = deliv.versions[0].contentMarkdown;
      assert.ok(md.includes('Vanguard Growth'));
      assert.ok(md.includes('Executivo, Analítico, Autoritativo'));
      // Palavra proibida "promoção relâmpago" presente no briefing deve ter sido sanitizada pela governança!
      assert.equal(md.toLowerCase().includes('promoção relâmpago'), false);
    }

    // Verifica se eventos reais foram emitidos para o FALCON VIRTUAL OFFICE 3D
    assert.ok(capturedEvents.some((e) => e.type === 'agent.state_changed'));
    assert.ok(capturedEvents.some((e) => e.type === 'task.status_changed'));
    assert.ok(capturedEvents.some((e) => e.type === 'approval.requested'));

    // Verifica que o ledger de consumo no FALCON CORE registrou tokens e chamadas de API
    const usage = core.getTenantUsage(orgId);
    assert.ok(usage.tokensUsed > 0);
    assert.ok(usage.apiCallsCount >= 6);
  });

  it('7. Enforces least-privilege ToolRegistry permissions per agent and blocks unauthorized tool calls', () => {
    // Designer de Artes e Carrosséis NÃO possui permissão para publicar externamente ou criar campanhas de tráfego
    assert.throws(
      () => {
        runtime.toolRegistry.invokeTool(
          {
            organizationId: orgId,
            tenantDb,
            agentSlug: OfficialAgentSlug.ART_CAROUSEL_DESIGNER,
            userId,
          },
          'social.publish_approved',
          {
            approvalId: 'any',
            deliverableVersionId: 'any',
            channel: 'Instagram',
          },
        );
      },
      (err: unknown) => err instanceof ToolAuthorizationError,
    );

    assert.throws(
      () => {
        runtime.toolRegistry.invokeTool(
          {
            organizationId: orgId,
            tenantDb,
            agentSlug: OfficialAgentSlug.COPYWRITER,
            userId,
          },
          'ads.plan_campaign',
          {},
        );
      },
      (err: unknown) => err instanceof ToolAuthorizationError,
    );
  });

  it('9. Handles agent execution failure with retries, sets agent state to ERROR, blocks dependent tasks, and alerts Head de Marketing', () => {
    const failureResult = runtime.orchestrateCommand({
      organizationId: orgId,
      tenantDb,
      userId,
      prompt: 'Criar post institucional e carrossel sobre arquitetura de receita',
      simulateFailureOnAgent: OfficialAgentSlug.COPYWRITER,
    });

    const copyTask = failureResult.tasks.find(
      (t) => t.assignedAgentSlug === OfficialAgentSlug.COPYWRITER,
    )!;
    const designTask = failureResult.tasks.find(
      (t) => t.assignedAgentSlug === OfficialAgentSlug.ART_CAROUSEL_DESIGNER,
    )!;

    // Copywriter tentou 2 vezes (maxAttempts = 2) e falhou
    assert.equal(copyTask.status, TaskStatus.FAILED);
    assert.equal(copyTask.attemptCount, 2);
    assert.ok(copyTask.lastError?.includes('Falha operacional simulada'));

    // Designer dependia de Copywriter no DAG, logo foi automaticamente marcado como BLOCKED
    assert.equal(designTask.status, TaskStatus.BLOCKED);

    // Estado real do Copywriter no banco do tenant deve ser ERROR
    const copyAgent = tenantDb.getAgentBySlug(OfficialAgentSlug.COPYWRITER)!;
    assert.equal(copyAgent.operationalState, AgentOperationalState.ERROR);

    // Head de Marketing recebeu mensagem de ALERT
    const alertMsg = failureResult.messages.find(
      (m) =>
        m.fromAgentSlug === OfficialAgentSlug.COPYWRITER &&
        m.toAgentSlug === OfficialAgentSlug.HEAD_MARKETING &&
        m.messageType === 'ALERT',
    );
    assert.ok(alertMsg);
  });

  it('10 & 11. Enforces FALCON APPROVALS version lock: blocks external publication of unapproved or superseded deliverable versions', () => {
    const campaign = runtime.orchestrateCommand({
      organizationId: orgId,
      tenantDb,
      userId,
      prompt: 'Criar pauta estratégica para LinkedIn sobre governança de IA',
    });

    const approvalV1 = campaign.approvals[0];
    const deliverableId = approvalV1.deliverableId;
    const versionV1Id = approvalV1.deliverableVersionId;

    // 1. Tentar publicar ANTES de aprovar v1 deve ser bloqueado imediatamente
    assert.throws(
      () => {
        scheduleApprovedSocialPost(tenantDb, {
          approvalId: approvalV1.id,
          deliverableVersionId: versionV1Id,
          channel: 'LinkedIn',
          scheduledFor: '2026-12-01T14:00:00.000Z',
          executedByAgentSlug: OfficialAgentSlug.PUBLISHING_AGENT,
        });
      },
      (err: unknown) =>
        err instanceof ApprovalVersionLockError &&
        err.message.includes("exige 'APPROVED'"),
    );

    // 2. Cliente aprova a versão v1
    const approvedV1 = runtime.reviewApproval({
      organizationId: orgId,
      tenantDb,
      approvalId: approvalV1.id,
      decision: 'APPROVED',
      reviewerUserId: userId,
      feedbackComment: 'Versão v1 aprovada com louvor.',
    });
    assert.equal(approvedV1.status, 'APPROVED');

    // 3. Posteriormente, é criada uma nova versão v2 no FALCON STUDIO
    const updatedDeliverable = runtime.createNewDeliverableVersion({
      organizationId: orgId,
      tenantDb,
      deliverableId,
      contentStructured: { headline: 'Nova Headline v2 não aprovada ainda' },
      contentMarkdown: '# Nova Headline v2 não aprovada ainda',
      changeNotes: 'Ajuste de headline para v2',
      createdByUserId: userId,
    });
    assert.equal(updatedDeliverable.currentVersion, 2);
    const versionV2Id = updatedDeliverable.latestVersionId!;
    assert.notEqual(versionV1Id, versionV2Id);

    // 4. Tentar publicar a v1 antiga usando a aprovação da v1 quando já existe v2 DEVE SER BLOQUEADO!
    assert.throws(
      () => {
        scheduleApprovedSocialPost(tenantDb, {
          approvalId: approvalV1.id,
          deliverableVersionId: versionV1Id,
          channel: 'LinkedIn',
          scheduledFor: '2026-12-01T14:00:00.000Z',
          executedByAgentSlug: OfficialAgentSlug.PUBLISHING_AGENT,
        });
      },
      (err: unknown) =>
        err instanceof ApprovalVersionLockError &&
        err.message.includes('possui uma versão mais recente'),
    );

    // 5. Tentar publicar a v2 usando o approvalId da v1 também DEVE SER BLOQUEADO!
    assert.throws(
      () => {
        scheduleApprovedSocialPost(tenantDb, {
          approvalId: approvalV1.id,
          deliverableVersionId: versionV2Id,
          channel: 'LinkedIn',
          scheduledFor: '2026-12-01T14:00:00.000Z',
          executedByAgentSlug: OfficialAgentSlug.PUBLISHING_AGENT,
        });
      },
      (err: unknown) =>
        err instanceof ApprovalVersionLockError &&
        err.message.includes('Violação de trava de versão'),
    );

    // 6. Agora o cliente aprova explicitamente a aprovação correspondente à v2
    const approvalsAfterV2 = runtime.listProjectApprovals(
      tenantDb,
      campaign.project.id,
    );
    const approvalV2 = approvalsAfterV2.find(
      (a) => a.deliverableVersionId === versionV2Id,
    )!;

    runtime.reviewApproval({
      organizationId: orgId,
      tenantDb,
      approvalId: approvalV2.id,
      decision: 'APPROVED',
      reviewerUserId: userId,
      feedbackComment: 'Versão v2 revisada e aprovada para publicação.',
    });

    // 7. Com a v2 aprovada e sendo a versão mais recente com checksum íntegro, o Agente de Publicação consegue agendar!
    const scheduled = runtime.toolRegistry.invokeTool<
      {
        approvalId: string;
        deliverableVersionId: string;
        channel: string;
        scheduledFor: string;
      },
      ReturnType<typeof scheduleApprovedSocialPost>
    >(
      {
        organizationId: orgId,
        tenantDb,
        agentSlug: OfficialAgentSlug.PUBLISHING_AGENT,
        projectId: campaign.project.id,
        userId,
      },
      'social.schedule_post',
      {
        approvalId: approvalV2.id,
        deliverableVersionId: versionV2Id,
        channel: 'LinkedIn',
        scheduledFor: '2026-12-01T14:00:00.000Z',
      },
    );

    assert.equal(scheduled.status, 'SCHEDULED');
    assert.equal(scheduled.deliverableVersionId, versionV2Id);
  });
});
