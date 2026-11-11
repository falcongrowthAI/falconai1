/**
 * @falcon/contracts
 * Contratos canônicos, regras de domínio e protocolo de eventos em tempo real do FALCON GROWTH.
 * Fonte única de verdade compartilhada entre Control Plane, Tenant Data Plane, AI Runtime,
 * FALCON VIRTUAL OFFICE 3D e Dashboard Web.
 */

// ============================================================================
// 1. FALCON CORE — ESTADOS DE ORGANIZAÇÃO E PLANOS SAAS (Seções 7 e 26)
// ============================================================================

export const OrganizationStatus = {
  LEAD: 'LEAD',
  COMMERCIAL_ONBOARDING: 'COMMERCIAL_ONBOARDING',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PROVISIONING: 'PROVISIONING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
}         ;
                                
                                                               

/**
 * Transições válidas de estado de uma Organização no FALCON CORE (Seção 7.1).
 */
export const ALLOWED_ORG_STATUS_TRANSITIONS           
                                                           
  = {
  LEAD: ['COMMERCIAL_ONBOARDING', 'CLOSED'],
  COMMERCIAL_ONBOARDING: ['AWAITING_PAYMENT', 'PROVISIONING', 'CLOSED'],
  AWAITING_PAYMENT: ['PROVISIONING', 'SUSPENDED', 'CLOSED'],
  PROVISIONING: ['ACTIVE', 'SUSPENDED'],
  ACTIVE: ['SUSPENDED', 'CLOSING'],
  SUSPENDED: ['ACTIVE', 'CLOSING', 'CLOSED'],
  CLOSING: ['CLOSED', 'ACTIVE'],
  CLOSED: [],
};

export function canTransitionOrganizationStatus(
  from                    ,
  to                    ,
)          {
  return ALLOWED_ORG_STATUS_TRANSITIONS[from].includes(to);
}

export const PlanTier = {
  STARTER: 'STARTER',
  GROWTH: 'GROWTH',
  PREMIUM: 'PREMIUM',
}         ;
                                                                

                                  
                 
               
                   
                          
                              
                            
                                
                                  
                          
                            
                              
                                  
 

export const DEFAULT_PLAN_QUOTAS                                              = {
  STARTER: {
    tier: 'STARTER',
    name: 'Falcon Starter',
    maxUsers: 3,
    maxActiveAgents: 6,
    maxProjectsPerMonth: 15,
    maxTokensPerMonth: 2_000_000,
    maxStaticArtsPerMonth: 30,
    maxVideoMinutesPerMonth: 0,
    maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    maxSocialChannels: 2,
    allowPaidAdsModule: false,
    allowFullOfficeBuilder: false,
  },
  GROWTH: {
    tier: 'GROWTH',
    name: 'Falcon Growth',
    maxUsers: 10,
    maxActiveAgents: 9,
    maxProjectsPerMonth: 60,
    maxTokensPerMonth: 10_000_000,
    maxStaticArtsPerMonth: 120,
    maxVideoMinutesPerMonth: 30,
    maxStorageBytes: 25 * 1024 * 1024 * 1024, // 25 GB
    maxSocialChannels: 6,
    allowPaidAdsModule: false,
    allowFullOfficeBuilder: true,
  },
  PREMIUM: {
    tier: 'PREMIUM',
    name: 'Falcon Premium',
    maxUsers: 50,
    maxActiveAgents: 11,
    maxProjectsPerMonth: 300,
    maxTokensPerMonth: 50_000_000,
    maxStaticArtsPerMonth: 500,
    maxVideoMinutesPerMonth: 180,
    maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    maxSocialChannels: 20,
    allowPaidAdsModule: true,
    allowFullOfficeBuilder: true,
  },
};

// ============================================================================
// 2. AUTENTICAÇÃO, PAPÉIS E PERMISSÕES POR TENANT (Seções 12 e 22)
// ============================================================================

