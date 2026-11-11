# FALCON GROWTH

**Sua agência. Sua equipe. Sua inteligência.**

Plataforma SaaS multi-tenant que permite a uma empresa operar sua própria agência de marketing virtual inteligente, apoiada por uma equipe coordenada de 11 agentes de IA especializados, memória de marca estruturada (**FALCON BRAND INTELLIGENCE**), gestão de projetos, aprovações, estúdio criativo, CRM, redes sociais, tráfego pago, análise de performance e um **Escritório Virtual 3D navegável** (**FALCON VIRTUAL OFFICE**).

## Arquitetura do Monorepo

- `packages/config`: Configuração de ambientes, validação e logger estruturado com redação automática de segredos.
- `packages/security`: Cofre criptográfico (`AES-256-GCM`), hashing de senhas (`scrypt`), tokens assinados, chaves de idempotência e checksums.
- `packages/contracts`: Fonte única de verdade para contratos de domínio, os 11 agentes oficiais, estados de tarefas/organizações, os 9 ambientes do escritório 3D e protocolo WebSocket em tempo real.
- `packages/db-core`: Control Plane (`FALCON CORE`) — gestão de organizações, planos, provisionamento e catálogo global.
- `packages/db-tenant`: Tenant Data Plane — bancos operacionais individuais por empresa, migrations versionadas, backup/restore e `TenantConnectionRouter`.
- `packages/ai-runtime`: Motor de execução dos 11 agentes, prompts versionados, `Tool Registry`, limites de execução e orquestrador (`Head de Marketing`).
- `packages/office-engine`: Motor espacial do `FALCON VIRTUAL OFFICE 3D` e `FALCON OFFICE BUILDER` (adaptado e expandido a partir do Pixel Agents sob licença MIT).
- `apps/api`: Servidor Backend modular (REST + WebSockets em tempo real) e workers assíncronos.
- `apps/web`: Aplicação Web SaaS (Dashboard tradicional completo, Wizard `FALCON SETUP`, `FALCON VIRTUAL OFFICE 3D`, `FALCON COMMAND`, `FALCON STUDIO`, `FALCON APPROVALS`, `CRM`, `SOCIAL`, `ADS` e `PERFORMANCE`).
- `pixel-agents-main/`: Repositório original do Pixel Agents preservado integralmente como referência.

## Como Executar Localmente

1. Copie `.env.example` para `.env`.
2. Execute os testes automatizados de todas as camadas:
   ```bash
   npm test
   ```
3. (Opcional com Docker) Suba a infraestrutura de containers (PostgreSQL 16 + pgvector, Redis 7, MinIO S3):
   ```bash
   npm run docker:up
   ```
   *Nota: Em ambientes de desenvolvimento sem Docker instalado, o provisionador opera automaticamente com instâncias de banco de dados físicas isoladas em disco por tenant (`data/instances/`).*
