# ADR 0002 — Adaptação do Pixel Agents e Desacoplamento do Motor 3D (FALCON VIRTUAL OFFICE)

- **Status:** Aceito
- **Data:** 2026-11-10
- **Decisores:** Diretoria de Produto & CTO / Arquitetura FALCON GROWTH

## Contexto
O projeto conta com o código-fonte open source do **Pixel Agents v1.6.0** (licença MIT) como acelerador para o escritório virtual. A auditoria técnica revelou que o Pixel Agents possui excelente engenharia de simulação espacial (grid de tiles, pareamento cadeira↔mesa↔computador, alocação por áreas/setores, pathfinding BFS 4-direcional, máquina de estados de personagens e editor imutável com undo/redo e rotação de grupos), mas sua camada de renderização atual é 2D Top-Down em HTML5 Canvas, enquanto o Documento Mestre exige um **Escritório Virtual 3D navegável** com movimentação livre do usuário e movimentação automática dos agentes.

## Decisão
1. **Extração do Núcleo Espacial Puro (`@falcon/office-engine`):**
   - Reaproveitamos e expandimos a matemática espacial, serialização de layout, zonas departamentais (`Areas`), pareamento de estações (`workstations`), busca de caminhos (`findPath`) e ações do editor (`editorActions`) do Pixel Agents em um pacote compartilhado independente de DOM.
2. **Renderização 3D WebGL (Three.js) + Modo 2D Leve + Fallback Dashboard:**
   - O estado espacial (`OfficeState`) alimenta diretamente a cena **3D navegável** (onde cada tile `(col, row)` corresponde a `(X, Z)` no espaço 3D, com os 9 setores da agência, objetos clicáveis vinculados aos módulos do SaaS e avatar do próprio usuário com movimentação livre por teclado/mouse/toque).
   - O renderizador Canvas 2D é preservado como **Modo 2D Leve (Planta Baixa Interativa)** para dispositivos modestos, e o **Dashboard Tradicional** permanece 100% funcional caso o 3D esteja indisponível.
3. **Desacoplamento Estrito entre Visual e IA:**
   - A camada 3D nunca executa lógica de IA nem inventa animações de tarefas inexistentes. Todo estado visual dos avatares (`AVAILABLE`, `EXECUTING`, `IN_MEETING`, `CREATING`, `REVIEWING`, `AWAITING_APPROVAL`, `COMPLETED`, `UNAVAILABLE`, `ERROR`) é comandado pelo backend via eventos reais.
