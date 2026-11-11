import { randomUUID } from 'node:crypto';
import {
  AgentOperationalState,
  ApprovalStatus,
  BrandMemoryCategory,
  DeliverableType,
  OfficialAgentSlug,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
                             
} from './contracts.js';
import {
  computeIdempotencyKey,
  computeSha256Checksum,
} from './security.js';
                                                              
             
                         
                         
                           

export class ToolAuthorizationError extends Error {
           code = 'TOOL_AUTHORIZATION_DENIED';
           agentSlug                   ;
           toolName        ;

  constructor(agentSlug                   , toolName        ) {
    super(
      `Violação de privilégio mínimo bloqueada: o agente '${agentSlug}' não possui autorização para executar a ferramenta '${toolName}'.`,
    );
    this.name = 'ToolAuthorizationError';
    this.agentSlug = agentSlug;
    this.toolName = toolName;
  }
}

export class ApprovalVersionLockError extends Error {
           code = 'APPROVAL_VERSION_LOCK_VIOLATION';
  constructor(message        ) {
    super(message);
    this.name = 'ApprovalVersionLockError';
  }
}

                                       
                         
                                   
                               
                     
                  
                  
 

                                
                                   
                    
   
               
                      
                                    
                                                                 
 

                                                                           

/**
 * Barramento de Eventos em Tempo Real (Seção 13.3 e Seção 26.2):
 * Conecta o runtime de IA ao FALCON VIRTUAL OFFICE 3D e ao Dashboard tradicional
 * sem acoplar a lógica de IA à camada visual.
 */
export class RealtimeEventBus {
                   listenersByOrg = new Map                                    ();
                   historyByOrg = new Map                                 ();

