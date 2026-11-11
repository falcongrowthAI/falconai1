import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BrandMemoryCategory,
  BrandMemoryLevel,
  OfficialAgentSlug,
  OnboardingStepKey,
  PermissionAction,
  PlanTier,
} from '@falcon/contracts';
import {
  AuthorizationError,
  FalconCoreControlPlane,
  TenantIsolationViolationError,
} from '@falcon/db-core';
import { TenantProvisionerAndRouter } from '@falcon/db-tenant';
import {
  ApprovalVersionLockError,
  FalconAiRuntime,
  ToolAuthorizationError,
  scheduleApprovedSocialPost,
} from '@falcon/ai-runtime';
import {
  createDefaultAgencyOfficeLayout,
  FalconVirtualOfficeWorld,
  OfficeBuilderController,
  type FalconOfficeLayout,
} from '@falcon/office-engine';

export interface FalconServerOptions {
  dataDir: string;
  masterKmsKeyHex: string;
  jwtSecret: string;
  webPublicDir?: string;
}

export class FalconGrowthApiServer {
  readonly core: FalconCoreControlPlane;
  readonly router: TenantProvisionerAndRouter;
  readonly runtime: FalconAiRuntime;
  readonly webPublicDir: string;
  private readonly officeWorlds = new Map<string, FalconVirtualOfficeWorld>();
  private readonly officeBuilders = new Map<string, OfficeBuilderController>();
  private httpServer: Server | null = null;