export const TenantRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  APPROVER: 'APPROVER',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
}         ;
                                                                      

export const PermissionAction = {
  MANAGE_ORGANIZATION: 'organization:manage',
  MANAGE_USERS: 'users:manage',
  MANAGE_AUTONOMY_POLICIES: 'autonomy:manage',
  EDIT_BRAND_PERMANENT_MEMORY: 'brand:edit_permanent',
  SUGGEST_BRAND_MEMORY: 'brand:suggest',
  CREATE_PROJECT_REQUEST: 'projects:create',
  APPROVE_DELIVERABLES: 'approvals:decide',
  AUTHORIZE_EXTERNAL_PUBLISH: 'social:authorize_publish',
  AUTHORIZE_ADS_BUDGET: 'ads:authorize_budget',
  MANAGE_INTEGRATIONS: 'connect:manage',
  EDIT_VIRTUAL_OFFICE_LAYOUT: 'office:edit_layout',
  MANAGE_CRM: 'crm:manage',
  VIEW_REPORTS: 'performance:view',
  DELETE_TENANT_DATA: 'data:delete',
}         ;
                              
                                                           

export const ROLE_PERMISSIONS           
                                                 
  = {
  OWNER: Object.values(PermissionAction),
  ADMIN: Object.values(PermissionAction),
  MANAGER: [
    PermissionAction.SUGGEST_BRAND_MEMORY,
    PermissionAction.CREATE_PROJECT_REQUEST,
    PermissionAction.APPROVE_DELIVERABLES,
    PermissionAction.AUTHORIZE_EXTERNAL_PUBLISH,
    PermissionAction.EDIT_VIRTUAL_OFFICE_LAYOUT,
    PermissionAction.MANAGE_CRM,
    PermissionAction.VIEW_REPORTS,
  ],
  APPROVER: [
    PermissionAction.CREATE_PROJECT_REQUEST,
    PermissionAction.APPROVE_DELIVERABLES,
    PermissionAction.AUTHORIZE_EXTERNAL_PUBLISH,
    PermissionAction.VIEW_REPORTS,
  ],
  MEMBER: [
    PermissionAction.SUGGEST_BRAND_MEMORY,
    PermissionAction.CREATE_PROJECT_REQUEST,
    PermissionAction.MANAGE_CRM,
    PermissionAction.VIEW_REPORTS,
  ],
  VIEWER: [PermissionAction.VIEW_REPORTS],
};