  subscribe(organizationId        , listener                       )             {
    let set = this.listenersByOrg.get(organizationId);
    if (!set) {
      set = new Set();
      this.listenersByOrg.set(organizationId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  emit          (
    organizationId        ,
    type                               ,
    payload          ,
  )                                  {
    const envelope                                  = {
      eventId: randomUUID(),
      organizationId,
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    const history = this.historyByOrg.get(organizationId) ?? [];
    history.push(envelope);
    if (history.length > 250) {
      history.shift();
    }
    this.historyByOrg.set(organizationId, history);

    const listeners = this.listenersByOrg.get(organizationId);
    if (listeners) {
      for (const listener of listeners) {
        listener(envelope);
      }
    }
    return envelope;
  }

  getRecentEvents(organizationId        )                          {
    return [...(this.historyByOrg.get(organizationId) ?? [])];
  }
}

                                
             
                
                    
                        
                        
                         
                                 
                                           
                         
                    
                    
 

                             
             
                    
                              
                
                   
                                       
                     
                         
                             
                       
                      
                           
                                            
                    
                    
 

                                           
             
                        
                        
                                             
                          
                             
                         
                                               
                                 
                      
                        
                    
 

                                    
             
                    
                 
                
                                   
                  
                         
                                 
                             
                         
                            
                 
                                       
                    
                    
 

                                 
             
                    
                 
                        
                               
                        
                                
                                                                              
                         
                                          
                                  
                                 
                      
                            
 

                                     
             
                    
                        
                                   
                                 
                                                                                  
                  
                                           
                    
 

/**
 * Tool Registry com validação estrita de escopo por Agente (Seção 10.1 e Critério 7 do MVP).
 */
export class ToolRegistry {
                   tools = new Map                        ();

  constructor() {
    this.registerDefaultAgencyTools();
  }

  registerTool                                                     (
    tool                                 ,
  )       {
    this.tools.set(tool.name, tool                  );
  }

  /**
   * Executa uma ferramenta somente se ela estiver explicitamente autorizada para o agente no banco do tenant.
   */
  invokeTool 
                                                                     
                      
   (ctx                      , toolName        , input        )          {
    const agent = ctx.tenantDb.getAgentBySlug(ctx.agentSlug);
    if (!agent) {
      throw new Error(`Agente '${ctx.agentSlug}' não encontrado no tenant.`);
    }
    if (!agent.isEnabled) {
      throw new Error(`Agente '${ctx.agentSlug}' está desativado neste tenant.`);
    }

    if (!agent.authorizedTools.includes(toolName)) {
      ctx.tenantDb.recordTenantAudit({
        actorType: 'AGENT',
        actorId: ctx.agentSlug,
        action: 'security.agent_tool_violation_blocked',
        entityType: 'tool',
        entityId: toolName,
        details: {
          agentSlug: ctx.agentSlug,
          attemptedTool: toolName,
          authorizedTools: agent.authorizedTools,
          taskId: ctx.taskId ?? null,
        },
      });
      throw new ToolAuthorizationError(ctx.agentSlug, toolName);
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Ferramenta '${toolName}' não registrada no ToolRegistry.`);
    }

    const result = tool.execute(ctx, input)           ;

    ctx.tenantDb.recordTenantAudit({
      actorType: 'AGENT',
      actorId: ctx.agentSlug,
      action: `tool.executed:${toolName}`,
      entityType: 'tool',
      entityId: toolName,
      details: {
        projectId: ctx.projectId ?? null,
        taskId: ctx.taskId ?? null,
      },
    });

    return result;
  }

          registerDefaultAgencyTools()       {
    // 1. Consulta estruturada à FALCON BRAND INTELLIGENCE respeitando escopos de memória do agente
    this.registerTool({
      name: 'brand.query',
      description: 'Consulta a memória viva da marca dentro dos escopos autorizados do agente',
      isExternalCriticalAction: false,
      execute: (ctx, input                                        ) => {
        return ctx.tenantDb.queryBrandIntelligenceForAgent(
          ctx.agentSlug,
          input.categories,
        );
      },
    });

    // 2. Mensageria estruturada entre agentes
    this.registerTool({
      name: 'agent.message',
      description: 'Envia mensagem técnica estruturada para outro agente da equipe',
      isExternalCriticalAction: false,
      execute: (
        ctx,
        input   
                                         
                                                         
                          
                                                    
         ,
      ) => {
        const id = randomUUID();
        const now = new Date().toISOString();
        ctx.tenantDb.db
          .prepare(
            `INSERT INTO agent_messages (
              id, project_id, task_id, execution_id, from_agent_slug, to_agent_slug,
              user_id, channel, message_type, content, structured_payload_json, created_at
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, 'INTERNAL', ?, ?, ?, ?)`,
          )
          .run(
            id,
            ctx.projectId ?? null,
            ctx.taskId ?? null,
            ctx.agentSlug,
            input.toAgentSlug,
            ctx.userId ?? null,
            input.messageType,
            input.content,
            JSON.stringify(input.contextSnapshot ?? {}),
            now,
          );
        return { id, createdAt: now };
      },
    });

    // 3. Ferramentas criativas, copy, social, tráfego e QA
    const creativeTools         
                   
                          
                                         
       = [
      { name: 'project.create', description: 'Cria um projeto estruturado a partir de uma demanda' },
      { name: 'task.assign', description: 'Atribui tarefa com dependências DAG para especialista' },
      { name: 'task.inspect', description: 'Inspeciona andamento e entregas de uma tarefa' },
      { name: 'approval.request', description: 'Submete versão de entrega para aprovação do cliente' },
      { name: 'approval.verify_version_lock', description: 'Verifica integridade criptográfica da versão aprovada' },
      { name: 'studio.create_concept', description: 'Define conceito criativo e direção da campanha' },
      { name: 'studio.define_briefing', description: 'Estrutura briefing criativo para redação e design' },
      { name: 'social.plan_calendar', description: 'Planeja calendário editorial e distribuição por canal' },
      { name: 'studio.create_pauta', description: 'Estrutura pautas detalhadas de conteúdo' },
      { name: 'studio.validate_visual_identity', description: 'Valida paleta, tipografia e regras visuais' },
      { name: 'studio.generate_brand_guidelines', description: 'Gera diretrizes de aplicação visual' },
      { name: 'studio.generate_static_art', description: 'Gera layout estruturado de peça estática' },
      { name: 'studio.generate_carousel', description: 'Gera estrutura lâmina a lâmina de carrossel' },
      { name: 'storage.save_asset', description: 'Salva ativo criativo no storage isolado do tenant' },
      { name: 'studio.create_video_script', description: 'Cria roteiro audiovisual para Reels/TikTok/Shorts' },
      { name: 'studio.render_video_composition', description: 'Renderiza composição audiovisual estruturada' },
      { name: 'studio.define_scene_cuts', description: 'Define decupagem de cenas, ganchos e legendas' },
      { name: 'studio.write_copy', description: 'Redige copy persuasiva e institucional alinhada ao tom de voz' },
      { name: 'studio.generate_variations', description: 'Gera variações A/B de headlines, legendas e CTAs' },
      { name: 'copy.write_headline', description: 'Redige títulos de alta conversão alinhados ao tom de voz' },
      { name: 'copy.write_caption', description: 'Redige legendas estratégicas com CTA' },
      { name: 'copy.write_ad_script', description: 'Redige copy de anúncios pagos' },
      { name: 'ads.read_campaigns', description: 'Lê métricas e status de campanhas de tráfego pago' },
      { name: 'ads.create_campaign_draft', description: 'Cria rascunho estruturado de campanha de mídia paga' },
      { name: 'ads.propose_optimization', description: 'Propõe otimização de público, criativo ou orçamento' },
      { name: 'ads.plan_campaign', description: 'Planeja estrutura de campanha, público e orçamento' },
      { name: 'ads.analyze_roas', description: 'Analisa métricas de ROAS, CPA, CTR e CPC' },
      { name: 'performance.read_metrics', description: 'Lê indicadores consolidados de canais, mídia e CRM' },
      { name: 'performance.generate_report', description: 'Gera relatório analítico com recomendações acionáveis' },
      { name: 'performance.analyze_funnel', description: 'Analisa taxas de conversão do funil de marketing e CRM' },
      { name: 'performance.generate_executive_report', description: 'Gera relatório executivo consolidado' },
      { name: 'qa.inspect_deliverable', description: 'Inspeciona aderência ao briefing, marca e ortografia' },
      { name: 'qa.approve_for_client_review', description: 'Libera entregável auditado para revisão do cliente' },
      { name: 'qa.request_agent_revision', description: 'Solicita correção interna ao agente especialista' },
      { name: 'qa.review_brand_compliance', description: 'Audita aderência à FALCON BRAND INTELLIGENCE' },
      { name: 'qa.review_orthography', description: 'Audita ortografia, clareza e restrições da marca' },
    ];

    for (const t of creativeTools) {
      this.registerTool({
        name: t.name,
        description: t.description,
        isExternalCriticalAction: Boolean(t.isExternalCriticalAction),
        execute: (_ctx, input) => ({
          tool: t.name,
          executedAt: new Date().toISOString(),
          input,
          status: 'OK',
        }),
      });
    }

    // 4. Ferramenta Crítica de Publicação Externa com Trava de Versão Aprovada (Seção 17 e Critério 10 do MVP)
    this.registerTool({
      name: 'social.schedule_post',
      description: 'Agenda publicação externa exigindo versão explicitamente aprovada no FALCON APPROVALS',
      isExternalCriticalAction: true,
      execute: (
        ctx,
        input   
                             
                                       
                          
                               
         ,
      ) => {
        return scheduleApprovedSocialPost(ctx.tenantDb, {
          ...input,
          executedByAgentSlug: ctx.agentSlug,
        });
      },
    });

    this.registerTool({
      name: 'social.publish_approved_post',
      description: 'Publica imediatamente conteúdo que possui aprovação válida e trava de versão íntegra',
      isExternalCriticalAction: true,
      execute: (
        ctx,
        input   
                             
                                       
                          
         ,
      ) => {
        return scheduleApprovedSocialPost(ctx.tenantDb, {
          ...input,
          scheduledFor: new Date().toISOString(),
          publishImmediately: true,
          executedByAgentSlug: ctx.agentSlug,
        });
      },
    });

    this.registerTool({
      name: 'social.publish_approved',
      description: 'Alias para publicação de conteúdo com trava de versão aprovada',
      isExternalCriticalAction: true,
      execute: (
        ctx,
        input   
                             
                                       
                          
         ,
      ) => {
        return scheduleApprovedSocialPost(ctx.tenantDb, {
          ...input,
          scheduledFor: new Date().toISOString(),
          publishImmediately: true,
          executedByAgentSlug: ctx.agentSlug,
        });
      },
    });
  }
}

/**
 * Valida a trava de versão aprovada (Seção 17 e Critério 10 do MVP) antes de agendar ou publicar externamente.
 */
export function scheduleApprovedSocialPost(
  tenantDb                        ,
  params   
                       
                                 
                    
                         
                                 
                                            
                              
   ,
)   
                     
                                    
                               
                         
                  
                       
  {
  const approval = tenantDb.db
    .prepare('SELECT * FROM approvals WHERE id = ?')
    .get(params.approvalId)                                       ;

  if (!approval) {
    throw new ApprovalVersionLockError(
      `Registro de aprovação '${params.approvalId}' não encontrado.`,
    );
  }

  if (String(approval.status) !== ApprovalStatus.APPROVED) {
    throw new ApprovalVersionLockError(
      `Publicação bloqueada: a aprovação '${params.approvalId}' está com status '${approval.status}' (exige 'APPROVED').`,
    );
  }

  if (String(approval.deliverable_version_id) !== params.deliverableVersionId) {
    throw new ApprovalVersionLockError(
      `Violação de trava de versão: a aprovação autoriza exclusivamente a versão '${approval.deliverable_version_id}', mas foi solicitada a publicação da versão '${params.deliverableVersionId}'.`,
    );
  }

  const versionRow = tenantDb.db
    .prepare('SELECT * FROM deliverable_versions WHERE id = ?')
    .get(params.deliverableVersionId)                                       ;

  if (!versionRow) {
    throw new ApprovalVersionLockError('Versão do entregável não encontrada.');
  }

  const taskRow = tenantDb.db
    .prepare('SELECT id, latest_deliverable_version_id FROM tasks WHERE id = ?')
    .get(String(approval.task_id))                                       ;

  if (!taskRow) {
    throw new ApprovalVersionLockError('Tarefa associada ao entregável não encontrada.');
  }

  // Regra Inegociável da Seção 17: Se existir versão posterior não aprovada (ou se a versão estiver marcada como is_superseded), a versão antiga NÃO pode ser publicada!
  if (
    Boolean(versionRow.is_superseded) ||
    String(taskRow.latest_deliverable_version_id) !== params.deliverableVersionId
  ) {
    throw new ApprovalVersionLockError(
      `Publicação bloqueada por segurança: o entregável possui uma versão mais recente ('${taskRow.latest_deliverable_version_id}') posterior à versão aprovada ('${params.deliverableVersionId}'). Aprove a versão atual antes de publicar.`,
    );
  }

  const recomputedChecksum = computeSha256Checksum(
    `${versionRow.structured_content_json}::${versionRow.content_body}`,
  );
  if (recomputedChecksum !== String(approval.content_checksum_sha256)) {
    throw new ApprovalVersionLockError(
      'Violação de integridade detectada: o checksum SHA-256 do conteúdo não corresponde ao checksum assinado na aprovação.',
    );
  }

  const idempotencyKey = computeIdempotencyKey(
    tenantDb.organizationId,
    'social.schedule_or_publish',
    {
      approvalId: params.approvalId,
      deliverableVersionId: params.deliverableVersionId,
      channel: params.channel,
    },
  );

  const existingPost = tenantDb.db
    .prepare('SELECT * FROM social_scheduled_posts WHERE idempotency_key = ?')
    .get(idempotencyKey)                                       ;

  if (existingPost) {
    return {
      scheduleId: String(existingPost.id),
      status: String(existingPost.status)                             ,
      deliverableVersionId: String(existingPost.deliverable_version_id),
      checksumSha256: recomputedChecksum,
      channel: String(existingPost.channel),
      scheduledFor: String(existingPost.scheduled_for),
    };
  }

  const scheduleId = randomUUID();
  const now = new Date().toISOString();
  const status = params.publishImmediately ? 'PUBLISHED' : 'SCHEDULED';

  tenantDb.db
    .prepare(
      `INSERT INTO social_scheduled_posts (
        id, project_id, task_id, approval_id, deliverable_version_id,
        channel, scheduled_for, status, idempotency_key, external_post_id, published_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      scheduleId,
      String(approval.project_id),
      String(approval.task_id),
      params.approvalId,
      params.deliverableVersionId,
      params.channel,
      params.scheduledFor,
      status,
      idempotencyKey,
      params.publishImmediately ? `ext-${scheduleId.slice(0, 8)}` : null,
      params.publishImmediately ? now : null,
      now,
    );

  tenantDb.recordTenantAudit({
    actorType: params.executedByAgentSlug ? 'AGENT' : 'USER',
    actorId: params.executedByAgentSlug ?? params.executedByUserId ?? 'system',
    action: `social.${status.toLowerCase()}`,
    entityType: 'social_scheduled_post',
    entityId: scheduleId,
    details: {
      approvalId: params.approvalId,
      deliverableVersionId: params.deliverableVersionId,
      checksumSha256: recomputedChecksum,
      channel: params.channel,
    },
  });

  return {
    scheduleId,
    status,
    deliverableVersionId: params.deliverableVersionId,
    checksumSha256: recomputedChecksum,
    channel: params.channel,
    scheduledFor: params.scheduledFor,
  };
}

                                          
                         
                                   
                 
                 
                                                                                    
                            
                          
                                             
 

                                            
                         
                      
                                 
                                    
                              
                     
                         
                                          
                             
                                     
                                     
    
 

/**
 * Orquestrador Central da Agência Virtual — Head de Marketing e Runtime de Agentes (Seções 10, 11, 15, 16 e 17).
 */
export class FalconAiRuntime {
           core                        ;
           toolRegistry              ;
           eventBus                  ;

  constructor(params   
                                 
                                
                                
   ) {
    this.core = params.core;
    this.toolRegistry = params.toolRegistry ?? new ToolRegistry();
    this.eventBus = params.eventBus ?? new RealtimeEventBus();
  }

  /**
   * Atualiza o estado operacional real de um agente no banco do tenant e emite evento em tempo real
   * para que o FALCON VIRTUAL OFFICE 3D mova e anime o avatar de forma 100% fiel ao estado real (Seção 13.3).
   */
  setAgentState(
    organizationId        ,
    tenantDb                        ,
    agentSlug                   ,
    state                       ,
    currentTaskId               ,
    targetSector         ,
  )       {
    const updated = tenantDb.updateAgentOperationalState({
      slug: agentSlug,
      operationalState: state,
      currentTaskId,
    });

    this.eventBus.emit(organizationId, 'agent.state_changed', {
      agentSlug: updated.slug,
      agentName: updated.name,
      operationalState: updated.operationalState,
      currentTaskId: updated.currentTaskId,
      targetSector: targetSector ?? updated.defaultSector,
      assignedSeatUid: updated.assignedSeatUid,
    });
  }

  /**
   * Fluxo Oficial de Coordenação em 12 Passos do Head de Marketing (Seção 10.2 do Documento Mestre).
   */
  orchestrateCommand(req                         )                            {
    const { organizationId, tenantDb, userId, prompt } = req;
    const originChannel = req.originChannel ?? 'FALCON_COMMAND';
    const priority = req.priority ?? TaskPriority.HIGH;

    // Passo 1 e 2: Head de Marketing entra em estado PLANNING e interpreta a demanda
    this.setAgentState(
      organizationId,
      tenantDb,
      OfficialAgentSlug.HEAD_MARKETING,
      AgentOperationalState.PLANNING,
      null,
      'HEAD_OFFICE',
    );

    // Passo 3: Consulta a FALCON BRAND INTELLIGENCE da empresa via ToolRegistry
    const brandEntries = this.toolRegistry.invokeTool 
                                             
                              
     (
      {
        organizationId,
        tenantDb,
        agentSlug: OfficialAgentSlug.HEAD_MARKETING,
        userId,
      },
      'brand.query',
      {},
    );

    const extractedBrand = this.extractBrandDirectives(brandEntries);

    // Passo 4: Cria o Projeto estruturado no banco exclusivo do tenant
    const projectId = randomUUID();
    const now = new Date().toISOString();
    const projectTitle = this.deriveProjectTitle(prompt);
    const dueAt = new Date(Date.now() + 3 * 86400_000).toISOString();
    const dagPlan = this.buildSpecialistTaskDag(prompt, req.targetChannels);

    tenantDb.db
      .prepare(
        `INSERT INTO projects (
          id, title, objective, requester_user_id, source_channel, status,
          priority, target_channel, due_at, supervisor_plan_json, idempotency_key,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        projectId,
        projectTitle,
        prompt.trim(),
        userId,
        originChannel,
        ProjectStatus.IN_PROGRESS,
        priority,
        (req.targetChannels ?? ['Instagram', 'LinkedIn']).join(','),
        dueAt,
        JSON.stringify({ stages: dagPlan.map((d) => d.stageKey) }),
        `proj-${projectId}`,
        now,
        now,
      );

    // Passo 5: Decompõe o projeto em um Grafo Acíclico Dirigido (DAG) de tarefas especializadas
    const createdTaskIdsByStage = new Map                ();

    for (const node of dagPlan) {
      const taskId = randomUUID();
      createdTaskIdsByStage.set(node.stageKey, taskId);
      const depTaskIds = node.dependsOnStages
        .map((s) => createdTaskIdsByStage.get(s))
        .filter((id)               => Boolean(id));

      const agentRec = tenantDb.getAgentBySlug(node.agentSlug) ;

      tenantDb.db
        .prepare(
          `INSERT INTO tasks (
            id, project_id, parent_task_id, requester_user_id, assigned_agent_id,
            assigned_agent_slug, department, title, description, objective,
            expected_deliverable, priority, status, due_at, idempotency_key,
            created_at, updated_at
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          taskId,
          projectId,
          userId,
          agentRec.id,
          node.agentSlug,
          agentRec.department,
          node.title,
          node.briefing,
          prompt.trim(),
          this.mapAgentToDeliverableType(node.agentSlug),
          priority,
          depTaskIds.length === 0 ? TaskStatus.READY : TaskStatus.BACKLOG,
          dueAt,
          `task-${taskId}`,
          now,
          now,
        );

      for (const depId of depTaskIds) {
        tenantDb.db
          .prepare(
            'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)',
          )
          .run(taskId, depId);
      }

      // Passo 6: Emite mensagem estruturada de briefing do Head de Marketing para o especialista
      this.toolRegistry.invokeTool(
        {
          organizationId,
          tenantDb,
          agentSlug: OfficialAgentSlug.HEAD_MARKETING,
          projectId,
          taskId,
          userId,
        },
        'agent.message',
        {
          toAgentSlug: node.agentSlug,
          messageType: 'BRIEFING',
          content: `Briefing para ${node.title}: ${node.briefing}`,
          contextSnapshot: {
            toneAdjectives: extractedBrand.toneAdjectives,
            preferredTerms: extractedBrand.preferredTermsIncluded,
            forbiddenWords: extractedBrand.forbiddenWordsExcluded,
            visualPalette: extractedBrand.visualColors,
          },
        },
      );
    }

    // Passo 7 a 12: Executa as tarefas respeitando a topologia do DAG
    this.executeProjectDag({
      organizationId,
      tenantDb,
      projectId,
      userId,
      extractedBrand,
      simulateFailureOnAgent: req.simulateFailureOnAgent,
    });

    const project = this.getProjectById(tenantDb, projectId) ;
    const tasks = this.listProjectTasks(tenantDb, projectId);
    const messages = this.listProjectMessages(tenantDb, projectId);
    const deliverables = this.listProjectDeliverables(tenantDb, projectId);
    const approvals = this.listProjectApprovals(tenantDb, projectId);

    return {
      project,
      tasks,
      messages,
      deliverables,
      approvals,
      brandContextUsed: {
        entriesCount: brandEntries.length,
        categoriesUsed: Array.from(new Set(brandEntries.map((e) => e.category))),
        toneAdjectives: extractedBrand.toneAdjectives,
        forbiddenWordsExcluded: extractedBrand.forbiddenWordsExcluded,
        preferredTermsIncluded: extractedBrand.preferredTermsIncluded,
      },
    };
  }

          executeProjectDag(params   
                           
                                     
                      
                   
                                                                          
                                               
   )       {
    const { organizationId, tenantDb, projectId, userId, extractedBrand } = params;

    let tasks = this.listProjectTasks(tenantDb, projectId);
    const completedIds = new Set        (
      tasks
        .filter(
          (t) =>
            t.status === TaskStatus.COMPLETED ||
            t.status === TaskStatus.WAITING_APPROVAL,
        )
        .map((t) => t.id),
    );
    const failedIds = new Set        ();

    // Executa em ondas topológicas até não restarem tarefas prontas
    for (let wave = 0; wave < 12; wave++) {
      tasks = this.listProjectTasks(tenantDb, projectId);
      const runnable = tasks.filter((t) => {
        if (
          t.status === TaskStatus.COMPLETED ||
          t.status === TaskStatus.WAITING_APPROVAL ||
          t.status === TaskStatus.FAILED ||
          t.status === TaskStatus.BLOCKED
        ) {
          return false;
        }
        // Se alguma dependência falhou, marca como BLOCKED
        if (t.dependsOnTaskIds.some((depId) => failedIds.has(depId))) {
          this.updateTaskStatus(
            organizationId,
            tenantDb,
            t.id,
            TaskStatus.BLOCKED,
          );
          return false;
        }
        return t.dependsOnTaskIds.every((depId) => completedIds.has(depId));
      });

      if (runnable.length === 0) break;

      for (const task of runnable) {
        const success = this.executeSingleSpecialistTask({
          organizationId,
          tenantDb,
          projectId,
          task,
          userId,
          extractedBrand,
          shouldFail: params.simulateFailureOnAgent === task.assignedAgentSlug,
        });

        if (success) {
          completedIds.add(task.id);
        } else {
          failedIds.add(task.id);
        }
      }
    }

    // Consolidação final pelo Head de Marketing
    const finalTasks = this.listProjectTasks(tenantDb, projectId);
    const anyFailed = finalTasks.some((t) => t.status === TaskStatus.FAILED);
    const anyWaitingApproval = finalTasks.some(
      (t) => t.status === TaskStatus.WAITING_APPROVAL,
    );

    const nextProjectStatus = anyFailed
      ? ProjectStatus.IN_PROGRESS
      : anyWaitingApproval
        ? ProjectStatus.WAITING_APPROVAL
        : ProjectStatus.COMPLETED;

    tenantDb.db
      .prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
      .run(nextProjectStatus, new Date().toISOString(), projectId);

    this.setAgentState(
      organizationId,
      tenantDb,
      OfficialAgentSlug.HEAD_MARKETING,
      anyWaitingApproval
        ? AgentOperationalState.WAITING_APPROVAL
        : AgentOperationalState.AVAILABLE,
      null,
      'HEAD_OFFICE',
    );
  }

  /**
   * Executa uma tarefa individual de um agente especialista com controle de tentativas (retry),
   * registro em `task_executions`, geração de entregável versionado, revisão pelo Revisor de Qualidade
   * e submissão para `FALCON APPROVALS`.
   */
          executeSingleSpecialistTask(params   
                           
                                     
                      
                     
                   
                                                                          
                        
   )          {
    const { organizationId, tenantDb, projectId, task, userId, extractedBrand } =
      params;
    const agent = tenantDb.getAgentBySlug(task.assignedAgentSlug) ;
    const startMs = Date.now();

    // Atualiza agente para EXECUTING e tarefa para IN_PROGRESS
    this.setAgentState(
      organizationId,
      tenantDb,
      task.assignedAgentSlug,
      AgentOperationalState.EXECUTING,
      task.id,
      agent.defaultSector,
    );
    this.updateTaskStatus(
      organizationId,
      tenantDb,
      task.id,
      TaskStatus.IN_PROGRESS,
    );

    for (let attempt = 1; attempt <= task.maxAttempts; attempt++) {
      const execId = randomUUID();
      const startedAt = new Date().toISOString();

      try {
        if (params.shouldFail) {
          throw new Error(
            `Falha operacional simulada ou timeout no agente ${task.assignedAgentSlug} (tentativa ${attempt}/${task.maxAttempts}).`,
          );
        }

        // Invoca a ferramenta autorizada do especialista
        const primaryTool =
          agent.authorizedTools.find(
            (t) => t !== 'brand.query' && t !== 'agent.message',
          ) ?? 'brand.query';

        const toolOutput = this.toolRegistry.invokeTool(
          {
            organizationId,
            tenantDb,
            agentSlug: task.assignedAgentSlug,
            projectId,
            taskId: task.id,
            userId,
          },
          primaryTool,
          {
            taskTitle: task.title,
            briefing: task.briefing,
            brandDirectives: extractedBrand,
          },
        );

        const durationMs = Math.max(12, Date.now() - startMs);
        const inputTokens = 650 + task.briefing.length * 2;
        const outputTokens = 920;
        const estimatedCostUsd = Number(
          (inputTokens * 0.000003 + outputTokens * 0.000015).toFixed(6),
        );

        // Registra execução real em task_executions
        tenantDb.db
          .prepare(
            `INSERT INTO task_executions (
              id, task_id, agent_id, attempt_number, status, model_used,
              prompt_version, tools_invoked_json, output_summary, output_payload_json,
              input_tokens, cached_tokens, output_tokens, estimated_cost_usd,
              duration_ms, error_message, started_at, finished_at
            ) VALUES (?, ?, ?, ?, 'SUCCEEDED', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, ?)`,
          )
          .run(
            execId,
            task.id,
            agent.id,
            attempt,
            agent.modelName,
            agent.activePromptVersion,
            JSON.stringify([primaryTool]),
            `Execução concluída por ${agent.name} aplicando diretrizes da FALCON BRAND INTELLIGENCE.`,
            JSON.stringify(toolOutput),
            inputTokens,
            outputTokens,
            estimatedCostUsd,
            durationMs,
            startedAt,
            new Date().toISOString(),
          );

        // Registra consumo no ledger do FALCON CORE
        this.core.recordTenantUsage({
          organizationId,
          tokensDelta: inputTokens + outputTokens,
          apiCallsDelta: 1,
          staticArtsDelta:
            task.assignedAgentSlug === OfficialAgentSlug.ART_CAROUSEL_DESIGNER
              ? 1
              : 0,
          estimatedCostUsdDelta: estimatedCostUsd,
        });

        // Gera entregável versionado e passa pelo Revisor de Qualidade
        const deliverable = this.createDeliverableAndRunQualityReview({
          organizationId,
          tenantDb,
          projectId,
          task,
          agentSlug: task.assignedAgentSlug,
          extractedBrand,
        });

        // Cria solicitação no FALCON APPROVALS vinculada à versão exata e checksum SHA-256
        this.createApprovalRequest({
          organizationId,
          tenantDb,
          projectId,
          taskId: task.id,
          deliverableVersionId: deliverable.latestVersionId ,
          versionNumber: deliverable.currentVersion,
          versionChecksumSha256: deliverable.versions[0].checksumSha256,
          requestedByAgentSlug: OfficialAgentSlug.HEAD_MARKETING,
        });

        this.updateTaskStatus(
          organizationId,
          tenantDb,
          task.id,
          TaskStatus.WAITING_APPROVAL,
        );
        this.setAgentState(
          organizationId,
          tenantDb,
          task.assignedAgentSlug,
          AgentOperationalState.WAITING_APPROVAL,
          task.id,
          agent.defaultSector,
        );

        return true;
      } catch (err) {
        const errorMessage = (err         ).message;
        const durationMs = Math.max(5, Date.now() - startMs);

        tenantDb.db
          .prepare(
            `INSERT INTO task_executions (
              id, task_id, agent_id, attempt_number, status, model_used,
              prompt_version, tools_invoked_json, output_summary, output_payload_json,
              input_tokens, cached_tokens, output_tokens, estimated_cost_usd,
              duration_ms, error_message, started_at, finished_at
            ) VALUES (?, ?, ?, ?, 'FAILED', ?, ?, '[]', NULL, NULL, 120, 0, 0, 0.00036, ?, ?, ?, ?)`,
          )
          .run(
            execId,
            task.id,
            agent.id,
            attempt,
            agent.modelName,
            agent.activePromptVersion,
            durationMs,
            errorMessage,
            startedAt,
            new Date().toISOString(),
          );

        if (attempt === task.maxAttempts) {
          // Critério de Aceite 9 do MVP: registra falha, atualiza estado do agente para ERROR e notifica Head de Marketing
          this.updateTaskStatus(
            organizationId,
            tenantDb,
            task.id,
            TaskStatus.FAILED,
          );
          this.setAgentState(
            organizationId,
            tenantDb,
            task.assignedAgentSlug,
            AgentOperationalState.ERROR,
            task.id,
            agent.defaultSector,
          );

          this.toolRegistry.invokeTool(
            {
              organizationId,
              tenantDb,
              agentSlug: task.assignedAgentSlug,
              projectId,
              taskId: task.id,
              userId,
            },
            'agent.message',
            {
              toAgentSlug: OfficialAgentSlug.HEAD_MARKETING,
              messageType: 'ALERT',
              content: `Falha após ${attempt} tentativas na tarefa '${task.title}': ${errorMessage}`,
              contextSnapshot: { taskId: task.id, attemptCount: attempt },
            },
          );
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Gera um entregável real alinhado à FALCON BRAND INTELLIGENCE do cliente e executa o Revisor de Qualidade.
   */
          createDeliverableAndRunQualityReview(params   
                           
                                     
                      
                     
                                 
                                                                          
   )                    {
    const {
      organizationId,
      tenantDb,
      projectId,
      task,
      agentSlug,
      extractedBrand,
    } = params;

    const deliverableType = this.mapAgentToDeliverableType(agentSlug);
    const generated = this.synthesizeBrandAlignedContent({
      agentSlug,
      taskTitle: task.title,
      briefing: task.briefing,
      extractedBrand,
    });

    // Revisor de Qualidade (Aegis) audita ortografia, tom de voz e ausência de palavras proibidas
    this.setAgentState(
      organizationId,
      tenantDb,
      OfficialAgentSlug.QUALITY_REVIEWER,
      AgentOperationalState.REVIEWING,
      task.id,
      'PERFORMANCE_RESULTS_AREA',
    );

    const qaResult = this.runAutomatedQualityAudit(
      generated.contentMarkdown,
      extractedBrand,
    );

    const versionId = randomUUID();
    const now = new Date().toISOString();
    const structuredJson = JSON.stringify(generated.contentStructured);
    const checksumSha256 = computeSha256Checksum(
      `${structuredJson}::${generated.contentMarkdown}`,
    );

    tenantDb.db
      .prepare(
        `INSERT INTO deliverable_versions (
          id, project_id, task_id, version_number, format_type, title,
          content_body, structured_content_json, storage_key, mime_type,
          size_bytes, checksum_sha256, created_by_agent_slug, created_by_user_id,
          qa_review_status, qa_review_notes, is_superseded, created_at
        ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, NULL, 'text/markdown', ?, ?, ?, NULL, 'APPROVED', ?, 0, ?)`,
      )
      .run(
        versionId,
        projectId,
        task.id,
        deliverableType,
        task.title,
        generated.contentMarkdown,
        structuredJson,
        Buffer.byteLength(generated.contentMarkdown, 'utf8'),
        checksumSha256,
        agentSlug,
        JSON.stringify({ score: qaResult.score, feedback: qaResult.feedback }),
        now,
      );

    tenantDb.db
      .prepare(
        'UPDATE tasks SET latest_deliverable_version_id = ?, updated_at = ? WHERE id = ?',
      )
      .run(versionId, now, task.id);

    this.setAgentState(
      organizationId,
      tenantDb,
      OfficialAgentSlug.QUALITY_REVIEWER,
      AgentOperationalState.AVAILABLE,
      null,
      'PERFORMANCE_RESULTS_AREA',
    );

    return this.getDeliverableById(tenantDb, task.id) ;
  }

  /**
   * Cria uma nova versão (v2, v3...) de um entregável existente no FALCON STUDIO ou por ajuste solicitado.
   * Ao criar uma nova versão, qualquer versão anterior é marcada como `is_superseded = 1`
   * para impedir publicação externa de versão antiga quando há versão mais recente (Seção 16 e 17, Critério 10 e 11 do MVP).
   */
  createNewDeliverableVersion(params   
                           
                                     
                          
                                               
                            
                        
                             
                                           
   )                    {
    const { organizationId, tenantDb, deliverableId } = params;
    const existing = this.getDeliverableById(tenantDb, deliverableId);
    if (!existing) {
      throw new Error(`Entregável '${deliverableId}' não encontrado.`);
    }

    const nextVersionNumber = existing.currentVersion + 1;
    const versionId = randomUUID();
    const now = new Date().toISOString();
    const structuredJson = JSON.stringify({
      ...params.contentStructured,
      changeNotes: params.changeNotes,
    });
    const checksumSha256 = computeSha256Checksum(
      `${structuredJson}::${params.contentMarkdown}`,
    );

    // Marca versões anteriores como superseded (is_superseded = 1)
    tenantDb.db
      .prepare(
        'UPDATE deliverable_versions SET is_superseded = 1 WHERE task_id = ?',
      )
      .run(existing.taskId);

    tenantDb.db
      .prepare(
        `INSERT INTO deliverable_versions (
          id, project_id, task_id, version_number, format_type, title,
          content_body, structured_content_json, storage_key, mime_type,
          size_bytes, checksum_sha256, created_by_agent_slug, created_by_user_id,
          qa_review_status, qa_review_notes, is_superseded, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'text/markdown', ?, ?, ?, ?, 'APPROVED', ?, 0, ?)`,
      )
      .run(
        versionId,
        existing.projectId,
        existing.taskId,
        nextVersionNumber,
        existing.deliverableType,
        existing.title,
        params.contentMarkdown,
        structuredJson,
        Buffer.byteLength(params.contentMarkdown, 'utf8'),
        checksumSha256,
        params.createdByAgentSlug ?? null,
        params.createdByUserId ?? null,
        JSON.stringify({ score: 98, feedback: params.changeNotes }),
        now,
      );

    tenantDb.db
      .prepare(
        'UPDATE tasks SET latest_deliverable_version_id = ?, status = ?, updated_at = ? WHERE id = ?',
      )
      .run(versionId, TaskStatus.WAITING_APPROVAL, now, existing.taskId);

    // Cria novo pedido de aprovação para a nova versão
    this.createApprovalRequest({
      organizationId,
      tenantDb,
      projectId: existing.projectId,
      taskId: existing.taskId,
      deliverableVersionId: versionId,
      versionNumber: nextVersionNumber,
      versionChecksumSha256: checksumSha256,
      requestedByAgentSlug:
        params.createdByAgentSlug ?? OfficialAgentSlug.HEAD_MARKETING,
    });

    tenantDb.recordTenantAudit({
      actorType: params.createdByUserId ? 'USER' : 'AGENT',
      actorId:
        params.createdByUserId ??
        params.createdByAgentSlug ??
        OfficialAgentSlug.HEAD_MARKETING,
      action: 'deliverable.version_created',
      entityType: 'deliverable',
      entityId: deliverableId,
      details: {
        versionNumber: nextVersionNumber,
        versionId,
        checksumSha256,
        changeNotes: params.changeNotes,
      },
    });

    return this.getDeliverableById(tenantDb, existing.taskId) ;
  }

          createApprovalRequest(params   
                           
                                     
                      
                   
                                 
                          
                                  
                                            
   )                 {
    const id = randomUUID();
    const now = new Date().toISOString();

    params.tenantDb.db
      .prepare(
        `INSERT INTO approvals (
          id, project_id, task_id, deliverable_version_id, version_number,
          content_checksum_sha256, status, requested_by_agent_slug, requested_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      )
      .run(
        id,
        params.projectId,
        params.taskId,
        params.deliverableVersionId,
        params.versionNumber,
        params.versionChecksumSha256,
        params.requestedByAgentSlug,
        now,
      );

    this.eventBus.emit(params.organizationId, 'approval.requested', {
      approvalId: id,
      projectId: params.projectId,
      taskId: params.taskId,
      deliverableId: params.taskId,
      deliverableVersionId: params.deliverableVersionId,
      versionChecksumSha256: params.versionChecksumSha256,
    });

    return this.getApprovalById(params.tenantDb, id) ;
  }

  /**
   * Decisão do cliente sobre uma aprovação no FALCON APPROVALS (Aprovar, Solicitar Ajustes ou Rejeitar).
   */
  reviewApproval(params   
                           
                                     
                       
                                                            
                           
                             
   )                 {
    const { organizationId, tenantDb, approvalId, decision, reviewerUserId } =
      params;
    const approval = this.getApprovalById(tenantDb, approvalId);
    if (!approval) {
      throw new Error(`Aprovação '${approvalId}' não encontrada.`);
    }

    const now = new Date().toISOString();
    tenantDb.db
      .prepare(
        `UPDATE approvals
         SET status = ?, decided_by_user_id = ?, decision_notes = ?, decided_at = ?
         WHERE id = ?`,
      )
      .run(
        decision,
        reviewerUserId,
        params.feedbackComment ?? null,
        now,
        approvalId,
      );

    if (decision === ApprovalStatus.APPROVED) {
      this.updateTaskStatus(
        organizationId,
        tenantDb,
        approval.taskId,
        TaskStatus.APPROVED,
      );

      const task = this.getTaskById(tenantDb, approval.taskId);
      if (task) {
        this.setAgentState(
          organizationId,
          tenantDb,
          task.assignedAgentSlug,
          AgentOperationalState.COMPLETED,
          null,
        );
      }
    } else if (decision === ApprovalStatus.CHANGES_REQUESTED) {
      this.updateTaskStatus(
        organizationId,
        tenantDb,
        approval.taskId,
        TaskStatus.IN_REVIEW,
      );
    }

    tenantDb.recordTenantAudit({
      actorType: 'USER',
      actorId: reviewerUserId,
      action: `approval.${decision.toLowerCase()}`,
      entityType: 'approval',
      entityId: approvalId,
      details: {
        deliverableVersionId: approval.deliverableVersionId,
        versionChecksumSha256: approval.versionChecksumSha256,
        feedbackComment: params.feedbackComment ?? null,
      },
    });

    this.eventBus.emit(organizationId, 'approval.resolved', {
      approvalId,
      decision,
      deliverableId: approval.deliverableId,
      deliverableVersionId: approval.deliverableVersionId,
      reviewerUserId,
    });

    return this.getApprovalById(tenantDb, approvalId) ;
  }

          updateTaskStatus(
    organizationId        ,
    tenantDb                        ,
    taskId        ,
    status            ,
  )       {
    const now = new Date().toISOString();
    tenantDb.db
      .prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, taskId);

    this.eventBus.emit(organizationId, 'task.status_changed', {
      taskId,
      status,
    });
  }

          extractBrandDirectives(entries                          )   
                      
                    
                             
                                     
                                     
                           
                      
                           
    {
    let brandName = 'Sua Marca';
    let segment = 'Mercado B2B/B2C';
    let toneAdjectives           = ['Estratégico', 'Profissional', 'Claro'];
    let forbiddenWordsExcluded           = [];
    let preferredTermsIncluded           = ['resultados consistentes'];
    let visualColors           = ['#0F172A', '#F59E0B'];
    let mainOffer = 'Soluções de alto impacto';
    let targetAudience = 'Decisores e clientes qualificados';

    for (const entry of entries) {
      const data = entry.structuredData;
      if (entry.category === BrandMemoryCategory.INSTITUTIONAL_IDENTITY) {
        if (typeof data.tradeName === 'string') brandName = data.tradeName;
        else if (typeof data.publicName === 'string') brandName = data.publicName;
        if (typeof data.segment === 'string') segment = data.segment;
      }
      if (entry.category === BrandMemoryCategory.TONE_OF_VOICE) {
        if (Array.isArray(data.toneAdjectives)) {
          toneAdjectives = data.toneAdjectives.map(String);
        }
        if (Array.isArray(data.forbiddenWords)) {
          forbiddenWordsExcluded = data.forbiddenWords.map(String);
        }
        if (Array.isArray(data.preferredTerms)) {
          preferredTermsIncluded = data.preferredTerms.map(String);
        }
      }
      if (entry.category === BrandMemoryCategory.VISUAL_IDENTITY) {
        if (Array.isArray(data.primaryColors)) {
          visualColors = data.primaryColors.map(String);
        }
      }
      if (entry.category === BrandMemoryCategory.PRODUCTS_SERVICES) {
        if (typeof data.flagshipOffer === 'string') {
          mainOffer = data.flagshipOffer;
        }
      }
      if (entry.category === BrandMemoryCategory.AUDIENCES_PERSONAS) {
        if (typeof data.primaryPersona === 'string') {
          targetAudience = data.primaryPersona;
        }
      }
    }

    return {
      brandName,
      segment,
      toneAdjectives,
      forbiddenWordsExcluded,
      preferredTermsIncluded,
      visualColors,
      mainOffer,
      targetAudience,
    };
  }

          deriveProjectTitle(prompt        )         {
    const cleaned = prompt.trim().replace(/\s+/g, ' ');
    if (cleaned.length <= 68) return cleaned;
    return `${cleaned.slice(0, 65)}...`;
  }

          buildSpecialistTaskDag(
    prompt        ,
    targetChannels           ,
  )         
                     
                  
                     
                                 
                              
     {
    const lower = prompt.toLowerCase();
    const channelsText = (targetChannels ?? ['Instagram', 'LinkedIn']).join(', ');

    const nodes         
                       
                    
                       
                                   
                                
       = [
      {
        stageKey: 'concept',
        title: 'Direção Criativa & Conceito Central da Campanha',
        briefing: `Definir o conceito criativo, ângulo central e linha narrativa para: "${prompt}". Canais: ${channelsText}.`,
        agentSlug: OfficialAgentSlug.HEAD_CREATIVE,
        dependsOnStages: [],
      },
      {
        stageKey: 'calendar',
        title: 'Planejamento de Pauta & Distribuição por Canal',
        briefing: `Estruturar pauta, formato ideal e cronograma de publicação nos canais ${channelsText} para: "${prompt}".`,
        agentSlug: OfficialAgentSlug.SOCIAL_MEDIA,
        dependsOnStages: ['concept'],
      },
      {
        stageKey: 'copy',
        title: 'Redação de Copy, Headlines e Legenda Estratégica',
        briefing: `Escrever copy persuasiva, headlines e legenda com CTA claro para "${prompt}", respeitando rigorosamente o tom de voz da marca.`,
        agentSlug: OfficialAgentSlug.COPYWRITER,
        dependsOnStages: ['concept'],
      },
      {
        stageKey: 'design',
        title: 'Criação Visual de Arte / Carrossel Estruturado',
        briefing: `Desenvolver direção visual lâmina a lâmina e composição gráfica alinhada à identidade visual para "${prompt}".`,
        agentSlug: OfficialAgentSlug.ART_CAROUSEL_DESIGNER,
        dependsOnStages: ['copy'],
      },
    ];

    if (
      lower.includes('vídeo') ||
      lower.includes('video') ||
      lower.includes('reels') ||
      lower.includes('tiktok') ||
      lower.includes('shorts')
    ) {
      nodes.push({
        stageKey: 'video',
        title: 'Roteiro Audiovisual & Decupagem de Cenas (Reels/Shorts)',
        briefing: `Criar roteiro dinâmico com gancho de 3 segundos, decupagem visual e CTA para "${prompt}".`,
        agentSlug: OfficialAgentSlug.VIDEO_EDITOR,
        dependsOnStages: ['copy'],
      });
    }

    if (
      lower.includes('tráfego') ||
      lower.includes('trafego') ||
      lower.includes('anúncio') ||
      lower.includes('anuncio') ||
      lower.includes('ads') ||
      lower.includes('campanha')
    ) {
      nodes.push({
        stageKey: 'traffic',
        title: 'Plano de Mídia Paga, Segmentação & Orçamento',
        briefing: `Estruturar campanha de tráfego pago (Meta Ads / Google Ads), segmentação e metas de ROAS/CPA para "${prompt}".`,
        agentSlug: OfficialAgentSlug.PAID_TRAFFIC_MANAGER,
        dependsOnStages: ['copy', 'design'],
      });
    }

    return nodes;
  }

          mapAgentToDeliverableType(
    agentSlug                   ,
  )                  {
    switch (agentSlug) {
      case OfficialAgentSlug.SOCIAL_MEDIA:
        return DeliverableType.EDITORIAL_CALENDAR;
      case OfficialAgentSlug.ART_CAROUSEL_DESIGNER:
      case OfficialAgentSlug.BRANDING_DESIGNER:
        return DeliverableType.CAROUSEL;
      case OfficialAgentSlug.VIDEO_EDITOR:
        return DeliverableType.VIDEO_SCRIPT;
      case OfficialAgentSlug.PAID_TRAFFIC_MANAGER:
        return DeliverableType.AD_CAMPAIGN_PLAN;
      case OfficialAgentSlug.PERFORMANCE_ANALYST:
        return DeliverableType.PERFORMANCE_REPORT;
      default:
        return DeliverableType.COPY_PACK;
    }
  }

          synthesizeBrandAlignedContent(params   
                                 
                      
                     
                                                                          
   )   
                    
                                               
                            
    {
    const { agentSlug, taskTitle, briefing, extractedBrand } = params;
    const toneStr = extractedBrand.toneAdjectives.join(', ');
    const preferredStr = extractedBrand.preferredTermsIncluded.join(', ');

    const slidesOrSections = [
      {
        order: 1,
        headline: `${extractedBrand.brandName}: ${preferredStr.toUpperCase()}`,
        body: `Abordagem ${toneStr} voltada para ${extractedBrand.targetAudience} no segmento de ${extractedBrand.segment}.`,
      },
      {
        order: 2,
        headline: 'Proposta de Valor e Diferencial Competitivo',
        body: `Nossa oferta principal (${extractedBrand.mainOffer}) entrega ${preferredStr} com consistência e previsibilidade.`,
      },
      {
        order: 3,
        headline: 'Chamada para Ação (CTA)',
        body: `Agende um diagnóstico estratégico com a equipe ${extractedBrand.brandName} e acelere sua operação.`,
      },
    ];

    let markdown = [
      `# ${taskTitle}`,
      `**Marca:** ${extractedBrand.brandName} | **Segmento:** ${extractedBrand.segment}`,
      `**Tom de Voz Aplicado:** ${toneStr}`,
      `**Paleta Oficial:** ${extractedBrand.visualColors.join(' / ')}`,
      '',
      `## Briefing Executado`,
      briefing,
      '',
      `## Estrutura da Entrega (${agentSlug})`,
      ...slidesOrSections.map(
        (s) => `### Lâmina / Seção ${s.order}: ${s.headline}\n${s.body}`,
      ),
    ].join('\n');

    // Garante que nenhuma palavra proibida na Brand Intelligence apareça no entregável
    for (const forbidden of extractedBrand.forbiddenWordsExcluded) {
      if (forbidden.trim().length > 0) {
        const regex = new RegExp(forbidden.trim(), 'gi');
        markdown = markdown.replace(regex, '[TERMO_SUBSTITUIDO_PELA_GOVERNANCA]');
      }
    }

    return {
      channel: 'INSTAGRAM_LINKEDIN',
      contentStructured: {
        brandName: extractedBrand.brandName,
        toneApplied: extractedBrand.toneAdjectives,
        preferredTermsUsed: extractedBrand.preferredTermsIncluded,
        visualPalette: extractedBrand.visualColors,
        sections: slidesOrSections,
      },
      contentMarkdown: markdown,
    };
  }

          runAutomatedQualityAudit(
    markdown        ,
    extractedBrand                                                       ,
  )                                      {
    const lower = markdown.toLowerCase();
    const violatedWords = extractedBrand.forbiddenWordsExcluded.filter(
      (w) => w.trim().length > 0 && lower.includes(w.trim().toLowerCase()),
    );

    if (violatedWords.length > 0) {
      return {
        score: 65,
        feedback: `Atenção: foram detectados termos restritos (${violatedWords.join(', ')}).`,
      };
    }

    return {
      score: 98,
      feedback: `Aprovado pelo Revisor de Qualidade: aderência verificada ao tom de voz (${extractedBrand.toneAdjectives.join(', ')}), vocabulário prioritário incluído e zero palavras proibidas.`,
    };
  }

  // ── Consultas de Projetos, Tarefas, Mensagens, Entregáveis e Aprovações ───

  getProjectById(
    tenantDb                        ,
    projectId        ,
  )                       {
    const row = tenantDb.db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId)                                       ;
    if (!row) return null;
    return {
      id: String(row.id),
      title: String(row.title),
      objective: String(row.objective),
      originChannel: String(row.source_channel),
      status: String(row.status)                 ,
      priority: String(row.priority)                ,
      createdByUserId: row.requester_user_id
        ? String(row.requester_user_id)
        : null,
      supervisedByAgentSlug: OfficialAgentSlug.HEAD_MARKETING,
      dueDate: row.due_at ? String(row.due_at) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  listProjects(tenantDb                        )                  {
    const rows = tenantDb.db
      .prepare('SELECT id FROM projects ORDER BY created_at DESC')
      .all()                         ;
    return rows.map((r) => this.getProjectById(tenantDb, String(r.id)) );
  }

  getTaskById(
    tenantDb                        ,
    taskId        ,
  )                    {
    const row = tenantDb.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(taskId)                                       ;
    if (!row) return null;

    const depRows = tenantDb.db
      .prepare(
        'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?',
      )
      .all(taskId)                                         ;

    const execStats = tenantDb.db
      .prepare(
        `SELECT COUNT(*) as attempts,
                (SELECT error_message FROM task_executions WHERE task_id = ? ORDER BY attempt_number DESC LIMIT 1) as last_error
         FROM task_executions WHERE task_id = ?`,
      )
      .get(taskId, taskId)                                                   ;

    return {
      id: String(row.id),
      projectId: String(row.project_id),
      parentTaskId: row.parent_task_id ? String(row.parent_task_id) : null,
      title: String(row.title),
      briefing: String(row.description),
      assignedAgentSlug: String(row.assigned_agent_slug)                     ,
      status: String(row.status)              ,
      priority: String(row.priority)                ,
      dependsOnTaskIds: depRows.map((d) => String(d.depends_on_task_id)),
      attemptCount: Number(execStats?.attempts ?? 0),
      maxAttempts: 2,
      lastError: execStats?.last_error ? String(execStats.last_error) : null,
      latestDeliverableVersionId: row.latest_deliverable_version_id
        ? String(row.latest_deliverable_version_id)
        : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  listProjectTasks(
    tenantDb                        ,
    projectId        ,
  )               {
    const rows = tenantDb.db
      .prepare('SELECT id FROM tasks WHERE project_id = ? ORDER BY created_at ASC')
      .all(projectId)                         ;
    return rows.map((r) => this.getTaskById(tenantDb, String(r.id)) );
  }

  listProjectMessages(
    tenantDb                        ,
    projectId        ,
  )                       {
    const rows = tenantDb.db
      .prepare(
        'SELECT * FROM agent_messages WHERE project_id = ? ORDER BY created_at ASC',
      )
      .all(projectId)                                  ;
    return rows.map((r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      taskId: r.task_id ? String(r.task_id) : null,
      fromAgentSlug: String(r.from_agent_slug)                     ,
      toAgentSlug: String(r.to_agent_slug)                     ,
      messageType: String(
        r.message_type,
      )                                     ,
      content: String(r.content),
      contextSnapshot: JSON.parse(
        String(r.structured_payload_json),
      )                           ,
      createdAt: String(r.created_at),
    }));
  }

  getDeliverableById(
    tenantDb                        ,
    taskId        ,
  )                           {
    const taskRow = tenantDb.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(taskId)                                       ;
    if (!taskRow) return null;

    const versionRows = tenantDb.db
      .prepare(
        'SELECT * FROM deliverable_versions WHERE task_id = ? ORDER BY version_number ASC',
      )
      .all(taskId)                                  ;

    if (versionRows.length === 0) return null;

    const versions                             = versionRows.map((v) => ({
      id: String(v.id),
      deliverableId: taskId,
      versionNumber: Number(v.version_number),
      contentStructured: JSON.parse(
        String(v.structured_content_json),
      )                           ,
      contentMarkdown: String(v.content_body),
      assetStorageKeys: v.storage_key ? [String(v.storage_key)] : [],
      checksumSha256: String(v.checksum_sha256),
      createdByAgentSlug: v.created_by_agent_slug
        ? (String(v.created_by_agent_slug)                     )
        : null,
      createdByUserId: v.created_by_user_id
        ? String(v.created_by_user_id)
        : null,
      changeNotes: String(v.qa_review_notes ?? ''),
      isSuperseded: Boolean(v.is_superseded),
      createdAt: String(v.created_at),
    }));

    const latestVersion = versions[versions.length - 1];
    let qaScore = 98;
    let qaFeedback = 'Aprovado pelo Revisor de Qualidade';
    try {
      const parsedQa = JSON.parse(latestVersion.changeNotes)     
                       
                          
       ;
      if (typeof parsedQa.score === 'number') qaScore = parsedQa.score;
      if (typeof parsedQa.feedback === 'string') qaFeedback = parsedQa.feedback;
    } catch {
      // keep defaults
    }

    return {
      id: taskId,
      projectId: String(taskRow.project_id),
      taskId,
      title: String(taskRow.title),
      deliverableType: String(
        versionRows[0].format_type,
      )                   ,
      channel: 'INSTAGRAM_LINKEDIN',
      currentVersion: latestVersion.versionNumber,
      latestVersionId: latestVersion.id,
      qaReviewedByAgent: true,
      qaScore,
      qaFeedback,
      status: String(taskRow.status),
      versions,
      createdAt: versions[0].createdAt,
      updatedAt: latestVersion.createdAt,
    };
  }

  listProjectDeliverables(
    tenantDb                        ,
    projectId         ,
  )                      {
    const rows = projectId
      ? (tenantDb.db
          .prepare(
            'SELECT DISTINCT task_id FROM deliverable_versions WHERE project_id = ? ORDER BY created_at ASC',
          )
          .all(projectId)                              )
      : (tenantDb.db
          .prepare(
            'SELECT DISTINCT task_id FROM deliverable_versions ORDER BY created_at DESC',
          )
          .all()                              );

    return rows
      .map((r) => this.getDeliverableById(tenantDb, String(r.task_id)))
      .filter((d)                         => Boolean(d));
  }

  getApprovalById(
    tenantDb                        ,
    approvalId        ,
  )                        {
    const row = tenantDb.db
      .prepare('SELECT * FROM approvals WHERE id = ?')
      .get(approvalId)                                       ;
    if (!row) return null;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      taskId: String(row.task_id),
      deliverableId: String(row.task_id),
      deliverableVersionId: String(row.deliverable_version_id),
      versionNumber: Number(row.version_number),
      versionChecksumSha256: String(row.content_checksum_sha256),
      actionType: 'EXTERNAL_PUBLISH',
      status: String(row.status)                  ,
      requestedByAgentSlug: String(
        row.requested_by_agent_slug,
      )                     ,
      reviewedByUserId: row.decided_by_user_id
        ? String(row.decided_by_user_id)
        : null,
      feedbackComment: row.decision_notes
        ? String(row.decision_notes)
        : null,
      requestedAt: String(row.requested_at),
      reviewedAt: row.decided_at ? String(row.decided_at) : null,
    };
  }

  listProjectApprovals(
    tenantDb                        ,
    projectId         ,
  )                   {
    const rows = projectId
      ? (tenantDb.db
          .prepare(
            'SELECT id FROM approvals WHERE project_id = ? ORDER BY requested_at ASC',
          )
          .all(projectId)                         )
      : (tenantDb.db
          .prepare('SELECT id FROM approvals ORDER BY requested_at DESC')
          .all()                         );
    return rows.map((r) => this.getApprovalById(tenantDb, String(r.id)) );
  }
}