  constructor(options: FalconServerOptions) {
    this.core = new FalconCoreControlPlane({
      dataDir: options.dataDir,
      masterKmsKeyHex: options.masterKmsKeyHex,
      jwtSecret: options.jwtSecret,
    });
    this.router = new TenantProvisionerAndRouter(this.core);
    this.runtime = new FalconAiRuntime({ core: this.core });
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      options.webPublicDir,
      resolve(moduleDir, 'public'),
      resolve(moduleDir, '..', 'public'),
      resolve(process.cwd(), 'apps', 'web', 'public'),
      resolve(process.cwd(), 'public'),
      resolve(process.cwd(), '..', 'web', 'public'),
    ].filter((c): c is string => Boolean(c));
    this.webPublicDir =
      candidates.find((dir) => existsSync(join(dir, 'index.html'))) ??
      resolve(process.cwd(), 'apps', 'web', 'public');
  }

  getOrCreateOfficeWorld(
    organizationId: string,
    companyName: string,
    userId: string,
    userDisplayName: string,
  ): {
    world: FalconVirtualOfficeWorld;
    builder: OfficeBuilderController;
  } {
    let world = this.officeWorlds.get(organizationId);
    let builder = this.officeBuilders.get(organizationId);

    if (!world || !builder) {
      const initialLayout = createDefaultAgencyOfficeLayout(companyName);
      world = new FalconVirtualOfficeWorld({
        layout: initialLayout,
        userId,
        userDisplayName,
      });
      builder = new OfficeBuilderController(initialLayout);
      this.officeWorlds.set(organizationId, world);
      this.officeBuilders.set(organizationId, builder);

      // Inscreve o mundo espacial 3D nos eventos reais do runtime para esta organização
      this.runtime.eventBus.subscribe(organizationId, (ev) => {
        world?.applyRealtimeBackendEvent(ev);
      });
    }

    return { world, builder };
  }

  async listen(port = 0, host = '127.0.0.1'): Promise<{ port: number; url: string }> {
    this.httpServer = createServer((req, res) => {
      this.handleHttpRequest(req, res).catch((err) => {
        this.sendError(res, err);
      });
    });

    return new Promise((resolvePromise, rejectPromise) => {
      this.httpServer!.once('error', rejectPromise);
      this.httpServer!.listen(port, host, () => {
        const addr = this.httpServer!.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : port;
        resolvePromise({
          port: actualPort,
          url: `http://${host}:${actualPort}`,
        });
      });
    });
  }

  async handleHttpRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      await this.handleRequest(req, res);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  /**
   * Executa uma requisição HTTP diretamente pelo pipeline de roteamento e segurança do servidor
   * (padrão Fastify inject), permitindo testes E2E determinísticos em ambientes sem socket TCP.
   */
  async inject(params: {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<{
    status: number;
    headers: Record<string, string>;
    text: () => Promise<string>;
    json: <T = unknown>() => Promise<T>;
  }> {
    const rawBody =
      params.body === undefined
        ? ''
        : typeof params.body === 'string'
          ? params.body
          : JSON.stringify(params.body);

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(params.headers ?? {})) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const fakeReq = {
      method: params.method ?? 'GET',
      url: params.url,
      headers: normalizedHeaders,
      on: () => {},
      async *[Symbol.asyncIterator]() {
        if (rawBody.length > 0) {
          yield Buffer.from(rawBody, 'utf8');
        }
      },
    } as unknown as IncomingMessage;

    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};
    const chunks: Buffer[] = [];

    const fakeRes = {
      setHeader(name: string, value: string) {
        responseHeaders[name.toLowerCase()] = String(value);
      },
      writeHead(code: number, hdrs?: Record<string, string>) {
        statusCode = code;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            responseHeaders[k.toLowerCase()] = String(v);
          }
        }
      },
      write(chunk: string | Buffer) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'));
        return true;
      },
      end(chunk?: string | Buffer) {
        if (chunk !== undefined) {
          chunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'),
          );
        }
      },
    } as unknown as ServerResponse;

    try {
      await this.handleRequest(fakeReq, fakeRes);
    } catch (err) {
      this.sendError(fakeRes, err);
    }

    const responseText = Buffer.concat(chunks).toString('utf8');
    return {
      status: statusCode,
      headers: responseHeaders,
      text: async () => responseText,
      json: async <T = unknown>() => JSON.parse(responseText) as T,
    };
  }

  async close(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolvePromise) => {
        this.httpServer!.close(() => resolvePromise());
      });
      this.httpServer = null;
    }
    this.router.closeAll();
    this.core.close();
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    // Cabeçalhos CORS e Segurança
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Organization-Id',
    );

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlObj = new URL(req.url ?? '/', 'http://localhost');
    let pathname = urlObj.pathname;
    if (
      !pathname.startsWith('/api/') &&
      pathname !== '/' &&
      pathname !== '/index.html' &&
      /^\/(health|auth|events|core|office|agents|setup|brand-intelligence|commands|projects|studio|approvals|social|crm|performance)(\/|$)/.test(
        pathname,
      )
    ) {
      pathname = `/api${pathname}`;
    }
    const method = req.method ?? 'GET';

    // 1. Health Check do FALCON CORE
    if (method === 'GET' && pathname === '/api/health') {
      const orgs = this.core.listOrganizations();
      let pixelAgentsBridgeStatus: string = 'NOT_BOUND';
      const boundServerUrl = process.env.PIXEL_AGENTS_SERVER_URL;
      if (boundServerUrl) {
        try {
          const bridgeRes = await fetch(new URL('/api/health', boundServerUrl));
          pixelAgentsBridgeStatus = bridgeRes.ok ? 'CONNECTED' : `HTTP_${bridgeRes.status}`;
        } catch {
          pixelAgentsBridgeStatus = 'UNREACHABLE';
        }
      }

      this.sendJson(res, 200, {
        status: 'OK',
        service: 'FALCON GROWTH SaaS Platform & 3D Virtual Office',
        controlPlane: 'HEALTHY',
        pixelAgentsBridgeStatus,
        organizationsCount: orgs.length,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 2. Onboarding Comercial + Provisionamento Automático de 10 Etapas (Seção 6.2)
    if (method === 'POST' && pathname === '/api/auth/register-tenant') {
      const body = await this.readJsonBody(req);
      const user = this.core.registerUser({
        email: String(body.email ?? ''),
        fullName: String(body.fullName ?? ''),
        password: String(body.password ?? ''),
      });

      const org = this.core.createOrganization({
        slug: String(body.slug ?? body.publicName ?? 'empresa'),
        legalName: String(body.legalName ?? body.publicName ?? 'Empresa Ltda'),
        publicName: String(body.publicName ?? 'Minha Agência'),
        segment: body.segment ? String(body.segment) : undefined,
        planTier: (body.planTier as PlanTier) ?? PlanTier.GROWTH,
        ownerUserId: user.id,
      });

      const provisioned = this.router.provisionOrganizationTenant({
        organizationId: org.id,
        actorUserId: user.id,
      });

      const auth = this.core.authenticateUser({
        email: user.email,
        password: String(body.password ?? ''),
        organizationId: org.id,
      });

      this.getOrCreateOfficeWorld(org.id, org.publicName, user.id, user.fullName);

      this.sendJson(res, 201, {
        token: auth.token,
        user: auth.user,
        organization: auth.organization,
        role: auth.role,
        provisioningSteps: provisioned.stepsLog,
        tenantInstance: this.core.getTenantInstance(org.id),
      });
      return;
    }

    // 3. Login Autenticado com Sessão Vinculada ao Tenant
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await this.readJsonBody(req);
      const auth = this.core.authenticateUser({
        email: String(body.email ?? ''),
        password: String(body.password ?? ''),
        organizationId: body.organizationId
          ? String(body.organizationId)
          : undefined,
      });
      this.sendJson(res, 200, auth);
      return;
    }

    // 4. Stream SSE de Eventos em Tempo Real para o FALCON VIRTUAL OFFICE 3D e Dashboard
    if (method === 'GET' && pathname === '/api/events') {
      const token =
        urlObj.searchParams.get('token') ?? this.extractBearerToken(req);
      const requestedOrgId =
        urlObj.searchParams.get('organizationId') ??
        this.extractHeaderOrgId(req);
      const { session } = this.router.resolveForSession(token, requestedOrgId);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      res.write(
        `data: ${JSON.stringify({
          type: 'connected',
          organizationId: session.orgId,
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );

      const unsubscribe = this.runtime.eventBus.subscribe(
        session.orgId,
        (ev) => {
          res.write(`data: ${JSON.stringify(ev)}\n\n`);
        },
      );

      req.on('close', () => {
        unsubscribe();
      });
      return;
    }

    // 5. Demais rotas `/api/*` exigem autenticação JWT e isolamento estrito de Tenant
    if (pathname.startsWith('/api/')) {
      const token = this.extractBearerToken(req);
      const requestedOrgId =
        urlObj.searchParams.get('organizationId') ??
        this.extractHeaderOrgId(req);

      const { session, tenantDb } = this.router.resolveForSession(
        token,
        requestedOrgId,
      );
      const org = this.core.getOrganizationById(session.orgId)!;

      // 5.1 FALCON CORE — Visão Executiva, Quotas, Consumo e Auditoria
      if (method === 'GET' && pathname === '/api/core/overview') {
        const instance = this.core.getTenantInstance(session.orgId);
        const planLimits = this.core.getPlanLimitsForOrganization(session.orgId);
        const usage = this.core.getTenantUsage(session.orgId);
        const auditLogs = this.core.getAuditLogs(session.orgId).slice(0, 25);

        this.sendJson(res, 200, {
          organization: org,
          session,
          planLimits,
          usage,
          instance: instance
            ? {
                instanceIdentifier: instance.instanceIdentifier,
                engineMode: instance.engineMode,
                dbName: instance.dbName,
                storageBucket: instance.storageBucket,
                storagePrefix: instance.storagePrefix,
                schemaVersion: instance.schemaVersion,
                healthStatus: instance.healthStatus,
              }
            : null,
          auditLogs,
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/core/backup') {
        this.core.verifySession(
          token,
          requestedOrgId,
          PermissionAction.MANAGE_ORGANIZATION,
        );
        const backup = this.router.backupTenantDatabase(session.orgId);
        this.sendJson(res, 201, backup);
        return;
      }

      // 5.2 FALCON SETUP (Onboarding Guiado de 11 Etapas — Seção 8)
      if (method === 'GET' && pathname === '/api/setup') {
        const progress = tenantDb.getOnboardingProgress();
        this.sendJson(res, 200, progress);
        return;
      }

      if (method === 'PUT' && pathname === '/api/setup/step') {
        const body = await this.readJsonBody(req);
        const updated = tenantDb.saveOnboardingStep({
          stepKey: String(body.stepKey) as OnboardingStepKey,
          data: (body.data as Record<string, unknown>) ?? {},
          userId: session.sub,
          markCompleted: Boolean(body.markCompleted ?? true),
        });
        this.sendJson(res, 200, {
          step: updated,
          progress: tenantDb.getOnboardingProgress(),
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/setup/activate') {
        const result = tenantDb.confirmAndActivateBrandIntelligence(session.sub);
        this.sendJson(res, 200, result);
        return;
      }

      // 5.3 FALCON BRAND INTELLIGENCE (Memória Estruturada e Versionada — Seção 9)
      if (method === 'GET' && pathname === '/api/brand-intelligence') {
        const rows = tenantDb.db
          .prepare(
            'SELECT id FROM brand_intelligence_entries ORDER BY updated_at DESC',
          )
          .all() as Array<{ id: string }>;
        const entries = rows
          .map((r) => tenantDb.getBrandMemoryEntryById(String(r.id)))
          .filter(Boolean);
        this.sendJson(res, 200, { entries });
        return;
      }

      if (method === 'POST' && pathname === '/api/brand-intelligence') {
        const body = await this.readJsonBody(req);
        const entry = tenantDb.upsertBrandMemoryEntry({
          entryId: body.entryId ? String(body.entryId) : undefined,
          category: String(
            body.category ?? BrandMemoryCategory.TONE_OF_VOICE,
          ) as BrandMemoryCategory,
          memoryLevel: String(
            body.memoryLevel ?? BrandMemoryLevel.PERMANENT,
          ) as BrandMemoryLevel,
          title: String(body.title ?? 'Diretriz de Marca'),
          structuredData: (body.structuredData as Record<string, unknown>) ?? {},
          contentText: String(
            body.contentText ?? JSON.stringify(body.structuredData ?? {}),
          ),
          source: String(body.source ?? 'manual_dashboard'),
          reason: String(body.reason ?? 'Atualização manual da memória da marca'),
          userId: body.suggestedByAgentSlug ? undefined : session.sub,
          suggestedByAgentSlug: body.suggestedByAgentSlug
            ? String(body.suggestedByAgentSlug)
            : undefined,
        });
        const history = tenantDb.getBrandMemoryVersionHistory(entry.id);
        this.sendJson(res, 201, { entry, history });
        return;
      }

      // 5.4 FALCON AI TEAM (Os 11 Agentes Especializados — Seção 10)
      if (method === 'GET' && pathname === '/api/agents') {
        const agents = tenantDb.listAgents();
        this.sendJson(res, 200, { agents });
        return;
      }

      if (
        method === 'PATCH' &&
        pathname.startsWith('/api/agents/') &&
        pathname.endsWith('/appearance')
      ) {
        const slug = pathname.split('/')[3] as OfficialAgentSlug;
        const body = await this.readJsonBody(req);
        const updatedAgent = tenantDb.updateAgentAvatarAppearance({
          slug,
          palette: Number(body.palette ?? 0),
          repeat: Number(body.repeat ?? 0),
          assignedSeatUid: body.assignedSeatUid
            ? String(body.assignedSeatUid)
            : undefined,
          customAppearance:
            (body.customAppearance as Record<string, unknown>) ?? {},
        });
        this.sendJson(res, 200, { agent: updatedAgent });
        return;
      }

      // 5.5 FALCON COMMAND & WHATSAPP WEBHOOK (Orquestração pelo Head de Marketing — Seção 10.2 e 15)
      if (
        method === 'POST' &&
        (pathname === '/api/command' || pathname === '/api/webhooks/whatsapp')
      ) {
        this.core.verifySession(
          token,
          requestedOrgId,
          PermissionAction.CREATE_PROJECT_REQUEST,
        );
        const body = await this.readJsonBody(req);
        const isWhatsApp = pathname === '/api/webhooks/whatsapp';
        const prompt = String(
          body.prompt ?? body.messageText ?? 'Criar campanha institucional',
        );

        // Garante que o mundo 3D está inicializado para refletir os estados reais dos agentes durante a execução
        this.getOrCreateOfficeWorld(
          session.orgId,
          org.publicName,
          session.sub,
          session.email,
        );

        const result = this.runtime.orchestrateCommand({
          organizationId: session.orgId,
          tenantDb,
          userId: session.sub,
          prompt,
          originChannel: isWhatsApp
            ? 'WHATSAPP'
            : ((body.originChannel as 'FALCON_COMMAND') ?? 'FALCON_COMMAND'),
          targetChannels: Array.isArray(body.targetChannels)
            ? body.targetChannels.map(String)
            : ['Instagram', 'LinkedIn'],
          simulateFailureOnAgent: body.simulateFailureOnAgent
            ? (String(body.simulateFailureOnAgent) as OfficialAgentSlug)
            : undefined,
        });

        this.sendJson(res, 201, result);
        return;
      }

      // 5.6 PROJETOS, TAREFAS (DAG) E MENSAGENS ENTRE AGENTES (Seção 11)
      if (method === 'GET' && pathname === '/api/projects') {
        const projects = this.runtime.listProjects(tenantDb);
        const enriched = projects.map((p) => ({
          ...p,
          tasks: this.runtime.listProjectTasks(tenantDb, p.id),
          deliverables: this.runtime.listProjectDeliverables(tenantDb, p.id),
          approvals: this.runtime.listProjectApprovals(tenantDb, p.id),
        }));
        this.sendJson(res, 200, { projects: enriched });
        return;
      }

      // 5.7 FALCON STUDIO (Produção Criativa e Versionamento — Seção 16)
      if (method === 'GET' && pathname === '/api/studio/deliverables') {
        const deliverables = this.runtime.listProjectDeliverables(tenantDb);
        this.sendJson(res, 200, { deliverables });
        return;
      }

      if (
        method === 'POST' &&
        pathname.startsWith('/api/studio/deliverables/') &&
        pathname.endsWith('/versions')
      ) {
        const deliverableId = pathname.split('/')[4];
        const body = await this.readJsonBody(req);
        const updated = this.runtime.createNewDeliverableVersion({
          organizationId: session.orgId,
          tenantDb,
          deliverableId,
          contentStructured:
            (body.contentStructured as Record<string, unknown>) ?? {},
          contentMarkdown: String(body.contentMarkdown ?? ''),
          changeNotes: String(
            body.changeNotes ?? 'Nova versão editada no FALCON STUDIO',
          ),
          createdByUserId: session.sub,
        });
        this.sendJson(res, 201, { deliverable: updated });
        return;
      }

      // 5.8 FALCON APPROVALS (Central de Aprovações com Trava de Versão — Seção 17)
      if (method === 'GET' && pathname === '/api/approvals') {
        const approvals = this.runtime.listProjectApprovals(tenantDb);
        this.sendJson(res, 200, { approvals });
        return;
      }

      if (
        method === 'POST' &&
        pathname.startsWith('/api/approvals/') &&
        pathname.endsWith('/review')
      ) {
        this.core.verifySession(
          token,
          requestedOrgId,
          PermissionAction.APPROVE_DELIVERABLES,
        );
        const approvalId = pathname.split('/')[3];
        const body = await this.readJsonBody(req);
        const updated = this.runtime.reviewApproval({
          organizationId: session.orgId,
          tenantDb,
          approvalId,
          decision: String(body.decision ?? 'APPROVED') as
            | 'APPROVED'
            | 'CHANGES_REQUESTED'
            | 'REJECTED',
          reviewerUserId: session.sub,
          feedbackComment: body.feedbackComment
            ? String(body.feedbackComment)
            : undefined,
        });
        this.sendJson(res, 200, { approval: updated });
        return;
      }

      // 5.9 FALCON SOCIAL (Calendário Editorial & Publicação Externa Autorizada — Seção 19)
      if (method === 'GET' && pathname === '/api/social/posts') {
        const rows = tenantDb.db
          .prepare(
            'SELECT * FROM social_scheduled_posts ORDER BY scheduled_for ASC',
          )
          .all() as Array<Record<string, unknown>>;
        this.sendJson(res, 200, { posts: rows });
        return;
      }

      if (method === 'POST' && pathname === '/api/social/schedule') {
        this.core.verifySession(
          token,
          requestedOrgId,
          PermissionAction.AUTHORIZE_EXTERNAL_PUBLISH,
        );
        const body = await this.readJsonBody(req);
        const scheduled = scheduleApprovedSocialPost(tenantDb, {
          approvalId: String(body.approvalId),
          deliverableVersionId: String(body.deliverableVersionId),
          channel: String(body.channel ?? 'Instagram'),
          scheduledFor: String(
            body.scheduledFor ?? new Date(Date.now() + 3600_000).toISOString(),
          ),
          publishImmediately: Boolean(body.publishImmediately),
          executedByUserId: session.sub,
        });
        this.sendJson(res, 201, { post: scheduled });
        return;
      }

      // 5.10 FALCON VIRTUAL OFFICE 3D & FALCON BUILD MODE (Seções 13 e 14)
      if (method === 'GET' && pathname === '/api/office/state') {
        const { world } = this.getOrCreateOfficeWorld(
          session.orgId,
          org.publicName,
          session.sub,
          session.email,
        );
        const dbAgents = tenantDb.listAgents();
        // Garante que os avatares espaciais refletem 100% o estado persistido no banco do tenant
        for (const a of dbAgents) {
          const av = world.agents.get(a.slug);
          if (av) {
            av.operationalState = a.operationalState;
            av.currentTaskId = a.currentTaskId;
            av.palette = a.avatarPalette;
          }
        }

        this.sendJson(res, 200, {
          layout: world.layout,
          player: world.player,
          agents: Array.from(world.agents.values()),
          recentEvents: this.runtime.eventBus
            .getRecentEvents(session.orgId)
            .slice(-20),
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/office/move') {
        const { world } = this.getOrCreateOfficeWorld(
          session.orgId,
          org.publicName,
          session.sub,
          session.email,
        );
        const body = await this.readJsonBody(req);
        if (typeof body.targetCol === 'number' && typeof body.targetRow === 'number') {
          const path = world.navigatePlayerToTile(
            Number(body.targetCol),
            Number(body.targetRow),
          );
          this.sendJson(res, 200, { player: world.player, path });
          return;
        }
        const moveRes = world.movePlayerByDelta(
          Number(body.dc ?? 0),
          Number(body.dr ?? 0),
        );
        this.sendJson(res, 200, { player: world.player, ...moveRes });
        return;
      }

      if (method === 'POST' && pathname === '/api/office/interact') {
        const { world } = this.getOrCreateOfficeWorld(
          session.orgId,
          org.publicName,
          session.sub,
          session.email,
        );
        const body = await this.readJsonBody(req);
        const interaction = world.interactWithFurniture(
          String(body.furnitureUid),
        );
        this.sendJson(res, 200, {
          ...interaction,
          player: world.player,
        });
        return;
      }

      if (method === 'PUT' && pathname === '/api/office/layout') {
        this.core.verifySession(
          token,
          requestedOrgId,
          PermissionAction.EDIT_VIRTUAL_OFFICE_LAYOUT,
        );
        const { world, builder } = this.getOrCreateOfficeWorld(
          session.orgId,
          org.publicName,
          session.sub,
          session.email,
        );
        const body = await this.readJsonBody(req);
        const action = String(body.action ?? 'update_branding');

        let nextLayout: FalconOfficeLayout = builder.getLayout();
        if (action === 'place_furniture') {
          nextLayout = builder.placeFurniture({
            type: String(body.type),
            col: Number(body.col),
            row: Number(body.row),
            sectorId: body.sectorId,
            customLabel: body.customLabel ? String(body.customLabel) : undefined,
          });
        } else if (action === 'move_furniture') {
          nextLayout = builder.moveFurniture(
            String(body.uid),
            Number(body.col),
            Number(body.row),
          );
        } else if (action === 'rotate_furniture') {
          nextLayout = builder.rotateFurniture(String(body.uid));
        } else if (action === 'remove_furniture') {
          nextLayout = builder.removeFurniture(String(body.uid));
        } else if (action === 'update_branding') {
          nextLayout = builder.updateBranding(body.branding ?? {});
        } else if (action === 'switch_template') {
          const fresh = createDefaultAgencyOfficeLayout(
            org.publicName,
            body.templateKey ?? 'falcon-agency-hq-v1',
          );
          world.updateLayout(fresh);
          this.officeBuilders.set(
            session.orgId,
            new OfficeBuilderController(fresh),
          );
          nextLayout = fresh;
        } else if (action === 'undo') {
          nextLayout = builder.undo();
        } else if (action === 'redo') {
          nextLayout = builder.redo();
        }

        world.updateLayout(nextLayout);

        // Persiste o layout customizado no banco exclusivo do tenant
        tenantDb.db
          .prepare(
            `UPDATE office_layouts
             SET version = ?, layout_json = ?, branding_json = ?, updated_by_user_id = ?, updated_at = ?
             WHERE is_active = 1`,
          )
          .run(
            nextLayout.version,
            JSON.stringify(nextLayout),
            JSON.stringify(nextLayout.branding),
            session.sub,
            new Date().toISOString(),
          );

        this.runtime.eventBus.emit(session.orgId, 'office.layout_updated', {
          version: nextLayout.version,
          branding: nextLayout.branding,
        });

        this.sendJson(res, 200, {
          layout: nextLayout,
          canUndo: builder.canUndo(),
          canRedo: builder.canRedo(),
        });
        return;
      }

      // 5.11 FALCON CRM (Pipeline Comercial & Leads — Seção 18)
      if (method === 'GET' && pathname === '/api/crm/contacts') {
        const contacts = tenantDb.db
          .prepare('SELECT * FROM crm_contacts ORDER BY updated_at DESC')
          .all() as Array<Record<string, unknown>>;
        this.sendJson(res, 200, { contacts });
        return;
      }

      if (method === 'POST' && pathname === '/api/crm/contacts') {
        this.core.verifySession(
          token,
          requestedOrgId,
          PermissionAction.MANAGE_CRM,
        );
        const body = await this.readJsonBody(req);
        const id = randomUUID();
        const now = new Date().toISOString();
        tenantDb.db
          .prepare(
            `INSERT INTO crm_contacts (
              id, full_name, company_name, email, phone, lead_source,
              pipeline_stage, deal_value_cents, win_probability, notes, assigned_user_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            String(body.fullName ?? 'Novo Lead'),
            body.companyName ? String(body.companyName) : null,
            body.email ? String(body.email) : null,
            body.phone ? String(body.phone) : null,
            String(body.leadSource ?? 'FALCON_ORGANIC'),
            String(body.pipelineStage ?? 'NEW_LEAD'),
            Number(body.dealValueCents ?? 0),
            Number(body.winProbability ?? 25),
            body.notes ? String(body.notes) : null,
            session.sub,
            now,
            now,
          );
        const created = tenantDb.db
          .prepare('SELECT * FROM crm_contacts WHERE id = ?')
          .get(id);
        this.sendJson(res, 201, { contact: created });
        return;
      }

      // 5.12 FALCON PERFORMANCE (Analytics Consolidado — Seção 21)
      if (method === 'GET' && pathname === '/api/performance/summary') {
        const projectsCount = (
          tenantDb.db
            .prepare('SELECT COUNT(*) as total FROM projects')
            .get() as { total: number }
        ).total;
        const completedTasksCount = (
          tenantDb.db
            .prepare(
              "SELECT COUNT(*) as total FROM tasks WHERE status IN ('COMPLETED', 'APPROVED', 'WAITING_APPROVAL')",
            )
            .get() as { total: number }
        ).total;
        const deliverablesCount = (
          tenantDb.db
            .prepare('SELECT COUNT(*) as total FROM deliverable_versions')
            .get() as { total: number }
        ).total;
        const crmStats = tenantDb.db
          .prepare(
            'SELECT COUNT(*) as totalLeads, COALESCE(SUM(deal_value_cents), 0) as pipelineCents FROM crm_contacts',
          )
          .get() as { totalLeads: number; pipelineCents: number };
        const usage = this.core.getTenantUsage(session.orgId);

        this.sendJson(res, 200, {
          metrics: {
            projectsCount: Number(projectsCount),
            completedTasksCount: Number(completedTasksCount),
            deliverablesCount: Number(deliverablesCount),
            totalLeads: Number(crmStats.totalLeads),
            pipelineValueBRL: Number(crmStats.pipelineCents) / 100,
            aiTokensUsed: usage.tokensUsed,
            estimatedAiCostUsd: usage.estimatedCostUsd,
          },
        });
        return;
      }

      this.sendJson(res, 404, {
        error: `Endpoint não encontrado: ${method} ${pathname}`,
      });
      return;
    }

    // 6. Servidor da Aplicação Web (FALCON VIRTUAL OFFICE 3D + Dashboard Fallback)
    if (method === 'GET') {
      const cleanPath = pathname.replace(/^\//, '');
      const candidateStatic = join(this.webPublicDir, cleanPath);
      if (cleanPath && existsSync(candidateStatic) && statSync(candidateStatic).isFile()) {
        const ext = cleanPath.split('.').pop()?.toLowerCase();
        const contentType =
          ext === 'png' ? 'image/png' :
          ext === 'ico' ? 'image/x-icon' :
          ext === 'svg' ? 'image/svg+xml' :
          ext === 'json' ? 'application/json' :
          ext === 'js' ? 'application/javascript' :
          ext === 'css' ? 'text/css' : 'application/octet-stream';
        const fileBuf = readFileSync(candidateStatic);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(fileBuf);
        return;
      }

      const indexFile = join(this.webPublicDir, 'index.html');
      if (existsSync(indexFile)) {
        const html = readFileSync(indexFile, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
        });
        res.end(html);
        return;
      }
    }

    this.sendJson(res, 404, { error: 'Recurso não encontrado.' });
  }

  private extractBearerToken(req: IncomingMessage): string {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthorizationError('Token Bearer ausente no cabeçalho Authorization.');
    }
    return authHeader.slice('Bearer '.length).trim();
  }

  private extractHeaderOrgId(req: IncomingMessage): string | undefined {
    const h = req.headers['x-organization-id'];
    if (typeof h === 'string' && h.trim().length > 0) {
      return h.trim();
    }
    return undefined;
  }

  private async readJsonBody(
    req: IncomingMessage,
  ): Promise<Record<string, unknown>> {
    const preParsed = (req as unknown as { body?: unknown }).body;
    if (preParsed !== undefined && preParsed !== null) {
      if (typeof preParsed === 'object' && !Buffer.isBuffer(preParsed)) {
        return preParsed as Record<string, unknown>;
      }
      if (typeof preParsed === 'string') {
        const trimmed = preParsed.trim();
        return trimmed ? (JSON.parse(trimmed) as Record<string, unknown>) : {};
      }
      if (Buffer.isBuffer(preParsed)) {
        const trimmed = preParsed.toString('utf8').trim();
        return trimmed ? (JSON.parse(trimmed) as Record<string, unknown>) : {};
      }
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  }

  private sendJson(
    res: ServerResponse,
    statusCode: number,
    payload: unknown,
  ): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify(payload));
  }

  private sendError(res: ServerResponse, err: unknown): void {
    if (err instanceof TenantIsolationViolationError) {
      this.sendJson(res, 403, {
        code: 'TENANT_ISOLATION_VIOLATION',
        error: err.message,
      });
      return;
    }
    if (err instanceof AuthorizationError) {
      this.sendJson(res, 401, {
        code: 'UNAUTHORIZED',
        error: err.message,
      });
      return;
    }
    if (err instanceof ToolAuthorizationError) {
      this.sendJson(res, 403, {
        code: err.code,
        error: err.message,
      });
      return;
    }
    if (err instanceof ApprovalVersionLockError) {
      this.sendJson(res, 409, {
        code: err.code,
        error: err.message,
      });
      return;
    }
    this.sendJson(res, 400, {
      code: 'BAD_REQUEST',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