export function roleHasPermission(
  role            ,
  permission                  ,
)          {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ============================================================================
// 3. FALCON SETUP (ONBOARDING 11 ETAPAS) & BRAND INTELLIGENCE (Seções 8 e 9)
// ============================================================================

export const OnboardingStepKey = {
  IDENTIFICATION: 'identification',
  HISTORY: 'history',
  OFFER: 'offer',
  AUDIENCE: 'audience',
  POSITIONING: 'positioning',
  VISUAL_IDENTITY: 'visual_identity',
  TONE_OF_VOICE: 'tone_of_voice',
  CHANNELS: 'channels',
  OBJECTIVES: 'objectives',
  OPERATION: 'operation',
  INTEGRATIONS: 'integrations',
}         ;
                               
                                                             

export const ONBOARDING_STEPS_ORDERED                               = [
  OnboardingStepKey.IDENTIFICATION,
  OnboardingStepKey.HISTORY,
  OnboardingStepKey.OFFER,
  OnboardingStepKey.AUDIENCE,
  OnboardingStepKey.POSITIONING,
  OnboardingStepKey.VISUAL_IDENTITY,
  OnboardingStepKey.TONE_OF_VOICE,
  OnboardingStepKey.CHANNELS,
  OnboardingStepKey.OBJECTIVES,
  OnboardingStepKey.OPERATION,
  OnboardingStepKey.INTEGRATIONS,
];

export const BrandMemoryCategory = {
  INSTITUTIONAL_IDENTITY: 'institutional_identity',
  VISUAL_IDENTITY: 'visual_identity',
  PRODUCTS_SERVICES: 'products_services',
  AUDIENCES_PERSONAS: 'audiences_personas',
  POSITIONING_STRATEGY: 'positioning_strategy',
  TONE_OF_VOICE: 'tone_of_voice',
  REFERENCES_COMPETITORS: 'references_competitors',
  RESTRICTIONS_PROHIBITIONS: 'restrictions_prohibitions',
  CAMPAIGNS_LEARNINGS: 'campaigns_learnings',
  OPERATIONAL_PREFERENCES: 'operational_preferences',
}         ;
                                 
                                                                 

export const BrandMemoryLevel = {
  PERMANENT: 'PERMANENT',
  OPERATIONAL: 'OPERATIONAL',
  TEMPORARY: 'TEMPORARY',
}         ;
                              
                                                           

// ============================================================================
// 4. FALCON VIRTUAL OFFICE 3D — 9 AMBIENTES E INTERAÇÕES (Seção 13)
// ============================================================================

export const OfficeSectorId = {
  RECEPTION: 'RECEPTION',
  HEAD_OFFICE: 'HEAD_OFFICE',
  STRATEGY_PLANNING: 'STRATEGY_PLANNING',
  SOCIAL_MEDIA_AREA: 'SOCIAL_MEDIA_AREA',
  DESIGN_BRANDING_AREA: 'DESIGN_BRANDING_AREA',
  AUDIOVISUAL_STUDIO: 'AUDIOVISUAL_STUDIO',
  PAID_TRAFFIC_AREA: 'PAID_TRAFFIC_AREA',
  MEETING_ROOM: 'MEETING_ROOM',
  PERFORMANCE_RESULTS_AREA: 'PERFORMANCE_RESULTS_AREA',
}         ;
                            
                                                       

                                        
                     
                
                
                      
               
               
                          
                
              
              
           
                 
                   
            
 

export const OFFICIAL_OFFICE_SECTORS                                   = [
  {
    id: OfficeSectorId.RECEPTION,
    label: 'Recepção e Entrada',
    color: '#f59e0b',
    description: 'Recepção da agência virtual, boas-vindas e visão geral da operação.',
    linkedModule: 'COMMAND',
  },
  {
    id: OfficeSectorId.HEAD_OFFICE,
    label: 'Diretoria / Head de Marketing',
    color: '#3b82f6',
    description: 'Sala de comando estratégico e supervisão geral do Head de Marketing.',
    linkedModule: 'PROJECTS',
  },
  {
    id: OfficeSectorId.STRATEGY_PLANNING,
    label: 'Estratégia e Planejamento',
    color: '#8b5cf6',
    description: 'Direção criativa, conceitos de campanhas e Brand Intelligence.',
    linkedModule: 'BRAND_INTELLIGENCE',
  },
  {
    id: OfficeSectorId.SOCIAL_MEDIA_AREA,
    label: 'Área de Social Media & Copy',
    color: '#ec4899',
    description: 'Planejamento de calendário editorial, pautas, redação e publicação.',
    linkedModule: 'SOCIAL',
  },
  {
    id: OfficeSectorId.DESIGN_BRANDING_AREA,
    label: 'Design e Branding',
    color: '#10b981',
    description: 'Criação de identidade visual, peças estáticas, carrosséis e layouts.',
    linkedModule: 'STUDIO',
  },
  {
    id: OfficeSectorId.AUDIOVISUAL_STUDIO,
    label: 'Estúdio Audiovisual',
    color: '#ef4444',
    description: 'Produção de vídeo, cortes para Reels/TikTok, roteiros visuais e legendas.',
    linkedModule: 'STUDIO',
  },
  {
    id: OfficeSectorId.PAID_TRAFFIC_AREA,
    label: 'Área de Tráfego Pago',
    color: '#06b6d4',
    description: 'Planejamento, público, orçamento e gestão de campanhas Meta Ads.',
    linkedModule: 'ADS',
  },
  {
    id: OfficeSectorId.MEETING_ROOM,
    label: 'Sala de Reuniões',
    color: '#eab308',
    description: 'Alinhamento de projetos, pautas multidisciplinares e aprovações.',
    linkedModule: 'APPROVALS',
  },
  {
    id: OfficeSectorId.PERFORMANCE_RESULTS_AREA,
    label: 'Resultados e Performance',
    color: '#6366f1',
    description: 'Análise de indicadores, controle de qualidade e relatórios executivos.',
    linkedModule: 'PERFORMANCE',
  },
];

// ============================================================================
// 5. FALCON AI TEAM — OS 11 AGENTES ESPECIALIZADOS E ESTADOS REAIS (Seção 10 e 13.3)
// ============================================================================

export const AgentOperationalState = {
  AVAILABLE: 'AVAILABLE',
  PLANNING: 'PLANNING',
  EXECUTING: 'EXECUTING',
  IN_MEETING: 'IN_MEETING',
  CREATING: 'CREATING',
  REVIEWING: 'REVIEWING',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  WAITING_APPROVAL: 'AWAITING_APPROVAL',
  COMPLETED: 'COMPLETED',
  UNAVAILABLE: 'UNAVAILABLE',
  ERROR: 'ERROR',
}         ;
                                   
                                                                     

export const OfficialAgentSlug = {
  HEAD_MARKETING: 'head-de-marketing',
  HEAD_CREATIVE: 'head-criativo',
  SOCIAL_MEDIA: 'social-media',
  BRANDING_DESIGNER: 'designer-de-branding',
  ART_CAROUSEL_DESIGNER: 'designer-de-artes-e-carrosseis',
  VIDEO_EDITOR: 'editor-de-video',
  COPYWRITER: 'copywriter',
  PAID_TRAFFIC_MANAGER: 'gestor-de-trafego-pago',
  PERFORMANCE_ANALYST: 'analista-de-performance',
  QUALITY_REVIEWER: 'revisor-de-qualidade',
  PUBLISHING_AGENT: 'agente-de-publicacao',
}         ;
                               
                                                             

                                 
                          
                
               
                    
                     
                    
                      
                        
                                
                              
                                     
                                               
                                
                         
 

export const OFFICIAL_FALCON_AGENTS                            = [
  {
    slug: OfficialAgentSlug.HEAD_MARKETING,
    order: 1,
    name: 'Atlas (Head de Marketing)',
    roleTitle: 'Head de Marketing',
    department: 'Diretoria & Estratégia',
    specialty: 'Receber pedidos, interpretar objetivos, planejar, priorizar, coordenar e consolidar entregas.',
    description: 'Supervisor geral da agência virtual. Transforma solicitações em projetos e distribui tarefas coordenadas.',
    isSupervisor: true,
    defaultSector: OfficeSectorId.HEAD_OFFICE,
    defaultPaletteIndex: 0,
    authorizedTools: [
      'brand.query',
      'project.create',
      'task.assign',
      'task.inspect',
      'agent.message',
      'approval.request',
    ],
    memoryScopes: Object.values(BrandMemoryCategory),
    maxTokensPerExecution: 16000,
    timeoutSeconds: 120,
  },
  {
    slug: OfficialAgentSlug.HEAD_CREATIVE,
    order: 2,
    name: 'Lumina (Head Criativo)',
    roleTitle: 'Head Criativo',
    department: 'Criação & Conceito',
    specialty: 'Definir conceito, direção criativa, formatos e coerência entre peças.',
    description: 'Garante que todas as campanhas e pautas tenham direção conceitual forte e alinhada à marca.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.STRATEGY_PLANNING,
    defaultPaletteIndex: 1,
    authorizedTools: [
      'brand.query',
      'studio.create_concept',
      'studio.define_briefing',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.INSTITUTIONAL_IDENTITY,
      BrandMemoryCategory.VISUAL_IDENTITY,
      BrandMemoryCategory.POSITIONING_STRATEGY,
      BrandMemoryCategory.TONE_OF_VOICE,
      BrandMemoryCategory.REFERENCES_COMPETITORS,
      BrandMemoryCategory.RESTRICTIONS_PROHIBITIONS,
    ],
    maxTokensPerExecution: 12000,
    timeoutSeconds: 90,
  },
  {
    slug: OfficialAgentSlug.SOCIAL_MEDIA,
    order: 3,
    name: 'Pulse (Social Media)',
    roleTitle: 'Social Media',
    department: 'Conteúdo & Canais',
    specialty: 'Planejar calendário, pautas, formatos, canais e rotina de conteúdo.',
    description: 'Estrutura calendários editoriais, frequência de postagens e distribuição por canal.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.SOCIAL_MEDIA_AREA,
    defaultPaletteIndex: 2,
    authorizedTools: [
      'brand.query',
      'social.plan_calendar',
      'studio.create_pauta',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.PRODUCTS_SERVICES,
      BrandMemoryCategory.AUDIENCES_PERSONAS,
      BrandMemoryCategory.TONE_OF_VOICE,
      BrandMemoryCategory.OPERATIONAL_PREFERENCES,
      BrandMemoryCategory.RESTRICTIONS_PROHIBITIONS,
    ],
    maxTokensPerExecution: 10000,
    timeoutSeconds: 90,
  },
  {
    slug: OfficialAgentSlug.BRANDING_DESIGNER,
    order: 4,
    name: 'Vetor (Designer de Branding)',
    roleTitle: 'Designer de Branding',
    department: 'Design & Identidade',
    specialty: 'Aplicar e proteger identidade visual, sistemas de marca e consistência.',
    description: 'Zela pela aplicação correta de paleta, tipografia, logotipo e sistemas visuais.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.DESIGN_BRANDING_AREA,
    defaultPaletteIndex: 3,
    authorizedTools: [
      'brand.query',
      'studio.validate_visual_identity',
      'studio.generate_brand_guidelines',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.INSTITUTIONAL_IDENTITY,
      BrandMemoryCategory.VISUAL_IDENTITY,
      BrandMemoryCategory.POSITIONING_STRATEGY,
      BrandMemoryCategory.RESTRICTIONS_PROHIBITIONS,
    ],
    maxTokensPerExecution: 10000,
    timeoutSeconds: 90,
  },
  {
    slug: OfficialAgentSlug.ART_CAROUSEL_DESIGNER,
    order: 5,
    name: 'Prisma (Designer de Artes e Carrosséis)',
    roleTitle: 'Designer de Artes e Carrosséis',
    department: 'Design & Produção',
    specialty: 'Criar peças estáticas, layouts, carrosséis e adaptações.',
    description: 'Produz layouts visuais, carrosséis lâmina a lâmina e adaptações multiformato.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.DESIGN_BRANDING_AREA,
    defaultPaletteIndex: 4,
    authorizedTools: [
      'brand.query',
      'studio.generate_static_art',
      'studio.generate_carousel',
      'storage.save_asset',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.VISUAL_IDENTITY,
      BrandMemoryCategory.PRODUCTS_SERVICES,
      BrandMemoryCategory.RESTRICTIONS_PROHIBITIONS,
      BrandMemoryCategory.OPERATIONAL_PREFERENCES,
    ],
    maxTokensPerExecution: 12000,
    timeoutSeconds: 120,
  },
  {
    slug: OfficialAgentSlug.VIDEO_EDITOR,
    order: 6,
    name: 'Frame (Editor de Vídeo)',
    roleTitle: 'Editor de Vídeo',
    department: 'Audiovisual',
    specialty: 'Estruturar cortes, roteiros visuais, edição, legendas e versões.',
    description: 'Cria roteiros técnicos de vídeo, decupagem de cenas, legendas dinâmicas e renderização audiovisual.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.AUDIOVISUAL_STUDIO,
    defaultPaletteIndex: 5,
    authorizedTools: [
      'brand.query',
      'studio.create_video_script',
      'studio.render_video_composition',
      'storage.save_asset',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.VISUAL_IDENTITY,
      BrandMemoryCategory.TONE_OF_VOICE,
      BrandMemoryCategory.PRODUCTS_SERVICES,
      BrandMemoryCategory.OPERATIONAL_PREFERENCES,
    ],
    maxTokensPerExecution: 14000,
    timeoutSeconds: 180,
  },
  {
    slug: OfficialAgentSlug.COPYWRITER,
    order: 7,
    name: 'Verbo (Copywriter)',
    roleTitle: 'Copywriter',
    department: 'Conteúdo & Copy',
    specialty: 'Criar textos, títulos, roteiros, legendas, CTAs e mensagens.',
    description: 'Especialista em escrita persuasiva e institucional fiel ao tom de voz da empresa.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.SOCIAL_MEDIA_AREA,
    defaultPaletteIndex: 0,
    authorizedTools: [
      'brand.query',
      'studio.write_copy',
      'studio.generate_variations',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.INSTITUTIONAL_IDENTITY,
      BrandMemoryCategory.PRODUCTS_SERVICES,
      BrandMemoryCategory.AUDIENCES_PERSONAS,
      BrandMemoryCategory.POSITIONING_STRATEGY,
      BrandMemoryCategory.TONE_OF_VOICE,
      BrandMemoryCategory.RESTRICTIONS_PROHIBITIONS,
    ],
    maxTokensPerExecution: 12000,
    timeoutSeconds: 90,
  },
  {
    slug: OfficialAgentSlug.PAID_TRAFFIC_MANAGER,
    order: 8,
    name: 'Scale (Gestor de Tráfego Pago)',
    roleTitle: 'Gestor de Tráfego Pago',
    department: 'Mídia Paga & Aquisição',
    specialty: 'Planejar campanhas, públicos, orçamento e configurações autorizadas.',
    description: 'Estrutura campanhas de Meta Ads, segmentações e propostas de otimização respeitando travas de orçamento.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.PAID_TRAFFIC_AREA,
    defaultPaletteIndex: 1,
    authorizedTools: [
      'brand.query',
      'ads.read_campaigns',
      'ads.create_campaign_draft',
      'ads.propose_optimization',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.PRODUCTS_SERVICES,
      BrandMemoryCategory.AUDIENCES_PERSONAS,
      BrandMemoryCategory.CAMPAIGNS_LEARNINGS,
      BrandMemoryCategory.RESTRICTIONS_PROHIBITIONS,
    ],
    maxTokensPerExecution: 12000,
    timeoutSeconds: 90,
  },
  {
    slug: OfficialAgentSlug.PERFORMANCE_ANALYST,
    order: 9,
    name: 'Metric (Analista de Performance)',
    roleTitle: 'Analista de Performance',
    department: 'Dados & Inteligência',
    specialty: 'Analisar indicadores, identificar tendências e recomendar ações.',
    description: 'Transforma métricas de redes sociais, anúncios e CRM em diagnósticos baseados em evidências.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.PERFORMANCE_RESULTS_AREA,
    defaultPaletteIndex: 2,
    authorizedTools: [
      'brand.query',
      'performance.read_metrics',
      'performance.generate_report',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.CAMPAIGNS_LEARNINGS,
      BrandMemoryCategory.PRODUCTS_SERVICES,
      BrandMemoryCategory.POSITIONING_STRATEGY,
    ],
    maxTokensPerExecution: 12000,
    timeoutSeconds: 90,
  },
  {
    slug: OfficialAgentSlug.QUALITY_REVIEWER,
    order: 10,
    name: 'Aegis (Revisor de Qualidade)',
    roleTitle: 'Revisor de Qualidade',
    department: 'Qualidade & Governança',
    specialty: 'Verificar briefing, marca, conteúdo, formato, ortografia e critérios de entrega.',
    description: 'Guardião da qualidade. Inspeciona todas as entregas antes de liberá-las para aprovação do cliente.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.PERFORMANCE_RESULTS_AREA,
    defaultPaletteIndex: 3,
    authorizedTools: [
      'brand.query',
      'qa.inspect_deliverable',
      'qa.approve_for_client_review',
      'qa.request_agent_revision',
      'agent.message',
    ],
    memoryScopes: Object.values(BrandMemoryCategory),
    maxTokensPerExecution: 12000,
    timeoutSeconds: 90,
  },
  {
    slug: OfficialAgentSlug.PUBLISHING_AGENT,
    order: 11,
    name: 'Dispatch (Agente de Publicação)',
    roleTitle: 'Agente de Publicação',
    department: 'Operações & Publicação',
    specialty: 'Preparar, agendar e publicar conteúdo conforme permissões e aprovações.',
    description: 'Executa agendamentos e publicações externas exclusivamente para versões aprovadas.',
    isSupervisor: false,
    defaultSector: OfficeSectorId.SOCIAL_MEDIA_AREA,
    defaultPaletteIndex: 4,
    authorizedTools: [
      'approval.verify_version_lock',
      'social.schedule_post',
      'social.publish_approved_post',
      'agent.message',
    ],
    memoryScopes: [
      BrandMemoryCategory.OPERATIONAL_PREFERENCES,
      BrandMemoryCategory.RESTRICTIONS_PROHIBITIONS,
    ],
    maxTokensPerExecution: 8000,
    timeoutSeconds: 60,
  },
];

// ============================================================================
// 6. TAREFAS, PROJETOS, EXECUÇÕES E MODOS DE AUTONOMIA (Seções 11 e 12)
// ============================================================================

export const TaskStatus = {
  BACKLOG: 'BACKLOG',
  PLANNED: 'PLANNED',
  AWAITING_DEPENDENCY: 'AWAITING_DEPENDENCY',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  AWAITING_CLIENT: 'AWAITING_CLIENT',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
}         ;
                                                                      

export const ProjectStatus = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
}         ;
                                                                               

