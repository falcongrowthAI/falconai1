# ADR 0001 — Arquitetura Multi-Tenant com Instância PostgreSQL Individual por Empresa

- **Status:** Aceito
- **Data:** 2026-11-10
- **Decisores:** Diretoria de Produto & CTO / Arquitetura FALCON GROWTH

## Contexto
O Documento Mestre do FALCON GROWTH (Seção 4 e Seção 6) estabelece como regra inegociável que cada empresa cliente (Tenant) deve possuir sua própria instância operacional exclusiva de banco de dados PostgreSQL, proibindo a simplificação silenciosa por um único banco com schemas compartilhados.

## Decisão
1. **Separação Estrita entre Control Plane e Tenant Data Plane:**
   - **FALCON CORE (Control Plane):** Banco PostgreSQL central que armazena apenas dados globais do SaaS (organizações, planos, assinaturas, status comercial, catálogo global de templates/agentes/itens 3D, auditoria administrativa, consumo consolidado e registro seguro das instâncias de banco dos tenants).
   - **Tenant Database (Tenant Data Plane):** Cada organização possui seu próprio banco de dados operacional exclusivo (`falcon_tenant_<org_id>`), contendo usuários da organização, configurações de autonomia, memória da marca (`FALCON BRAND INTELLIGENCE`), os 11 agentes da equipe, projetos, tarefas, execuções, aprovações, layout do escritório 3D, CRM, redes sociais, anúncios e auditoria operacional.
2. **Criptografia de Credenciais (Envelope Encryption):**
   - As credenciais de conexão de cada banco de tenant nunca são salvas em texto puro no `FALCON CORE`. Utilizamos criptografia autenticada `AES-256-GCM` com IV aleatório de 96 bits e Auth Tag de 128 bits gerenciada pelo módulo `@falcon/security` (`SecretVault`).
3. **Roteamento Seguro (`TenantConnectionRouter`):**
   - O frontend nunca informa ou escolhe a instância de banco. O backend extrai o `organizationId` exclusivamente do token de sessão autenticado, valida o vínculo e o status `ACTIVE` da organização no `FALCON CORE` e resolve a conexão isolada daquele tenant.
4. **Portabilidade de Runtime (Cluster PostgreSQL / Serverless API / Instância Isolada Local):**
   - O provisionador suporta tanto clusters PostgreSQL via TCP (`CREATE DATABASE falcon_tenant_<id>` com role exclusiva de privilégio mínimo) quanto instâncias isoladas dedicadas por arquivo/diretório em ambientes locais sem Docker, mantendo 100% de isolamento físico e lógico entre os dados de cada empresa.

## Consequências
- **Positivas:** Isolamento máximo de segurança e LGPD; backup e restauração individuais por empresa sem risco de afetar outros clientes; zero vazamento cruzado em queries sem cláusula `WHERE tenant_id`.
- **Negativas / Mitigadas:** Maior número de conexões gerenciadas pelo backend, mitigado com pool LRU (`TenantConnectionManager`) que encerra conexões ociosas automaticamente e valida migrations por versão (`schema_version`).