export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
}         ;
                                                                            

export const DeliverableType = {
  EDITORIAL_CALENDAR: 'EDITORIAL_CALENDAR',
  COPY_PACK: 'COPY_PACK',
  STATIC_ART: 'STATIC_ART',
  CAROUSEL: 'CAROUSEL',
  VIDEO_SCRIPT: 'VIDEO_SCRIPT',
  AD_CAMPAIGN_PLAN: 'AD_CAMPAIGN_PLAN',
  PERFORMANCE_REPORT: 'PERFORMANCE_REPORT',
}         ;
                             
                                                         

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REJECTED: 'REJECTED',
}         ;
                            
                                                       

                                                            
                  
                         
       
                       
                           
                           
                          
                         
                              
                    
                    
 

export const AutonomyMode = {
  ASSISTED: 'ASSISTED',
  SEMI_AUTOMATIC: 'SEMI_AUTOMATIC',
  AUTOMATED: 'AUTOMATED',
}         ;
                                                                            

// ============================================================================
// 7. PROTOCOLO REALTIME ENTRE BACKEND E FALCON VIRTUAL OFFICE 3D (Seção 4 e 13)
// ============================================================================

                                 
     
                              
                             
                        
                     
                        
                                
                     
                          
                           
                               
                                                
                                     
                                        
                              
                        
                       
         
                                  
                                    
     
     
                                  
                             
                      
                              
                                              
                                   
                                      
                                   
                                    
                        
     
     
                                  
                             
                        
                     
                    
                                 
                            
                                            
                        
     
     
                                 
                             
                         
                        
                     
                                   
                              
                    
                        
      

                                   
     
                               
                             
     
     
                                   
                      
     
     
                                     
                           
                           
     
     
                                 
                            
                          
      
